import { useEffect, useMemo, useState } from 'react';
import { filesApi, type AuditRow, type ClientsResponse } from '../api/filesApi';
import { formatDateTime } from '../lib/filesFormat';
import { FmSelect } from './fmSelect';
import { Icon, StateBlock, saveBlob, useFm, useLoad, type IconName } from './fmShared';
import './AuditView.css';

const AUDIT_ACTIONS = [
    'upload', 'version', 'open', 'download', 'checkout', 'checkin', 'discard', 'rename', 'properties', 'move', 'delete',
    'restore', 'purge', 'folder_create', 'folder_rename', 'folder_move', 'folder_delete', 'provision', 'acl_set',
    'acl_remove', 'folder_acl_set', 'folder_acl_remove', 'folder_inherit', 'doc_acl_set', 'doc_acl_remove', 'doc_restrict', 'request_create', 'request_approve', 'request_reject', 'template_update', 'denied',
] as const;

type Group = 'files' | 'views' | 'edits' | 'removals' | 'access' | 'denied' | 'other';

const GROUPS: Record<Exclude<Group, 'other'>, string[]> = {
    files: ['upload', 'version', 'checkin'],
    views: ['open', 'download'],
    edits: ['checkout', 'discard', 'rename', 'properties', 'move', 'folder_create', 'folder_rename', 'folder_move'],
    removals: ['delete', 'restore', 'purge', 'folder_delete'],
    access: ['acl_set', 'acl_remove', 'folder_acl_set', 'folder_acl_remove', 'folder_inherit', 'doc_acl_set', 'doc_acl_remove', 'doc_restrict', 'request_create', 'request_approve', 'request_reject'],
    denied: ['denied'],
};

const GROUP_ICON: Record<Group, IconName> = {
    files: 'upload', views: 'eye', edits: 'edit', removals: 'trash', access: 'key', denied: 'shield', other: 'template',
};

const QUICK: Array<'all' | Exclude<Group, 'other'>> = ['all', 'files', 'views', 'edits', 'removals', 'access', 'denied'];

const PAGE = 100;

function groupOf(action: string): Group {
    for (const [group, actions] of Object.entries(GROUPS))
        if (actions.includes(action))
            return group as Group;
    return 'other';
}

function csvCell(value: string | number): string {
    const text = String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function hue(id: number): number {
    return (id * 47) % 6;
}

function dayKey(iso: string | null): string {
    if (!iso)
        return '';
    const date = new Date(iso);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function extension(name: string): string {
    const match = /\.([a-z0-9]{1,5})$/i.exec(name);
    return match ? match[1].toLowerCase() : '';
}

export function AuditView({ clients, initialMatterId, onOpenMatter, onOpenDocument }: {
    clients: ClientsResponse;
    initialMatterId: string | null;
    onOpenMatter: (matterId: string) => void;
    onOpenDocument: (matterId: string, documentId: string) => void;
}) {
    const { tr, locale } = useFm();
    const [matterId, setMatterId] = useState(initialMatterId ?? '');
    const [action, setAction] = useState('');
    const [quick, setQuick] = useState<(typeof QUICK)[number]>('all');
    const [person, setPerson] = useState<{ id: number; name: string } | null>(null);
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const [items, setItems] = useState<AuditRow[]>([]);
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQ(text);
            setOffset(0);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [text]);

    const actionParam = action || (quick === 'all' ? '' : GROUPS[quick].join(','));
    const load = useLoad(
        () => filesApi.audit({ matterId, action: actionParam, q, userId: person?.id, limit: PAGE, offset }),
        [matterId, actionParam, q, person?.id, offset],
    );

    useEffect(() => {
        if (!load.data)
            return;
        const page = load.data.items;
        setItems((prev) => (offset === 0 ? page : [...prev, ...page.filter((row) => !prev.some((old) => old.id === row.id))]));
    }, [load.data, offset]);

    const matters = useMemo(
        () => clients.clients.flatMap((client) => client.matters.map((matter) => ({ ...matter, clientName: client.name }))),
        [clients],
    );
    const total = load.data?.total ?? 0;
    const actionOptions = useMemo(() => [
        { value: '', label: tr('audit.anyAction') },
        ...AUDIT_ACTIONS.map((id) => ({ value: id, label: tr(`audit.actions.${id}`) })),
    ], [tr]);
    const matterOptions = useMemo(() => [
        { value: '', label: tr('search.anyMatter') },
        ...matters.map((matter) => ({
            value: matter.id,
            label: `${matter.clientName} · ${matter.code ? `${matter.code} · ` : ''}${matter.name}`,
        })),
    ], [matters, tr]);

    const days = useMemo(() => {
        const out: Array<{ key: string; at: string | null; rows: AuditRow[] }> = [];
        for (const row of items) {
            const key = dayKey(row.at);
            const last = out[out.length - 1];
            if (last && last.key === key)
                last.rows.push(row);
            else
                out.push({ key, at: row.at, rows: [row] });
        }
        return out;
    }, [items]);

    const dayTitle = (iso: string | null): string => {
        if (!iso)
            return '—';
        const date = new Date(iso);
        const today = new Date();
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        if (dayKey(iso) === dayKey(today.toISOString()))
            return tr('auditX.today');
        if (dayKey(iso) === dayKey(yesterday.toISOString()))
            return tr('auditX.yesterday');
        return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
    };
    const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '');

    const reset = (fn: () => void) => {
        fn();
        setOffset(0);
    };
    const filtered = Boolean(matterId || action || quick !== 'all' || person || q);

    const exportCsv = async () => {
        const header = [tr('audit.when'), tr('common.user'), tr('audit.action'), tr('common.matter'), tr('audit.target'), tr('audit.detail')];
        const rows = items.map((row) => [
            formatDateTime(row.at, locale), row.userName, tr(`audit.actions.${row.action}`), row.matterName, row.targetName, row.detail,
        ]);
        const body = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
        await saveBlob(new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' }), `file-manager-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    return (
        <section className="fm-au">
            <div className="fm-au__filters">
                <label className="fm-au__search">
                    <Icon name="search" />
                    <input type="search" value={text} placeholder={tr('audit.search')} aria-label={tr('audit.search')}
                        onChange={(event) => setText(event.target.value)} />
                </label>
                <FmSelect value={action} options={actionOptions} placeholder={tr('audit.action')}
                    onChange={(next) => reset(() => setAction(next))} />
                <FmSelect value={matterId} options={matterOptions} placeholder={tr('common.matter')}
                    onChange={(next) => reset(() => setMatterId(next))} />
                <button type="button" className="fm-btn" disabled={items.length === 0} onClick={exportCsv}>
                    <Icon name="download" />{tr('audit.export')}
                </button>
            </div>

            <div className="fm-au__bar">
                <div className="fm-au__quick" role="tablist">
                    {QUICK.map((id) => (
                        <button key={id} type="button" role="tab" aria-selected={!action && quick === id}
                            className={`fm-au__chip fm-au__chip--${id}${!action && quick === id ? ' is-on' : ''}`}
                            onClick={() => reset(() => {
                                setAction('');
                                setQuick(id);
                            })}>
                            {id !== 'all' ? <Icon name={GROUP_ICON[id]} /> : null}
                            {tr(`auditX.groups.${id}`)}
                        </button>
                    ))}
                </div>
                <div className="fm-au__summary">
                    {person ? (
                        <button type="button" className="fm-au__pill" onClick={() => reset(() => setPerson(null))}
                            aria-label={tr('auditX.clearPerson')}>
                            <Icon name="user" />{person.name}<Icon name="close" />
                        </button>
                    ) : null}
                    <span>{tr('audit.total', { count: total })}</span>
                    {filtered ? (
                        <button type="button" className="fm-au__reset" onClick={() => {
                            setText('');
                            setQ('');
                            reset(() => {
                                setMatterId('');
                                setAction('');
                                setQuick('all');
                                setPerson(null);
                            });
                        }}>{tr('auditX.reset')}</button>
                    ) : null}
                </div>
            </div>

            <StateBlock loading={load.loading && items.length === 0} error={load.error} onRetry={load.reload}>
                {items.length ? (
                    <div className="fm-au__feed">
                        {days.map((day) => (
                            <section key={day.key} className="fm-au-day">
                                <h3 className="fm-au-day__title">
                                    <span>{dayTitle(day.at)}</span>
                                    <em>{tr('auditX.dayCount', { n: day.rows.length })}</em>
                                </h3>
                                <ol className="fm-au-day__list">
                                    {day.rows.map((row) => {
                                        const group = groupOf(row.action);
                                        const ext = extension(row.targetName);
                                        const canOpenDoc = row.targetKind === 'document' && Boolean(row.targetId && row.matterId) && row.action !== 'purge';
                                        return (
                                            <li key={row.id} className={`fm-au-ev fm-au-ev--${group}`}>
                                                <time className="fm-au-ev__time" dateTime={row.at ?? undefined} title={formatDateTime(row.at, locale)}>{timeOf(row.at)}</time>
                                                <span className="fm-au-ev__mark" aria-hidden><Icon name={GROUP_ICON[group]} /></span>
                                                <div className="fm-au-ev__body">
                                                    <div className="fm-au-ev__line">
                                                        <button type="button" className="fm-au-ev__who" title={tr('auditX.onlyPerson')}
                                                            onClick={() => reset(() => setPerson({ id: row.userId, name: row.userName }))}>
                                                            <span className={`fm-au-ev__avatar fm-au-ev__avatar--${hue(row.userId)}`} aria-hidden>{initials(row.userName)}</span>
                                                            {row.userName || `#${row.userId}`}
                                                        </button>
                                                        <span className="fm-au-ev__action">{tr(`audit.actions.${row.action}`)}</span>
                                                    </div>
                                                    {row.targetName ? (
                                                        canOpenDoc ? (
                                                            <button type="button" className="fm-au-ev__target is-link" onClick={() => onOpenDocument(row.matterId, row.targetId)}>
                                                                {ext ? <span className="fm-au-ev__ext">{ext}</span> : null}
                                                                <span>{row.targetName}</span>
                                                            </button>
                                                        ) : (
                                                            <span className="fm-au-ev__target">
                                                                {ext ? <span className="fm-au-ev__ext">{ext}</span> : null}
                                                                <span>{row.targetName}</span>
                                                            </span>
                                                        )
                                                    ) : null}
                                                    <div className="fm-au-ev__meta">
                                                        {row.matterName ? (
                                                            <button type="button" className="fm-au-ev__matter" onClick={() => onOpenMatter(row.matterId)}>
                                                                <Icon name="briefcase" />{row.matterName}
                                                            </button>
                                                        ) : null}
                                                        {row.detail ? <span className="fm-au-ev__detail">{row.detail}</span> : null}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        ))}
                    </div>
                ) : load.data ? (
                    <div className="fm-au__empty"><Icon name="list" /><p>{filtered ? tr('auditX.nothing') : tr('common.empty')}</p></div>
                ) : null}
                {items.length < total ? (
                    <button type="button" className="fm-btn fm-au__more" disabled={load.loading} onClick={() => setOffset(items.length)}>
                        {load.loading ? tr('common.loading') : tr('auditX.more', { n: Math.min(PAGE, total - items.length), total: total - items.length })}
                    </button>
                ) : null}
            </StateBlock>
        </section>
    );
}
