import { useMemo, useState } from 'react';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import {
    filesApi,
    type FolderAccessEntry,
    type FolderAccessInput,
    type FolderAccessLevel,
    type FolderAccessMember,
} from '../api/filesApi';
import { endOfDay, isFuture, toDay, todayPlus } from '../lib/accessDates';
import { usePeopleNames } from '../lib/usePeopleNames';
import { useAnimatedClose } from '../lib/useAnimatedClose';
import { FileBadge, Icon, StateBlock, useAction, useFm, useLoad } from './fmShared';
import './FolderAccessDrawer.css';

type Props = {
    folderId: string;
    onClose: () => void;
    onChanged: () => void;
    onOpenFolder: (folderId: string) => void;
    onShowFolder: (folderId: string) => void;
};

type Draft = { until: string; suspendedUntil: string };

type Level = 'own' | 'read' | 'edit' | 'deny';

const LEVELS: Level[] = ['own', 'read', 'edit', 'deny'];
const LEVEL_LABEL: Record<Level, string> = { own: 'colOwn', read: 'colRead', edit: 'colEdit', deny: 'colDeny' };
const LEVEL_HINT: Record<Level, string> = { own: 'Own', read: 'Read', edit: 'Edit', deny: 'Deny' };
const LEVEL_ICON = { own: 'user', read: 'eye', edit: 'edit', deny: 'lock' } as const;

// The project team may come without a job title; the people directory has it.
const PARTNER_TITLE = /partner|партн[её]р/i;

type FileRule = '' | 'read' | 'edit' | 'deny';

function folderFileLevel(member: FolderAccessMember, restricted: boolean): 'read' | 'edit' | null {
    const level = member.effective;
    return (level === 'read' || level === 'edit') && !restricted ? level : null;
}

function selectedLevel(member: FolderAccessMember): Level {
    if (member.partner)
        return 'edit';
    if (member.entry && isFuture(member.entry.suspendedUntil))
        return member.entry.level;
    return member.effective ?? 'own';
}

function userLabel(user: TimeTrackingUserRow): string {
    return (user.display_name ?? '').trim() || user.email;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function FolderAccessDrawer({ folderId, onClose, onChanged, onOpenFolder, onShowFolder }: Props) {
    const drawer = useAnimatedClose(onClose);
    const { tr, locale } = useFm();
    const act = useAction();
    const access = useLoad(() => filesApi.folderAccess(folderId), [folderId]);
    const people = usePeopleNames(tr('security.userFallback', { id: '{id}' }));
    const [query, setQuery] = useState('');
    const [openRow, setOpenRow] = useState<number | null>(null);
    const [filesRow, setFilesRow] = useState<number | null>(null);
    const [draft, setDraft] = useState<Draft>({ until: '', suspendedUntil: '' });
    const [addUser, setAddUser] = useState('');
    const [addLevel, setAddLevel] = useState<FolderAccessLevel>('read');
    const [addUntil, setAddUntil] = useState('');
    const data = access.data && access.data.folder.id === folderId ? access.data : null;
    const documents = data?.documents ?? [];

    const day = (iso: string | null | undefined) => (iso
        ? new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
        : '');

    const members = useMemo(() => {
        const text = query.trim().toLowerCase();
        const rows = (data?.members ?? []).map((row) => ({
            ...row,
            name: people.nameOf(row.userId, row.name),
            position: people.positionOf(row.userId, row.position),
        })).map((row) => (row.partner || !PARTNER_TITLE.test(row.position) ? row : { ...row, partner: true }));
        return text ? rows.filter((row) => `${row.name} ${row.position}`.toLowerCase().includes(text)) : rows;
    }, [data, query, people]);

    const known = useMemo(() => new Set((data?.members ?? []).map((row) => row.userId)), [data]);
    const candidates = useMemo(
        () => people.users.filter((user) => !user.is_blocked && !user.is_archived && !known.has(user.id)),
        [people.users, known],
    );

    const refresh = () => {
        access.reload();
        onChanged();
    };

    const save = async (member: FolderAccessMember, patch: Partial<FolderAccessInput>) => {
        const entry: FolderAccessEntry | null = member.entry;
        const body: FolderAccessInput = {
            userId: member.userId,
            userName: member.name,
            level: entry?.level ?? (member.effective === 'deny' ? 'own' : member.effective ?? 'own'),
            note: entry?.note ?? '',
            until: entry?.until ?? null,
            suspendedUntil: entry?.suspendedUntil ?? null,
            ...patch,
        };
        const ok = await act(() => filesApi.setFolderAccess(folderId, body), tr('folderAccess.saved'));
        if (ok)
            refresh();
        return Boolean(ok);
    };

    const setFileRule = async (member: FolderAccessMember, documentId: string, rule: FileRule) => {
        const ok = await act(() => (rule
            ? filesApi.setDocumentAccess(documentId, {
                userId: member.userId, userName: member.name, level: rule, note: '', until: null, suspendedUntil: null,
            })
            : filesApi.removeDocumentAccess(documentId, member.userId)), tr('folderAccess.saved'));
        if (ok)
            refresh();
    };

    const remove = async (member: FolderAccessMember) => {
        const ok = await act(() => filesApi.removeFolderAccess(folderId, member.userId), tr('folderAccess.saved'));
        if (ok)
            refresh();
    };

    const setLevel = async (member: FolderAccessMember, next: FolderAccessLevel | null) => {
        const inherited = member.inherited?.level ?? null;
        if (next === null) {
            if (inherited === 'read' || inherited === 'edit')
                await save(member, { level: 'own' });
            else if (member.entry)
                await remove(member);
            return;
        }
        if (next === inherited && member.entry && !member.entry.until && !member.entry.suspendedUntil) {
            await remove(member);
            return;
        }
        await save(member, { level: next });
    };

    const pickLevel = async (member: FolderAccessMember, level: Level, current: Level) => {
        if (level === current && !(member.entry && isFuture(member.entry.suspendedUntil)))
            return;
        if (level === 'own') {
            const parentOpen = member.inherited?.level === 'read' || member.inherited?.level === 'edit';
            if (member.entry && !parentOpen)
                await remove(member);
            else
                await setLevel(member, null);
            return;
        }
        await setLevel(member, level);
    };

    const toggleInherit = async (inherit: boolean) => {
        const ok = await act(() => filesApi.setFolderInherit(folderId, inherit), tr('folderAccess.saved'));
        if (ok)
            refresh();
    };

    const status = (member: FolderAccessMember): { text: string; tone: string } => {
        if (member.partner)
            return { text: tr('folderAccess.statusPartner'), tone: 'partner' };
        if (member.entry && isFuture(member.entry.suspendedUntil))
            return { text: tr('folderAccess.statusSuspended'), tone: 'deny' };
        if (member.effective === 'deny')
            return { text: tr('folderAccess.statusDeny'), tone: 'deny' };
        if (member.effective === 'edit')
            return { text: tr('folderAccess.statusEdit'), tone: 'edit' };
        if (member.effective === 'read')
            return { text: tr('folderAccess.statusRead'), tone: 'read' };
        if (member.matterLevel === 'none' || member.matterLevel === 'deny')
            return { text: tr('folderAccess.statusNone'), tone: 'none' };
        return { text: tr('folderAccess.statusOwn'), tone: 'own' };
    };

    const folder = data?.folder;
    const parent = folder?.path[folder.path.length - 1] ?? null;

    return (
        <aside className={`fm-pane fm-faccess${drawer.closing ? ' is-closing' : ''}`} aria-label={tr('folderAccess.title')} onAnimationEnd={drawer.onAnimationEnd}>
            <header className="fm-pane__head">
                <span className="fm-faccess__badge" aria-hidden><Icon name="shield" /></span>
                <div>
                    <h3>{tr('folderAccess.title')}</h3>
                    <p title={folder ? [...folder.path.map((crumb) => crumb.name), folder.name].join(' / ') : ''}>
                        {folder ? [...folder.path.map((crumb) => crumb.name), folder.name].join(' / ') : '…'}
                    </p>
                </div>
                <button type="button" className="fm-btn fm-faccess__close" onClick={drawer.close} aria-label={tr('common.close')}>
                    <Icon name="close" />
                </button>
            </header>
            <div className="fm-faccess__body">
                <StateBlock loading={access.loading && !data} error={access.error} onRetry={access.reload}>
                    {data && folder ? (
                        <>
                            <div className="fm-faccess__actions">
                                <button type="button" className="fm-btn" onClick={() => onOpenFolder(folder.id)}>
                                    <Icon name="folderOpen" />{tr('folderAccess.openFolder')}
                                </button>
                            </div>
                            {parent ? (
                                <label className="fm-faccess__inherit">
                                    <input type="checkbox" checked={folder.inherit}
                                        onChange={(event) => void toggleInherit(event.target.checked)} />
                                    <span>
                                        <strong>{tr('folderAccess.inherit', { name: parent.name })}</strong>
                                        <small>{folder.inherit ? tr('folderAccess.inheritOn') : tr('folderAccess.inheritOff')}</small>
                                    </span>
                                </label>
                            ) : (
                                <p className="fm-faccess__note">{tr('folderAccess.rootNote')}</p>
                            )}

                            <label className="fm-faccess__search">
                                <Icon name="search" />
                                <input value={query} onChange={(event) => setQuery(event.target.value)}
                                    placeholder={tr('folderAccess.search')} aria-label={tr('folderAccess.search')} />
                            </label>

                            {members.length === 0 ? (
                                <div className="fm-state">{tr('folderAccess.empty')}</div>
                            ) : (
                                <ul className="fm-faccess__list">
                                    {members.map((member) => {
                                        const tone = status(member);
                                        const selected = selectedLevel(member);
                                        const files: Record<string, 'read' | 'edit'> = member.partner
                                            ? Object.fromEntries(documents.map((doc) => [doc.id, 'edit' as const]))
                                            : member.files ?? {};
                                        const rules = member.fileRules ?? {};
                                        const visible = documents.filter((doc) => files[doc.id]).length;
                                        const filesOpen = filesRow === member.userId;
                                        const lockedByParent = member.inherited?.level === 'deny';
                                        const disabled = member.partner;
                                        const expanded = openRow === member.userId;
                                        const entry = member.entry;
                                        return (
                                            <li key={member.userId} className={`fm-faccess__row is-${tone.tone}`}>
                                                <div className="fm-faccess__who">
                                                    <span className="fm-faccess__avatar" aria-hidden>{initials(member.name)}</span>
                                                    <span className="fm-faccess__name">
                                                        <strong>{member.name}</strong>
                                                        <small>
                                                            {member.position || tr('security.noPosition')}
                                                            {member.source === 'folder' ? ` · ${tr('folderAccess.guest')}` : ''}
                                                        </small>
                                                    </span>
                                                    {tone.tone === 'partner' || tone.tone === 'deny' || tone.tone === 'none' ? (
                                                        <span className={`fm-faccess__chip is-${tone.tone}`}>{tone.text}</span>
                                                    ) : null}
                                                    <button type="button"
                                                        className={expanded ? 'fm-faccess__more is-on' : 'fm-faccess__more'}
                                                        disabled={disabled}
                                                        aria-expanded={expanded}
                                                        title={tr('folderAccess.temporary')}
                                                        aria-label={tr('folderAccess.temporary')}
                                                        onClick={() => {
                                                            setOpenRow(expanded ? null : member.userId);
                                                            setDraft({ until: toDay(entry?.until), suspendedUntil: toDay(entry?.suspendedUntil) });
                                                        }}>
                                                        <Icon name="clock" />
                                                    </button>
                                                </div>
                                                <div className="fm-faccess__levels-row">
                                                    <div className="fm-faccess__levels" role="radiogroup" aria-label={`${tr('folderAccess.levelLabel')}: ${member.name}`}>
                                                        {LEVELS.map((level) => {
                                                            const on = selected === level;
                                                            const off = disabled || (lockedByParent && level !== 'deny');
                                                            return (
                                                                <button key={level} type="button" role="radio" aria-checked={on} disabled={off}
                                                                    className={`fm-faccess__level is-${level}${on ? ' is-on' : ''}`}
                                                                    title={tr(`folderAccess.hint${LEVEL_HINT[level]}`)}
                                                                    onClick={() => void pickLevel(member, level, selected)}>
                                                                    <Icon name={LEVEL_ICON[level]} />
                                                                    <span>{tr(`folderAccess.${LEVEL_LABEL[level]}`)}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {!member.partner ? (
                                                    <p className="fm-faccess__hint">
                                                        {lockedByParent ? tr('folderAccess.lockedByParent') : tr(`folderAccess.hint${LEVEL_HINT[selected]}`)}
                                                    </p>
                                                ) : null}
                                                {documents.length ? (
                                                    <div className={`fm-faccess__files${filesOpen ? ' is-open' : ''}`}>
                                                        <button type="button" className="fm-faccess__files-toggle" aria-expanded={filesOpen}
                                                            onClick={() => setFilesRow(filesOpen ? null : member.userId)}>
                                                            <span>{tr('folderAccess.filesSummary', { n: visible, total: documents.length })}</span>
                                                            <span className={`fm-faccess__meter${visible === documents.length ? ' is-full' : visible ? '' : ' is-empty'}`} aria-hidden>
                                                                <i style={{ width: `${Math.round((visible / documents.length) * 100)}%` }} />
                                                            </span>
                                                            <Icon name="chevron" className="fm-faccess__caret" />
                                                        </button>
                                                        {filesOpen ? (
                                                            <>
                                                            {!member.partner ? <p className="fm-faccess__file-hint">{tr('folderAccess.filesHint')}</p> : null}
                                                            <ul className="fm-faccess__file-list">
                                                                {documents.map((doc) => {
                                                                    const level = files[doc.id];
                                                                    const author = doc.createdById === member.userId;
                                                                    const rule = (rules[doc.id] ?? '') as FileRule;
                                                                    const byFolder = folderFileLevel(member, doc.restricted);
                                                                    const notes = [
                                                                        doc.createdById === member.userId ? tr('folderAccess.fileAuthor') : '',
                                                                        doc.restricted ? tr('folderAccess.fileRestricted') : '',
                                                                    ].filter(Boolean).join(' · ');
                                                                    return (
                                                                        <li key={doc.id} className={level ? `is-${level}` : 'is-hidden'}>
                                                                            <FileBadge kind={doc.kind} />
                                                                            <span className="fm-faccess__file-name" title={doc.name}>
                                                                                <span>{doc.name}</span>
                                                                                {notes ? <small>{notes}</small> : null}
                                                                            </span>
                                                                            {member.partner || author ? (
                                                                                <span className={`fm-faccess__file-level is-${level ?? 'none'}`}>
                                                                                    {member.partner ? tr('folderAccess.filePartner') : tr('folderAccess.colEdit')}
                                                                                </span>
                                                                            ) : (
                                                                                <select
                                                                                    className={`fm-faccess__file-select is-${level ?? 'none'}${rule ? ' is-rule' : ''}`}
                                                                                    value={rule}
                                                                                    aria-label={tr('folderAccess.fileRuleFor', { name: member.name, file: doc.name })}
                                                                                    title={rule ? tr('folderAccess.fileOwnRule') : tr('folderAccess.fileFromFolder')}
                                                                                    onChange={(event) => void setFileRule(member, doc.id, event.target.value as FileRule)}
                                                                                >
                                                                                    <option value="">
                                                                                        {tr('folderAccess.fileByFolder', {
                                                                                            level: byFolder ? tr(`folderAccess.${byFolder === 'edit' ? 'colEdit' : 'colRead'}`) : tr('folderAccess.fileHidden'),
                                                                                        })}
                                                                                    </option>
                                                                                    <option value="read">{tr('folderAccess.colRead')}</option>
                                                                                    <option value="edit">{tr('folderAccess.colEdit')}</option>
                                                                                    <option value="deny">{tr('folderAccess.colDeny')}</option>
                                                                                </select>
                                                                            )}
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <p className="fm-faccess__hint is-muted">{tr('folderAccess.filesEmpty')}</p>
                                                )}
                                                {member.inherited && !member.partner ? (
                                                    <p className="fm-faccess__hint">
                                                        {tr('folderAccess.inheritedFrom', { name: member.inherited.folderName })}
                                                        {' '}
                                                        <button type="button" className="fm-faccess__link"
                                                            onClick={() => onShowFolder(member.inherited!.folderId)}>
                                                            {tr('folderAccess.goToSource')}
                                                        </button>
                                                    </p>
                                                ) : null}
                                                {entry && (entry.until || isFuture(entry.suspendedUntil)) ? (
                                                    <div className="fm-faccess__temp">
                                                        {entry.until ? (
                                                            <span className={isFuture(entry.until) ? 'fm-faccess__tag' : 'fm-faccess__tag is-over'}>
                                                                <Icon name="clock" />
                                                                {isFuture(entry.until)
                                                                    ? tr('folderAccess.until', { date: day(entry.until) })
                                                                    : tr('folderAccess.expired', { date: day(entry.until) })}
                                                            </span>
                                                        ) : null}
                                                        {isFuture(entry.suspendedUntil) ? (
                                                            <span className="fm-faccess__tag is-paused">
                                                                {tr('folderAccess.pausedUntil', { date: day(entry.suspendedUntil) })}
                                                                <button type="button" className="fm-faccess__link"
                                                                    onClick={() => void save(member, { suspendedUntil: null })}>
                                                                    {tr('folderAccess.resume')}
                                                                </button>
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                                {expanded ? (
                                                    <div className="fm-faccess__panel">
                                                        <label>
                                                            <span>{tr('folderAccess.grantUntil')}</span>
                                                            <input type="date" value={draft.until} min={todayPlus(0)}
                                                                onChange={(event) => setDraft((prev) => ({ ...prev, until: event.target.value }))} />
                                                        </label>
                                                        <label>
                                                            <span>{tr('folderAccess.suspendUntil')}</span>
                                                            <input type="date" value={draft.suspendedUntil} min={todayPlus(0)}
                                                                max={draft.until || undefined}
                                                                onChange={(event) => setDraft((prev) => ({ ...prev, suspendedUntil: event.target.value }))} />
                                                        </label>
                                                        <div className="fm-faccess__quick">
                                                            <span>{tr('folderAccess.pauseLabel')}</span>
                                                            {[1, 7, 30].map((days) => (
                                                                <button key={days} type="button" className="fm-datebar__chip"
                                                                    onClick={() => setDraft((prev) => ({ ...prev, suspendedUntil: todayPlus(days) }))}>
                                                                    {tr('folderAccess.pauseFor', { n: days })}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <p className="fm-faccess__note">{tr('folderAccess.temporaryHint')}</p>
                                                        <div className="fm-faccess__panel-foot">
                                                            {entry ? (
                                                                <button type="button" className="fm-btn" onClick={() => void remove(member)}>
                                                                    {tr('folderAccess.reset')}
                                                                </button>
                                                            ) : null}
                                                            <button type="button" className="fm-btn fm-btn--primary"
                                                                onClick={async () => {
                                                                    const ok = await save(member, {
                                                                        until: endOfDay(draft.until),
                                                                        suspendedUntil: endOfDay(draft.suspendedUntil),
                                                                    });
                                                                    if (ok)
                                                                        setOpenRow(null);
                                                                }}>
                                                                {tr('common.save')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            <form
                                className="fm-faccess__add"
                                onSubmit={async (event) => {
                                    event.preventDefault();
                                    const user = candidates.find((row) => String(row.id) === addUser);
                                    if (!user)
                                        return;
                                    const ok = await act(() => filesApi.setFolderAccess(folderId, {
                                        userId: user.id,
                                        userName: people.nameOf(user.id),
                                        level: addLevel,
                                        until: endOfDay(addUntil),
                                    }), tr('folderAccess.saved'));
                                    if (ok) {
                                        setAddUser('');
                                        setAddUntil('');
                                        refresh();
                                    }
                                }}
                            >
                                <h4>{tr('folderAccess.addTitle')}</h4>
                                <p className="fm-faccess__note">{tr('folderAccess.addHint')}</p>
                                <SearchableSelect<TimeTrackingUserRow>
                                    value={addUser}
                                    items={candidates}
                                    getOptionValue={(user) => String(user.id)}
                                    getOptionLabel={(user) => people.nameOf(user.id)}
                                    getSearchText={(user) => `${userLabel(user)} ${user.email} ${user.position ?? ''}`}
                                    onSelect={(user) => setAddUser(String(user.id))}
                                    placeholder={tr('security.searchUser')}
                                />
                                <div className="fm-faccess__add-row">
                                    <label className="fm-faccess__radio">
                                        <input type="radio" name="fa-level" checked={addLevel === 'read'} onChange={() => setAddLevel('read')} />
                                        <span>{tr('folderAccess.colRead')}</span>
                                    </label>
                                    <label className="fm-faccess__radio">
                                        <input type="radio" name="fa-level" checked={addLevel === 'edit'} onChange={() => setAddLevel('edit')} />
                                        <span>{tr('folderAccess.colEdit')}</span>
                                    </label>
                                </div>
                                <label className="fm-faccess__date">
                                    <span>{tr('folderAccess.grantUntilOptional')}</span>
                                    <input type="date" value={addUntil} min={todayPlus(0)} onChange={(event) => setAddUntil(event.target.value)} />
                                </label>
                                <button type="submit" className="fm-btn fm-btn--primary" disabled={!addUser}>
                                    <Icon name="plus" />{tr('folderAccess.add')}
                                </button>
                            </form>
                        </>
                    ) : null}
                </StateBlock>
            </div>
        </aside>
    );
}
