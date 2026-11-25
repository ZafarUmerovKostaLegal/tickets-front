import { useMemo, useState } from 'react';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import {
    filesApi,
    type AclLevel,
    type ClientsResponse,
    type FileKind,
    type MatterRow,
    type SecurityFolder,
    type SecurityMember,
    type SecurityResponse,
    type SecuritySummary,
} from '../api/filesApi';
import { endOfDay, isFuture, shortDay, toDay, todayPlus } from '../lib/accessDates';
import { usePeopleNames } from '../lib/usePeopleNames';
import { formatDateTime } from '../lib/filesFormat';
import { DocumentAccessDrawer } from './DocumentAccessDrawer';
import { FolderAccessDrawer } from './FolderAccessDrawer';
import { FileBadge, Icon, Modal, StateBlock, useAction, useFm, useLoad, type IconName } from './fmShared';
import './SecurityWorkspace.css';

type MatterItem = MatterRow & { clientName: string };
type RailFilter = 'all' | 'walls' | 'temporary' | 'folders' | 'pending';
type Tab = 'people' | 'folders' | 'journal';
type PeopleFilter = 'all' | 'explicit' | 'inherited' | 'wall' | 'temporary';
type Person = SecurityMember & { initials: string; email: string; rule: SecurityResponse['acl'][number] | undefined };

const LEVELS: AclLevel[] = ['read', 'edit', 'manage', 'deny'];
const LEVEL_ICON: Record<AclLevel, IconName> = { read: 'eye', edit: 'edit', manage: 'key', deny: 'shield' };
const JOURNAL_ACTIONS = 'acl_set,acl_remove,folder_acl_set,folder_acl_remove,folder_inherit,request_create,request_approve,request_reject,denied';
const EMPTY_SUMMARY: SecuritySummary = { rules: 0, walls: 0, temporary: 0, suspended: 0, folderRules: 0, folders: 0, pending: 0 };

function userLabel(user: TimeTrackingUserRow): string {
    return (user.display_name ?? '').trim() || user.email;
}

function initialsOf(name: string, stored?: string | null): string {
    const ready = (stored ?? '').trim();
    if (ready)
        return ready.slice(0, 3).toUpperCase();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function fileKindOf(name: string): FileKind {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (ext === 'pdf')
        return 'pdf';
    if (['doc', 'docx', 'rtf', 'odt'].includes(ext))
        return 'doc';
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext))
        return 'sheet';
    if (['ppt', 'pptx'].includes(ext))
        return 'slides';
    if (['msg', 'eml'].includes(ext))
        return 'email';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext))
        return 'image';
    if (['zip', 'rar', '7z'].includes(ext))
        return 'archive';
    if (['txt', 'md'].includes(ext))
        return 'text';
    return 'file';
}

function temporaryOf(member: { until?: string | null; suspendedUntil?: string | null }): boolean {
    return Boolean(member.until) || isFuture(member.suspendedUntil);
}

function Kpi({ icon, label, value, tone, hint }: { icon: IconName; label: string; value: number; tone?: string; hint?: string }) {
    return (
        <div className={`fm-sx-kpi${tone ? ` is-${tone}` : ''}`} title={hint}>
            <span className="fm-sx-kpi__ico" aria-hidden><Icon name={icon} /></span>
            <span className="fm-sx-kpi__text">
                <strong>{value}</strong>
                <small>{label}</small>
            </span>
        </div>
    );
}

function MatterRail({ items, overview, matterId, onPick }: {
    items: MatterItem[];
    overview: Record<string, SecuritySummary>;
    matterId: string | null;
    onPick: (id: string) => void;
}) {
    const { tr, locale } = useFm();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<RailFilter>('all');

    const counts = useMemo(() => {
        const out: Record<RailFilter, number> = { all: items.length, walls: 0, temporary: 0, folders: 0, pending: 0 };
        for (const item of items) {
            const sum = overview[item.id] ?? EMPTY_SUMMARY;
            if (sum.walls)
                out.walls += 1;
            if (sum.temporary || sum.suspended)
                out.temporary += 1;
            if (sum.folders || sum.documents)
                out.folders += 1;
            if (sum.pending)
                out.pending += 1;
        }
        return out;
    }, [items, overview]);

    const groups = useMemo(() => {
        const text = query.trim().toLowerCase();
        const shown = items.filter((item) => {
            const sum = overview[item.id] ?? EMPTY_SUMMARY;
            if (filter === 'walls' && !sum.walls)
                return false;
            if (filter === 'temporary' && !sum.temporary && !sum.suspended)
                return false;
            if (filter === 'folders' && !sum.folders && !sum.documents)
                return false;
            if (filter === 'pending' && !sum.pending)
                return false;
            return !text || `${item.clientName} ${item.code} ${item.name}`.toLowerCase().includes(text);
        });
        const byClient = new Map<string, MatterItem[]>();
        for (const item of shown)
            byClient.set(item.clientName, [...(byClient.get(item.clientName) ?? []), item]);
        return [...byClient.entries()]
            .sort(([a], [b]) => a.localeCompare(b, locale))
            .map(([client, rows]) => ({
                client,
                rows: rows.sort((a, b) => Number(a.closed) - Number(b.closed) || a.name.localeCompare(b.name, locale)),
            }));
    }, [items, overview, filter, query, locale]);

    const filters: { id: RailFilter; label: string }[] = [
        { id: 'all', label: tr('securityX.railAll') },
        { id: 'walls', label: tr('securityX.railWalls') },
        { id: 'temporary', label: tr('securityX.railTemporary') },
        { id: 'folders', label: tr('securityX.railFolders') },
        { id: 'pending', label: tr('securityX.railPending') },
    ];

    return (
        <aside className="fm-sx-rail" aria-label={tr('securityX.mattersTitle')}>
            <div className="fm-sx-rail__head">
                <h3>{tr('securityX.mattersTitle')}</h3>
                <span>{items.length}</span>
            </div>
            <label className="fm-sx-search">
                <Icon name="search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)}
                    placeholder={tr('securityX.searchMatter')} aria-label={tr('securityX.searchMatter')} />
            </label>
            <div className="fm-sx-rail__filters" role="radiogroup" aria-label={tr('securityX.mattersTitle')}>
                {filters.map((item) => (
                    <button key={item.id} type="button" role="radio" aria-checked={filter === item.id}
                        className={filter === item.id ? 'fm-sx-chip is-on' : 'fm-sx-chip'}
                        disabled={item.id !== 'all' && counts[item.id] === 0}
                        onClick={() => setFilter(item.id)}>
                        {item.label}
                        <em>{counts[item.id]}</em>
                    </button>
                ))}
            </div>
            <div className="fm-sx-rail__list">
                {groups.length === 0 ? <p className="fm-sx-muted">{tr('securityX.noMatters')}</p> : groups.map((group) => (
                    <section key={group.client}>
                        <h4>{group.client}</h4>
                        <ul>
                            {group.rows.map((item) => {
                                const sum = overview[item.id] ?? EMPTY_SUMMARY;
                                return (
                                    <li key={item.id}>
                                        <button type="button"
                                            className={`fm-sx-matter${item.id === matterId ? ' is-on' : ''}${item.closed ? ' is-closed' : ''}`}
                                            aria-current={item.id === matterId ? 'true' : undefined}
                                            onClick={() => onPick(item.id)}>
                                            <span className="fm-sx-matter__name">
                                                {item.code ? <code>{item.code}</code> : null}
                                                <strong>{item.name}</strong>
                                            </span>
                                            <span className="fm-sx-matter__marks">
                                                {sum.walls ? <span className="fm-sx-mark is-deny" title={tr('securityX.kpiWalls')}><Icon name="shield" />{sum.walls}</span> : null}
                                                {sum.temporary + sum.suspended ? <span className="fm-sx-mark is-temp" title={tr('securityX.kpiTemporary')}><Icon name="clock" />{sum.temporary + sum.suspended}</span> : null}
                                                {sum.folders || sum.documents ? <span className="fm-sx-mark is-folder" title={tr('securityX.kpiFolders')}><Icon name="lock" />{sum.folders + (sum.documents ?? 0)}</span> : null}
                                                {sum.pending ? <span className="fm-sx-mark is-pending" title={tr('securityX.railPending')}><Icon name="inbox" />{sum.pending}</span> : null}
                                                {item.closed ? <span className="fm-sx-mark">{tr('securityX.closed')}</span> : null}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </aside>
    );
}

function PeopleTab({ data, onReload }: { data: SecurityResponse; onReload: () => void }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const { users: catalogUsers, nameOf, positionOf } = usePeopleNames(tr('security.userFallback', { id: '{id}' }));
    const [filter, setFilter] = useState<PeopleFilter>('all');
    const [query, setQuery] = useState('');
    const [grantOpen, setGrantOpen] = useState(false);
    const [granting, setGranting] = useState(false);
    const [addUser, setAddUser] = useState('');
    const [addLevel, setAddLevel] = useState<AclLevel>('read');
    const [addUntil, setAddUntil] = useState('');
    const [addNote, setAddNote] = useState('');
    const [openRow, setOpenRow] = useState<number | null>(null);
    const [draft, setDraft] = useState({ until: '', suspendedUntil: '' });
    const matterId = data.matter.id;

    const catalog = useMemo(() => new Map(catalogUsers.map((user) => [user.id, user])), [catalogUsers]);
    const candidates = useMemo(() => {
        const known = new Set(data.effective.map((row) => row.userId));
        return catalogUsers.filter((user) => !user.is_blocked && !user.is_archived && !known.has(user.id));
    }, [catalogUsers, data.effective]);
    const rules = useMemo(() => new Map(data.acl.map((row) => [row.userId, row])), [data.acl]);

    const people: Person[] = useMemo(() => data.effective.map((member) => {
        const user = catalog.get(member.userId);
        const name = nameOf(member.userId, member.name);
        return {
            ...member,
            name,
            position: positionOf(member.userId, member.position),
            initials: initialsOf(name, user?.initials),
            email: user?.email ?? '',
            rule: rules.get(member.userId),
        };
    }), [data.effective, catalog, rules, nameOf, positionOf]);

    const counts = useMemo(() => ({
        all: people.length,
        explicit: people.filter((row) => row.source !== 'timeTracking').length,
        inherited: people.filter((row) => row.source === 'timeTracking').length,
        wall: people.filter((row) => row.level === 'deny').length,
        temporary: people.filter(temporaryOf).length,
    }), [people]);

    const shown = useMemo(() => {
        const text = query.trim().toLowerCase();
        const rank = (row: Person) => (row.level === 'deny' ? 0 : temporaryOf(row) ? 1 : row.source !== 'timeTracking' ? 2 : 3);
        return people
            .filter((row) => {
                if (filter === 'explicit' && row.source === 'timeTracking')
                    return false;
                if (filter === 'inherited' && row.source !== 'timeTracking')
                    return false;
                if (filter === 'wall' && row.level !== 'deny')
                    return false;
                if (filter === 'temporary' && !temporaryOf(row))
                    return false;
                return !text || `${row.name} ${row.position} ${row.email}`.toLowerCase().includes(text);
            })
            .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, locale));
    }, [people, filter, query, locale]);

    const save = async (person: { userId: number; name: string; rule?: Person['rule'] }, patch: {
        level?: AclLevel;
        until?: string | null;
        suspendedUntil?: string | null;
        note?: string;
    }, fallbackLevel: AclLevel) => {
        const rule = person.rule;
        const ok = await act(() => filesApi.setAcl(matterId, {
            userId: person.userId,
            userName: person.name,
            level: patch.level ?? rule?.level ?? fallbackLevel,
            note: patch.note ?? rule?.note ?? '',
            until: patch.until !== undefined ? patch.until : rule?.until ?? null,
            suspendedUntil: patch.suspendedUntil !== undefined ? patch.suspendedUntil : rule?.suspendedUntil ?? null,
        }), tr('security.changed'));
        if (ok)
            onReload();
        return Boolean(ok);
    };

    const closeGrant = () => {
        setGrantOpen(false);
        setAddUser('');
        setAddUntil('');
        setAddNote('');
        setAddLevel('read');
    };

    const remove = async (person: Person) => {
        const ok = await act(() => filesApi.removeAcl(matterId, person.userId), tr('security.changed'));
        if (ok)
            onReload();
    };

    const filters: { id: PeopleFilter; label: string }[] = [
        { id: 'all', label: tr('security.filterAll') },
        { id: 'explicit', label: tr('security.filterExplicit') },
        { id: 'inherited', label: tr('security.filterInherited') },
        { id: 'temporary', label: tr('securityX.filterTemporary') },
        { id: 'wall', label: tr('security.filterWall') },
    ];

    return (
        <div className="fm-sx-people">
            <div className="fm-sx-toolbar">
                <div className="fm-sx-seg" role="radiogroup" aria-label={tr('security.effective')}>
                    {filters.map((item) => (
                        <button key={item.id} type="button" role="radio" aria-checked={filter === item.id}
                            className={filter === item.id ? 'is-on' : undefined} onClick={() => setFilter(item.id)}>
                            {item.label}<em>{counts[item.id]}</em>
                        </button>
                    ))}
                </div>
                <label className="fm-sx-search fm-sx-search--grow">
                    <Icon name="search" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)}
                        placeholder={tr('security.searchPeople')} aria-label={tr('security.searchPeople')} />
                </label>
                <button type="button" className="fm-btn fm-btn--primary" onClick={() => setGrantOpen(true)}>
                    <Icon name="plus" />{tr('security.grantTitle')}
                </button>
            </div>

            {grantOpen ? (
                <Modal
                    title={tr('securityX.grantModalTitle', { matter: data.matter.code || data.matter.name })}
                    className="fm-sx-modal"
                    onClose={closeGrant}
                    footer={(
                        <>
                            <p className="fm-sx-modal__hint">{addLevel === 'deny' ? tr('security.wallNote') : tr('securityX.grantHint')}</p>
                            <button type="button" className="fm-btn" onClick={closeGrant}>{tr('common.cancel')}</button>
                            <button type="submit" form="fm-sx-grant-form" className="fm-btn fm-btn--primary" disabled={!addUser || granting}>
                                <Icon name="check" />{tr('security.add')}
                            </button>
                        </>
                    )}
                >
                    <form id="fm-sx-grant-form" className="fm-sx-grant" onSubmit={async (event) => {
                        event.preventDefault();
                        const user = candidates.find((row) => String(row.id) === addUser);
                        if (!user || granting)
                            return;
                        const name = nameOf(user.id);
                        setGranting(true);
                        const ok = await save({ userId: user.id, name }, { level: addLevel, until: endOfDay(addUntil), note: addNote, suspendedUntil: null }, addLevel);
                        setGranting(false);
                        if (ok)
                            closeGrant();
                    }}>
                        <div className="fm-field">
                            <span>{tr('security.addUser')}</span>
                            <SearchableSelect<TimeTrackingUserRow>
                                value={addUser}
                                items={candidates}
                                portalDropdown
                                portalZIndex={2100}
                                getOptionValue={(user) => String(user.id)}
                                getOptionLabel={(user) => {
                                    const name = nameOf(user.id);
                                    return user.position ? `${name} · ${user.position}` : name;
                                }}
                                getSearchText={(user) => `${userLabel(user)} ${user.email} ${user.position ?? ''}`}
                                onSelect={(user) => setAddUser(String(user.id))}
                                placeholder={tr('security.searchUser')}
                            />
                        </div>
                        <div className="fm-field">
                            <span>{tr('security.addLevel')}</span>
                            <div className="fm-sx-levels fm-sx-levels--grid" role="radiogroup" aria-label={tr('security.addLevel')}>
                                {LEVELS.map((level) => (
                                    <button key={level} type="button" role="radio" aria-checked={addLevel === level}
                                        className={`is-${level}${addLevel === level ? ' is-on' : ''}`} onClick={() => setAddLevel(level)}>
                                        <Icon name={LEVEL_ICON[level]} />
                                        <span>
                                            <strong>{tr(`securityX.level.${level}`)}</strong>
                                            <small>{tr(`securityX.levelHint.${level}`)}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="fm-sx-grant__row">
                            <label className="fm-field">
                                <span>{tr('securityX.untilOptional')}</span>
                                <input type="date" value={addUntil} min={todayPlus(0)} onChange={(event) => setAddUntil(event.target.value)} />
                            </label>
                            <label className="fm-field">
                                <span>{tr('security.note')}</span>
                                <input value={addNote} maxLength={500} placeholder={tr('security.notePh')} onChange={(event) => setAddNote(event.target.value)} />
                            </label>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {people.length === 0 ? (
                <div className="fm-sx-empty"><Icon name="user" /><p>{tr('security.empty')}</p></div>
            ) : shown.length === 0 ? (
                <div className="fm-sx-empty"><Icon name="search" /><p>{tr('security.emptyFilter')}</p></div>
            ) : (
                <ul className="fm-sx-list">
                    {shown.map((person) => {
                        const rule = person.rule;
                        const paused = isFuture(rule?.suspendedUntil);
                        const expired = Boolean(rule?.until) && !isFuture(rule?.until);
                        const expanded = openRow === person.userId;
                        const base: AclLevel = data.matter.closed ? 'read' : 'edit';
                        const sourceKey = person.source === 'timeTracking' ? 'security.inherited' : person.source === 'acl' ? 'security.explicit' : 'security.both';
                        return (
                            <li key={person.userId} className={`fm-sx-person${person.level === 'deny' ? ' is-deny' : ''}${paused ? ' is-paused' : ''}`}>
                                <div className="fm-sx-person__main">
                                    <span className={`fm-sx-avatar fm-sx-avatar--${person.userId % 6}`} aria-hidden>{person.initials}</span>
                                    <span className="fm-sx-person__who">
                                        <strong>{person.name}</strong>
                                        <small>{person.position || tr('security.noPosition')}</small>
                                    </span>
                                    <span className="fm-sx-person__tags">
                                        <span className={`fm-sx-tag is-${person.source}`}>{tr(sourceKey)}</span>
                                        {person.partner ? <span className="fm-sx-tag is-partner">{tr('securityX.partner')}</span> : null}
                                        {rule?.until ? (
                                            <span className={expired ? 'fm-sx-tag is-over' : 'fm-sx-tag is-temp'}>
                                                <Icon name="clock" />
                                                {expired ? tr('securityX.expired', { date: shortDay(rule.until, locale) }) : tr('securityX.until', { date: shortDay(rule.until, locale) })}
                                            </span>
                                        ) : null}
                                        {paused ? (
                                            <span className="fm-sx-tag is-paused">
                                                {tr('securityX.pausedUntil', { date: shortDay(rule?.suspendedUntil, locale) })}
                                                <button type="button" className="fm-sx-link" onClick={() => void save(person, { suspendedUntil: null }, person.level)}>
                                                    {tr('securityX.resume')}
                                                </button>
                                            </span>
                                        ) : null}
                                    </span>
                                </div>
                                <div className="fm-sx-person__controls">
                                    <div className="fm-sx-levels fm-sx-levels--compact" role="radiogroup" aria-label={person.name}>
                                        {LEVELS.map((level) => (
                                            <button key={level} type="button" role="radio" aria-checked={person.level === level}
                                                className={`is-${level}${person.level === level ? ' is-on' : ''}`}
                                                title={person.partner ? tr('securityX.partnerFixed') : tr(`levels.${level}`)}
                                                disabled={person.partner}
                                                onClick={() => {
                                                    if (person.level === level)
                                                        return;
                                                    if (person.source === 'both' && level === base && !rule?.until && !rule?.suspendedUntil && !rule?.note)
                                                        void remove(person);
                                                    else
                                                        void save(person, { level }, level);
                                                }}>
                                                <Icon name={LEVEL_ICON[level]} /><span>{tr(`securityX.level.${level}`)}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button type="button" className={expanded ? 'fm-sx-icon is-on' : 'fm-sx-icon'}
                                        aria-expanded={expanded} disabled={person.partner} title={tr('securityX.temporary')} aria-label={tr('securityX.temporary')}
                                        onClick={() => {
                                            setOpenRow(expanded ? null : person.userId);
                                            setDraft({ until: toDay(rule?.until), suspendedUntil: toDay(rule?.suspendedUntil) });
                                        }}>
                                        <Icon name="clock" />
                                    </button>
                                    {rule ? (
                                        <button type="button" className="fm-sx-icon" title={tr('security.remove')} aria-label={tr('security.remove')}
                                            onClick={() => void remove(person)}>
                                            <Icon name="x" />
                                        </button>
                                    ) : <span className="fm-sx-icon-slot" aria-hidden />}
                                </div>
                                {rule?.note || rule?.grantedBy ? (
                                    <p className="fm-sx-person__meta">
                                        {rule.note ? <span title={rule.note}>«{rule.note}»</span> : null}
                                        {rule.grantedBy ? <span>{tr('security.grantedBy', { name: rule.grantedBy })}{rule.grantedAt ? ` · ${formatDateTime(rule.grantedAt, locale)}` : ''}</span> : null}
                                    </p>
                                ) : null}
                                {expanded ? (
                                    <div className="fm-sx-temp">
                                        <label>
                                            <span>{tr('securityX.untilLabel')}</span>
                                            <input type="date" value={draft.until} min={todayPlus(0)}
                                                onChange={(event) => setDraft((prev) => ({ ...prev, until: event.target.value }))} />
                                        </label>
                                        <label>
                                            <span>{tr('securityX.suspendLabel')}</span>
                                            <input type="date" value={draft.suspendedUntil} min={todayPlus(0)} max={draft.until || undefined}
                                                onChange={(event) => setDraft((prev) => ({ ...prev, suspendedUntil: event.target.value }))} />
                                        </label>
                                        <div className="fm-sx-temp__quick">
                                            <span>{tr('folderAccess.pauseLabel')}</span>
                                            {[1, 7, 30].map((days) => (
                                                <button key={days} type="button" className="fm-sx-chip"
                                                    onClick={() => setDraft((prev) => ({ ...prev, suspendedUntil: todayPlus(days) }))}>
                                                    {tr('folderAccess.pauseFor', { n: days })}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="fm-sx-muted">{tr('securityX.temporaryHint')}</p>
                                        <div className="fm-sx-temp__foot">
                                            <button type="button" className="fm-btn" onClick={() => setOpenRow(null)}>{tr('common.cancel')}</button>
                                            <button type="button" className="fm-btn fm-btn--primary" onClick={async () => {
                                                const ok = await save(person, {
                                                    until: endOfDay(draft.until),
                                                    suspendedUntil: endOfDay(draft.suspendedUntil),
                                                }, person.level);
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
            )}
        </div>
    );
}

function FoldersTab({ data, onReload, onOpenFolder }: {
    data: SecurityResponse;
    onReload: () => void;
    onOpenFolder: (folderId: string) => void;
}) {
    const { tr } = useFm();
    const [selected, setSelected] = useState<string | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
    const [onlyCustom, setOnlyCustom] = useState(false);
    const folders = useMemo(() => data.folders ?? [], [data.folders]);
    const specialDocs = data.documents ?? [];
    const folderName = (id: string | null) => folders.find((folder) => folder.id === id)?.name ?? tr('docAccess.root');

    const rows = useMemo(() => {
        const children = new Map<string | null, SecurityFolder[]>();
        for (const folder of folders)
            children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder]);
        const custom = (folder: SecurityFolder) => folder.entries > 0 || !folder.inherit;
        const hasCustomBelow = (folder: SecurityFolder): boolean => custom(folder) || (children.get(folder.id) ?? []).some(hasCustomBelow);
        const out: { folder: SecurityFolder; depth: number }[] = [];
        const walk = (parent: string | null, depth: number) => {
            for (const folder of children.get(parent) ?? []) {
                if (onlyCustom && !hasCustomBelow(folder))
                    continue;
                out.push({ folder, depth });
                walk(folder.id, depth + 1);
            }
        };
        walk(null, 0);
        return out;
    }, [folders, onlyCustom]);

    if (folders.length === 0)
        return <div className="fm-sx-empty"><Icon name="folder" /><p>{tr('securityX.noFolders')}</p></div>;

    return (
        <div className={selected || selectedDoc ? 'fm-sx-folders has-drawer' : 'fm-sx-folders'}>
            <div className="fm-sx-folders__list">
                <div className="fm-sx-toolbar">
                    <p className="fm-sx-muted">{tr('securityX.foldersHint')}</p>
                    <label className="fm-sx-switch">
                        <input type="checkbox" checked={onlyCustom} onChange={(event) => setOnlyCustom(event.target.checked)} />
                        <span>{tr('securityX.onlyCustom')}</span>
                    </label>
                </div>
                <ul className="fm-sx-tree">
                    {rows.map(({ folder, depth }) => (
                        <li key={folder.id}>
                            <button type="button" className={selected === folder.id ? 'fm-sx-node is-on' : 'fm-sx-node'}
                                style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
                                onClick={() => {
                                    setSelectedDoc(null);
                                    setSelected(folder.id);
                                }}>
                                <Icon name="folder" className="fm-ico--folder" />
                                <span className="fm-sx-node__name">{folder.name}</span>
                                <span className="fm-sx-node__marks">
                                    {!folder.inherit ? <span className="fm-sx-tag is-break">{tr('securityX.noInherit')}</span> : null}
                                    {folder.deny ? <span className="fm-sx-tag is-deny-soft"><Icon name="shield" />{folder.deny}</span> : null}
                                    {folder.temporary ? <span className="fm-sx-tag is-temp"><Icon name="clock" />{folder.temporary}</span> : null}
                                    {folder.entries ? <span className="fm-sx-tag is-custom"><Icon name="user" />{folder.entries}</span> : null}
                                    <span className="fm-sx-node__docs">{tr('browser.filesCount', { n: folder.documents })}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                {specialDocs.length ? (
                    <section className="fm-sx-docs">
                        <h4><Icon name="key" />{tr('docAccess.docsTitle')}<em>{specialDocs.length}</em></h4>
                        <ul className="fm-sx-tree">
                            {specialDocs.map((doc) => (
                                <li key={doc.id}>
                                    <button type="button" className={selectedDoc === doc.id ? 'fm-sx-node is-on' : 'fm-sx-node'}
                                        onClick={() => {
                                            setSelected(null);
                                            setSelectedDoc(doc.id);
                                        }}>
                                        <FileBadge kind={fileKindOf(doc.name)} />
                                        <span className="fm-sx-node__name">
                                            {doc.name}
                                            <small>{folderName(doc.folderId)} · {doc.createdBy}</small>
                                        </span>
                                        <span className="fm-sx-node__marks">
                                            {doc.restricted ? <span className="fm-sx-tag is-deny-soft"><Icon name="lock" />{tr('docAccess.badgeRestricted')}</span> : null}
                                            {doc.deny ? <span className="fm-sx-tag is-deny-soft"><Icon name="shield" />{doc.deny}</span> : null}
                                            {doc.temporary ? <span className="fm-sx-tag is-temp"><Icon name="clock" />{doc.temporary}</span> : null}
                                            {doc.entries ? <span className="fm-sx-tag is-custom"><Icon name="user" />{doc.entries}</span> : null}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}
            </div>
            {selectedDoc ? (
                <DocumentAccessDrawer documentId={selectedDoc} onClose={() => setSelectedDoc(null)} onChanged={onReload} />
            ) : null}
            {selected ? (
                <FolderAccessDrawer
                    folderId={selected}
                    onClose={() => setSelected(null)}
                    onChanged={onReload}
                    onOpenFolder={onOpenFolder}
                    onShowFolder={(id) => setSelected(id)}
                />
            ) : null}
        </div>
    );
}

function JournalTab({ matterId }: { matterId: string }) {
    const { tr, locale } = useFm();
    const log = useLoad(() => filesApi.audit({ matterId, action: JOURNAL_ACTIONS, limit: 80 }), [matterId]);
    const items = log.data?.items ?? [];
    return (
        <StateBlock loading={log.loading && !log.data} error={log.error} onRetry={log.reload}
            empty={log.data && items.length === 0 ? <><Icon name="pulse" /><p>{tr('securityX.journalEmpty')}</p></> : undefined}>
            <ol className="fm-sx-journal">
                {items.map((row) => (
                    <li key={row.id} className={`is-${row.action}`}>
                        <span className="fm-sx-journal__dot" aria-hidden />
                        <div>
                            <p>
                                <strong>{row.userName}</strong>
                                {' · '}
                                <span>{tr(`audit.actions.${row.action}`)}</span>
                                {row.targetName ? <> · <em>{row.targetName}</em></> : null}
                            </p>
                            <small>
                                {formatDateTime(row.at, locale)}
                                {row.detail ? ` · ${row.detail}` : ''}
                            </small>
                        </div>
                    </li>
                ))}
            </ol>
        </StateBlock>
    );
}

export function SecurityWorkspace({ clients, matterId, onPickMatter, onOpenFolder, onOpenRequests }: {
    clients: ClientsResponse;
    matterId: string | null;
    onPickMatter: (matterId: string) => void;
    onOpenFolder: (matterId: string, folderId: string | null) => void;
    onOpenRequests: () => void;
}) {
    const { tr } = useFm();
    const [tab, setTab] = useState<Tab>('people');
    const overview = useLoad(() => filesApi.securityOverview(), []);
    const security = useLoad(matterId ? () => filesApi.security(matterId) : null, [matterId]);
    const data = security.data && security.data.matter.id === matterId ? security.data : null;
    const summaries = useMemo(() => overview.data?.matters ?? {}, [overview.data]);

    const items: MatterItem[] = useMemo(() => clients.clients.flatMap((client) => client.matters
        .filter((matter) => matter.level === 'manage')
        .map((matter) => ({ ...matter, clientName: client.name }))), [clients]);

    const totals = useMemo(() => {
        const out = { ...EMPTY_SUMMARY };
        for (const item of items) {
            const sum = summaries[item.id];
            if (!sum)
                continue;
            out.walls += sum.walls;
            out.temporary += sum.temporary + sum.suspended;
            out.folders += sum.folders + (sum.documents ?? 0);
            out.pending += sum.pending;
            out.rules += sum.rules + sum.folderRules;
        }
        return out;
    }, [items, summaries]);

    const kpi = useMemo(() => {
        if (!data)
            return null;
        const people = data.effective;
        return {
            access: people.filter((row) => (row.effective ?? row.level) !== 'deny' && (row.effective ?? row.level) !== 'none').length,
            rules: data.acl.length,
            walls: people.filter((row) => row.level === 'deny').length,
            temporary: people.filter(temporaryOf).length,
            folders: (data.folders ?? []).filter((folder) => folder.entries > 0 || !folder.inherit).length + (data.documents ?? []).length,
        };
    }, [data]);

    const reload = () => {
        security.reload();
        overview.reload();
    };

    const tabs: { id: Tab; label: string; icon: IconName }[] = [
        { id: 'people', label: tr('securityX.tabPeople'), icon: 'user' },
        { id: 'folders', label: tr('securityX.tabFolders'), icon: 'folder' },
        { id: 'journal', label: tr('securityX.tabJournal'), icon: 'pulse' },
    ];

    return (
        <section className="fm-sx">
            <MatterRail items={items} overview={summaries} matterId={matterId} onPick={(id) => {
                setTab('people');
                onPickMatter(id);
            }} />
            <div className="fm-sx-main">
                {!matterId ? (
                    <div className="fm-sx-welcome">
                        <span className="fm-sx-welcome__ico" aria-hidden><Icon name="shield" /></span>
                        <h2>{tr('securityX.welcomeTitle')}</h2>
                        <p>{tr('securityX.welcomeText')}</p>
                        <div className="fm-sx-kpis">
                            <Kpi icon="briefcase" label={tr('securityX.kpiMatters')} value={items.length} />
                            <Kpi icon="key" label={tr('securityX.kpiRules')} value={totals.rules} />
                            <Kpi icon="shield" label={tr('securityX.kpiWalls')} value={totals.walls} tone="deny" />
                            <Kpi icon="clock" label={tr('securityX.kpiTemporary')} value={totals.temporary} tone="temp" />
                            <Kpi icon="lock" label={tr('securityX.kpiFolders')} value={totals.folders} tone="folder" />
                        </div>
                        {totals.pending ? (
                            <button type="button" className="fm-sx-banner" onClick={onOpenRequests}>
                                <Icon name="inbox" />
                                <span>{tr('securityX.pendingAll', { n: totals.pending })}</span>
                                <Icon name="chevron" />
                            </button>
                        ) : null}
                        <div className="fm-sx-rules">
                            <p><Icon name="key" /><span>{tr('security.managersNote')}</span></p>
                            <p><Icon name="shield" /><span>{tr('security.wallNote')}</span></p>
                            <p><Icon name="user" /><span>{tr('securityX.ownNote')}</span></p>
                            <p><Icon name="clock" /><span>{tr('securityX.temporaryNote')}</span></p>
                        </div>
                    </div>
                ) : (
                    <StateBlock loading={security.loading && !data} error={security.error} onRetry={security.reload}>
                        {data && kpi ? (
                            <>
                                <header className="fm-sx-head">
                                    <div className="fm-sx-head__title">
                                        <small>{data.matter.clientName}</small>
                                        <h2>
                                            {data.matter.code ? <code>{data.matter.code}</code> : null}
                                            {data.matter.name}
                                        </h2>
                                        <span className={data.matter.closed ? 'fm-sx-status is-closed' : 'fm-sx-status'}>
                                            {data.matter.closed ? tr('securityX.closedMatter') : tr('securityX.openMatter')}
                                        </span>
                                    </div>
                                    <div className="fm-sx-head__actions">
                                        <button type="button" className="fm-btn" onClick={() => onOpenFolder(data.matter.id, null)}>
                                            <Icon name="folderOpen" />{tr('securityX.openMatterFiles')}
                                        </button>
                                        <button type="button" className="fm-btn" onClick={reload} aria-label={tr('browser.refresh')} title={tr('browser.refresh')}>
                                            <Icon name="refresh" />
                                        </button>
                                    </div>
                                </header>
                                <div className="fm-sx-kpis">
                                    <Kpi icon="user" label={tr('securityX.kpiAccess')} value={kpi.access} />
                                    <Kpi icon="key" label={tr('securityX.kpiExplicit')} value={kpi.rules} />
                                    <Kpi icon="shield" label={tr('securityX.kpiWalls')} value={kpi.walls} tone="deny" />
                                    <Kpi icon="clock" label={tr('securityX.kpiTemporary')} value={kpi.temporary} tone="temp" />
                                    <Kpi icon="lock" label={tr('securityX.kpiFolders')} value={kpi.folders} tone="folder" />
                                </div>
                                {data.pendingRequests ? (
                                    <button type="button" className="fm-sx-banner" onClick={onOpenRequests}>
                                        <Icon name="inbox" />
                                        <span>{tr('securityX.pendingMatter', { n: data.pendingRequests })}</span>
                                        <Icon name="chevron" />
                                    </button>
                                ) : null}
                                <nav className="fm-sx-tabs" role="tablist" aria-label={tr('security.title')}>
                                    {tabs.map((item) => (
                                        <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
                                            className={tab === item.id ? 'is-on' : undefined} onClick={() => setTab(item.id)}>
                                            <Icon name={item.icon} />{item.label}
                                            {item.id === 'people' ? <em>{data.effective.length}</em> : null}
                                            {item.id === 'folders' && kpi.folders ? <em>{kpi.folders}</em> : null}
                                        </button>
                                    ))}
                                </nav>
                                <div className="fm-sx-panel" role="tabpanel">
                                    {tab === 'people' ? <PeopleTab data={data} onReload={reload} /> : null}
                                    {tab === 'folders' ? (
                                        <FoldersTab data={data} onReload={reload}
                                            onOpenFolder={(folderId) => onOpenFolder(data.matter.id, folderId)} />
                                    ) : null}
                                    {tab === 'journal' ? <JournalTab matterId={data.matter.id} /> : null}
                                </div>
                            </>
                        ) : null}
                    </StateBlock>
                )}
            </div>
        </section>
    );
}
