import { useMemo, useState } from 'react';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import { filesApi, type DocumentAccessMember, type FolderAccessInput, type FolderAccessLevel } from '../api/filesApi';
import { endOfDay, isFuture, shortDay, toDay, todayPlus } from '../lib/accessDates';
import { Icon, StateBlock, useAction, useFm, useLoad } from './fmShared';
import './FolderAccessDrawer.css';

type Props = {
    documentId: string;
    onClose: () => void;
    onChanged: () => void;
};

function userLabel(user: TimeTrackingUserRow): string {
    return (user.display_name ?? '').trim() || user.email;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function DocumentAccessDrawer({ documentId, onClose, onChanged }: Props) {
    const { tr, locale } = useFm();
    const act = useAction();
    const access = useLoad(() => filesApi.documentAccess(documentId), [documentId]);
    const users = useLoad(() => listTimeTrackingUsers(), []);
    const [query, setQuery] = useState('');
    const [openRow, setOpenRow] = useState<number | null>(null);
    const [draft, setDraft] = useState({ until: '', suspendedUntil: '' });
    const [addUser, setAddUser] = useState('');
    const [addLevel, setAddLevel] = useState<FolderAccessLevel>('read');
    const [addUntil, setAddUntil] = useState('');
    const data = access.data && access.data.document.id === documentId ? access.data : null;

    const members = useMemo(() => {
        const text = query.trim().toLowerCase();
        const rows = data?.members ?? [];
        return text ? rows.filter((row) => `${row.name} ${row.position}`.toLowerCase().includes(text)) : rows;
    }, [data, query]);
    const known = useMemo(() => new Set((data?.members ?? []).map((row) => row.userId)), [data]);
    const candidates = useMemo(
        () => (users.data ?? []).filter((user) => !user.is_blocked && !user.is_archived && !known.has(user.id)),
        [users.data, known],
    );

    const refresh = () => {
        access.reload();
        onChanged();
    };

    const save = async (member: DocumentAccessMember, patch: Partial<FolderAccessInput>) => {
        const entry = member.entry;
        const fallback: FolderAccessLevel = member.effective === 'edit' ? 'edit' : 'read';
        const ok = await act(() => filesApi.setDocumentAccess(documentId, {
            userId: member.userId,
            userName: member.name,
            level: entry?.level ?? fallback,
            note: entry?.note ?? '',
            until: entry?.until ?? null,
            suspendedUntil: entry?.suspendedUntil ?? null,
            ...patch,
        }), tr('folderAccess.saved'));
        if (ok)
            refresh();
        return Boolean(ok);
    };

    const remove = async (member: DocumentAccessMember) => {
        const ok = await act(() => filesApi.removeDocumentAccess(documentId, member.userId), tr('folderAccess.saved'));
        if (ok)
            refresh();
    };

    const setLevel = async (member: DocumentAccessMember, next: FolderAccessLevel | null) => {
        if (next === null) {
            const throughFolder = !data?.document.restricted && (member.viaFolder === 'read' || member.viaFolder === 'edit');
            if (throughFolder)
                await save(member, { level: 'deny' });
            else if (member.entry)
                await remove(member);
            return;
        }
        await save(member, { level: next });
    };

    const status = (member: DocumentAccessMember): { text: string; tone: string } => {
        if (member.owner)
            return { text: tr('docAccess.statusOwner'), tone: 'partner' };
        if (member.partner)
            return { text: tr('folderAccess.statusPartner'), tone: 'partner' };
        if (member.entry && isFuture(member.entry.suspendedUntil))
            return { text: tr('folderAccess.statusSuspended'), tone: 'deny' };
        switch (member.effective) {
            case 'deny':
                return { text: tr('docAccess.statusDeny'), tone: 'deny' };
            case 'edit':
                return { text: tr('folderAccess.statusEdit'), tone: 'edit' };
            case 'read':
                return { text: tr('docAccess.statusRead'), tone: 'read' };
            default:
                return { text: tr('docAccess.statusHidden'), tone: 'none' };
        }
    };

    const doc = data?.document;

    return (
        <aside className="fm-pane fm-faccess" aria-label={tr('docAccess.title')}>
            <header className="fm-pane__head">
                <span className="fm-faccess__badge" aria-hidden><Icon name="key" /></span>
                <div>
                    <h3>{tr('docAccess.title')}</h3>
                    <p title={doc?.name ?? ''}>{doc ? doc.name : '…'}</p>
                </div>
                <button type="button" className="fm-btn fm-faccess__close" onClick={onClose} aria-label={tr('common.close')}>
                    <Icon name="close" />
                </button>
            </header>
            <div className="fm-faccess__body">
                <StateBlock loading={access.loading && !data} error={access.error} onRetry={access.reload}>
                    {data && doc ? (
                        <>
                            <p className="fm-faccess__note">
                                {tr('docAccess.meta', { author: doc.createdBy || '—', folder: doc.folderName || tr('docAccess.root') })}
                            </p>
                            <label className={doc.restricted ? 'fm-faccess__inherit is-restricted' : 'fm-faccess__inherit'}>
                                <input type="checkbox" checked={doc.restricted}
                                    onChange={async (event) => {
                                        const next = event.target.checked;
                                        const ok = await act(() => filesApi.setDocumentRestricted(documentId, next), tr('folderAccess.saved'));
                                        if (ok)
                                            refresh();
                                    }} />
                                <span>
                                    <strong>{tr('docAccess.restricted')}</strong>
                                    <small>{doc.restricted ? tr('docAccess.restrictedOn') : tr('docAccess.restrictedOff')}</small>
                                </span>
                            </label>

                            <label className="fm-faccess__search">
                                <Icon name="search" />
                                <input value={query} onChange={(event) => setQuery(event.target.value)}
                                    placeholder={tr('folderAccess.search')} aria-label={tr('folderAccess.search')} />
                            </label>

                            <ul className="fm-faccess__list">
                                {members.map((member) => {
                                    const tone = status(member);
                                    const fixed = member.owner || member.partner;
                                    const entry = member.entry;
                                    const expanded = openRow === member.userId;
                                    const sees = member.effective === 'read' || member.effective === 'edit';
                                    const closedByFolder = member.viaFolder === 'deny';
                                    return (
                                        <li key={member.userId} className={`fm-faccess__row is-${tone.tone}`}>
                                            <div className="fm-faccess__who">
                                                <span className="fm-faccess__avatar" aria-hidden>{initials(member.name)}</span>
                                                <span className="fm-faccess__name">
                                                    <strong>{member.name}</strong>
                                                    <small>{member.position || tr('security.noPosition')}</small>
                                                </span>
                                                <span className={`fm-faccess__chip is-${tone.tone}`}>{tone.text}</span>
                                            </div>
                                            <div className="fm-faccess__checks" role="group" aria-label={member.name}>
                                                <label>
                                                    <input type="checkbox" disabled={fixed || closedByFolder}
                                                        checked={fixed || sees}
                                                        onChange={(event) => void setLevel(member, event.target.checked ? 'read' : null)} />
                                                    <span>{tr('docAccess.colRead')}</span>
                                                </label>
                                                <label>
                                                    <input type="checkbox" disabled={fixed || closedByFolder}
                                                        checked={fixed || member.effective === 'edit'}
                                                        onChange={(event) => void setLevel(member, event.target.checked ? 'edit' : 'read')} />
                                                    <span>{tr('folderAccess.colEdit')}</span>
                                                </label>
                                                <label className="is-danger">
                                                    <input type="checkbox" disabled={fixed || closedByFolder}
                                                        checked={!fixed && entry?.level === 'deny'}
                                                        onChange={(event) => void (event.target.checked
                                                            ? setLevel(member, 'deny')
                                                            : entry ? remove(member) : Promise.resolve())} />
                                                    <span>{tr('folderAccess.colDeny')}</span>
                                                </label>
                                                <button type="button" className={expanded ? 'fm-faccess__more is-on' : 'fm-faccess__more'}
                                                    disabled={fixed} aria-expanded={expanded}
                                                    title={tr('folderAccess.temporary')} aria-label={tr('folderAccess.temporary')}
                                                    onClick={() => {
                                                        setOpenRow(expanded ? null : member.userId);
                                                        setDraft({ until: toDay(entry?.until), suspendedUntil: toDay(entry?.suspendedUntil) });
                                                    }}>
                                                    <Icon name="clock" />
                                                </button>
                                            </div>
                                            {!fixed && !entry && member.viaFolder && member.viaFolder !== 'own' ? (
                                                <p className="fm-faccess__hint">
                                                    {closedByFolder
                                                        ? tr('docAccess.folderClosed')
                                                        : doc.restricted
                                                            ? tr('docAccess.folderIgnored')
                                                            : tr('docAccess.viaFolder', { name: doc.folderName || tr('docAccess.root') })}
                                                </p>
                                            ) : null}
                                            {entry && (entry.until || isFuture(entry.suspendedUntil)) ? (
                                                <div className="fm-faccess__temp">
                                                    {entry.until ? (
                                                        <span className={isFuture(entry.until) ? 'fm-faccess__tag' : 'fm-faccess__tag is-over'}>
                                                            <Icon name="clock" />
                                                            {isFuture(entry.until)
                                                                ? tr('folderAccess.until', { date: shortDay(entry.until, locale) })
                                                                : tr('folderAccess.expired', { date: shortDay(entry.until, locale) })}
                                                        </span>
                                                    ) : null}
                                                    {isFuture(entry.suspendedUntil) ? (
                                                        <span className="fm-faccess__tag is-paused">
                                                            {tr('folderAccess.pausedUntil', { date: shortDay(entry.suspendedUntil, locale) })}
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
                                                        <input type="date" value={draft.suspendedUntil} min={todayPlus(0)} max={draft.until || undefined}
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
                                                        <button type="button" className="fm-btn fm-btn--primary" onClick={async () => {
                                                            const ok = await save(member, {
                                                                until: endOfDay(draft.until),
                                                                suspendedUntil: endOfDay(draft.suspendedUntil),
                                                            });
                                                            if (ok)
                                                                setOpenRow(null);
                                                        }}>{tr('common.save')}</button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>

                            <form className="fm-faccess__add" onSubmit={async (event) => {
                                event.preventDefault();
                                const user = candidates.find((row) => String(row.id) === addUser);
                                if (!user)
                                    return;
                                const ok = await act(() => filesApi.setDocumentAccess(documentId, {
                                    userId: user.id,
                                    userName: userLabel(user),
                                    level: addLevel,
                                    until: endOfDay(addUntil),
                                }), tr('folderAccess.saved'));
                                if (ok) {
                                    setAddUser('');
                                    setAddUntil('');
                                    refresh();
                                }
                            }}>
                                <h4>{tr('docAccess.addTitle')}</h4>
                                <p className="fm-faccess__note">{tr('docAccess.addHint')}</p>
                                <SearchableSelect<TimeTrackingUserRow>
                                    value={addUser}
                                    items={candidates}
                                    getOptionValue={(user) => String(user.id)}
                                    getOptionLabel={userLabel}
                                    getSearchText={(user) => `${userLabel(user)} ${user.email} ${user.position ?? ''}`}
                                    onSelect={(user) => setAddUser(String(user.id))}
                                    placeholder={tr('security.searchUser')}
                                />
                                <div className="fm-faccess__add-row">
                                    <label className="fm-faccess__radio">
                                        <input type="radio" name="da-level" checked={addLevel === 'read'} onChange={() => setAddLevel('read')} />
                                        <span>{tr('docAccess.colRead')}</span>
                                    </label>
                                    <label className="fm-faccess__radio">
                                        <input type="radio" name="da-level" checked={addLevel === 'edit'} onChange={() => setAddLevel('edit')} />
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
