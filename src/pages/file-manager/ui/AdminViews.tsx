import { useEffect, useMemo, useState } from 'react';
import { filesApi, type AddinClient, type AuditRow, type ClientsResponse } from '../api/filesApi';
import { formatBytes, formatDateTime, parseTemplate } from '../lib/filesFormat';
import { FmSelect } from './fmSelect';
import { Icon, StateBlock, saveBlob, useAction, useFm, useLoad } from './fmShared';

const AUDIT_ACTIONS = [
    'upload', 'version', 'open', 'download', 'checkout', 'checkin', 'discard', 'rename', 'properties', 'move', 'delete',
    'restore', 'purge', 'folder_create', 'folder_rename', 'folder_move', 'folder_delete', 'provision', 'acl_set',
    'acl_remove', 'folder_acl_set', 'folder_acl_remove', 'folder_inherit', 'doc_acl_set', 'doc_acl_remove', 'doc_restrict', 'request_create', 'request_approve', 'request_reject', 'template_update', 'denied',
] as const;

const PAGE = 100;

function csvCell(value: string | number): string {
    const text = String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function AuditView({ clients, initialMatterId }: { clients: ClientsResponse; initialMatterId: string | null }) {
    const { tr, locale } = useFm();
    const [matterId, setMatterId] = useState(initialMatterId ?? '');
    const [action, setAction] = useState('');
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

    const load = useLoad(() => filesApi.audit({ matterId, action, q, limit: PAGE, offset }), [matterId, action, q, offset]);

    useEffect(() => {
        if (!load.data)
            return;
        const page = load.data.items;
        setItems((prev) => (offset === 0 ? page : [...prev, ...page.filter((row) => !prev.some((old) => old.id === row.id))]));
    }, [load.data, offset]);

    const matters = clients.clients.flatMap((client) => client.matters.map((matter) => ({ ...matter, clientName: client.name })));
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

    const exportCsv = async () => {
        const header = [tr('audit.when'), tr('common.user'), tr('audit.action'), tr('common.matter'), tr('audit.target'), tr('audit.detail')];
        const rows = items.map((row) => [
            formatDateTime(row.at, locale), row.userName, tr(`audit.actions.${row.action}`), row.matterName, row.targetName, row.detail,
        ]);
        const body = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
        await saveBlob(new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' }), `file-manager-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    return (
        <section className="fm-docs fm-docs--padded">
            <div className="fm-toolbar">
                <label className="fm-search fm-search--wide">
                    <Icon name="search" />
                    <input value={text} placeholder={tr('audit.search')} onChange={(event) => setText(event.target.value)} />
                </label>
                <FmSelect
                    value={action}
                    options={actionOptions}
                    placeholder={tr('audit.action')}
                    onChange={(next) => {
                        setAction(next);
                        setOffset(0);
                    }}
                />
                <FmSelect
                    value={matterId}
                    options={matterOptions}
                    placeholder={tr('common.matter')}
                    onChange={(next) => {
                        setMatterId(next);
                        setOffset(0);
                    }}
                />
                <span className="fm-muted">{tr('audit.total', { count: total })}</span>
                <button type="button" className="fm-btn" disabled={items.length === 0} onClick={exportCsv}><Icon name="download" />{tr('audit.export')}</button>
            </div>
            <StateBlock loading={load.loading && items.length === 0} error={load.error} onRetry={load.reload}
                empty={load.data && items.length === 0 ? tr('common.empty') : undefined}>
                <div className="fm-table-wrap">
                    <table className="fm-table fm-table--audit">
                        <thead>
                            <tr>
                                <th>{tr('audit.when')}</th>
                                <th>{tr('common.user')}</th>
                                <th>{tr('audit.action')}</th>
                                <th>{tr('common.matter')}</th>
                                <th>{tr('audit.target')}</th>
                                <th>{tr('audit.detail')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((row) => (
                                <tr key={row.id} className={row.action === 'denied' ? 'is-denied' : undefined}>
                                    <td className="fm-nowrap">{formatDateTime(row.at, locale)}</td>
                                    <td>{row.userName}</td>
                                    <td><span className={`fm-action fm-dot--${row.action}`}>{tr(`audit.actions.${row.action}`)}</span></td>
                                    <td>{row.matterName || '—'}</td>
                                    <td>{row.targetName || '—'}</td>
                                    <td className="fm-muted">{row.detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {items.length < total ? (
                    <button type="button" className="fm-btn fm-more" disabled={load.loading} onClick={() => setOffset(items.length)}>
                        {load.loading ? tr('common.loading') : tr('audit.more')}
                    </button>
                ) : null}
            </StateBlock>
        </section>
    );
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'alert' }) {
    return (
        <div className={tone ? `fm-stat fm-stat--${tone}` : 'fm-stat'}>
            <span>{label}</span>
            <strong>{value}</strong>
            {sub ? <small>{sub}</small> : null}
        </div>
    );
}

export function MonitoringView({ onOpenAudit }: { onOpenAudit: () => void }) {
    const { tr, locale } = useFm();
    const stats = useLoad(() => filesApi.stats(), []);
    const data = stats.data;
    return (
        <section className="fm-docs fm-docs--padded">
            <StateBlock loading={stats.loading && !data} error={stats.error} onRetry={stats.reload}>
                {data ? (
                    <>
                        <div className="fm-stats">
                            <Stat label={tr('monitoring.documents')} value={data.documents} />
                            <Stat label={tr('monitoring.storage')} value={formatBytes(data.storedBytes, locale)} sub={`${data.versions} ${tr('monitoring.versions')}`} />
                            <Stat label={tr('monitoring.uploadsWeek')} value={data.uploadsWeek} />
                            <Stat label={tr('monitoring.downloadsDay')} value={data.downloadsDay} />
                            <Stat label={tr('monitoring.deniedDay')} value={data.deniedDay} tone={data.deniedDay ? 'alert' : undefined} />
                            <Stat label={tr('monitoring.checkedOut')} value={data.checkedOut} />
                            <Stat label={tr('monitoring.inTrash')} value={data.inTrash} />
                            <Stat label={tr('monitoring.pending')} value={data.pendingRequests} tone={data.pendingRequests ? 'alert' : undefined} />
                        </div>
                        <div className="fm-panels">
                            <div className="fm-panel">
                                <h3>{tr('monitoring.activeUsers')}</h3>
                                {data.activeUsers.length ? (
                                    <ol>{data.activeUsers.map((row) => <li key={row.userId}><span>{row.name}</span><em>{row.events} {tr('monitoring.events')}</em></li>)}</ol>
                                ) : <p className="fm-muted">{tr('monitoring.noData')}</p>}
                            </div>
                            <div className="fm-panel">
                                <h3>{tr('monitoring.activeMatters')}</h3>
                                {data.activeMatters.length ? (
                                    <ol>{data.activeMatters.map((row) => <li key={row.matterId}><span>{row.name}</span><em>{row.events} {tr('monitoring.events')}</em></li>)}</ol>
                                ) : <p className="fm-muted">{tr('monitoring.noData')}</p>}
                            </div>
                            <div className="fm-panel">
                                <h3>{tr('monitoring.topDownloaders')}</h3>
                                {data.topDownloaders.length ? (
                                    <ol>{data.topDownloaders.map((row) => <li key={row.userId}><span>{row.name}</span><em>{row.downloads} {tr('monitoring.downloads')}</em></li>)}</ol>
                                ) : <p className="fm-muted">{tr('monitoring.noData')}</p>}
                            </div>
                            <div className="fm-panel fm-panel--alert">
                                <h3>
                                    {tr('monitoring.recentDenied')}
                                    <button type="button" className="fm-link" onClick={onOpenAudit}>{tr('nav.audit')}</button>
                                </h3>
                                {data.recentDenied.length ? (
                                    <ul>
                                        {data.recentDenied.map((row) => (
                                            <li key={row.id}>
                                                <span>{row.userName} → {row.matterName || row.targetName}</span>
                                                <em>{formatDateTime(row.at, locale)}</em>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="fm-muted">{tr('monitoring.noData')}</p>}
                            </div>
                        </div>
                    </>
                ) : null}
            </StateBlock>
        </section>
    );
}

type AddinFilter = 'all' | 'online' | 'problems';

const SSO_PROBLEMS = new Set<AddinClient['ssoStatus']>(['failed', 'unsupported', 'consent']);

export function AddinClientsView() {
    const { tr, locale } = useFm();
    const load = useLoad(() => filesApi.addinClients(30), []);
    const [filter, setFilter] = useState<AddinFilter>('all');
    const reload = load.reload;
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!document.hidden)
                reload();
        }, 60_000);
        return () => window.clearInterval(timer);
    }, [reload]);
    const data = load.data;
    const rows = useMemo(() => (data?.clients ?? []).filter((row) => (
        filter === 'online' ? row.online : filter === 'problems' ? SSO_PROBLEMS.has(row.ssoStatus) : true
    )), [data, filter]);
    const filters: { id: AddinFilter; label: string }[] = [
        { id: 'all', label: tr('addin.filterAll') },
        { id: 'online', label: tr('addin.filterOnline') },
        { id: 'problems', label: tr('addin.filterProblems') },
    ];
    return (
        <section className="fm-docs fm-docs--padded">
            <p className="fm-muted fm-addin__hint">{tr('addin.hint')}</p>
            <StateBlock loading={load.loading && !data} error={load.error} onRetry={load.reload}>
                {data ? (
                    <>
                        <div className="fm-stats">
                            <Stat label={tr('addin.online')} value={data.summary.online} />
                            <Stat label={tr('addin.onlineUsers')} value={data.summary.onlineUsers} />
                            <Stat label={tr('addin.installs')} value={data.summary.installs} />
                            <Stat label={tr('addin.problems')} value={data.summary.ssoProblems} tone={data.summary.ssoProblems ? 'alert' : undefined} />
                        </div>
                        <div className="fm-addin__filters" role="tablist">
                            {filters.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={filter === item.id}
                                    className={`fm-addin__filter${filter === item.id ? ' is-on' : ''}`}
                                    onClick={() => setFilter(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        {rows.length ? (
                            <div className="fm-table-wrap">
                                <table className="fm-table fm-table--addin">
                                    <thead>
                                        <tr>
                                            <th>{tr('addin.user')}</th>
                                            <th>{tr('addin.app')}</th>
                                            <th>{tr('addin.version')}</th>
                                            <th>{tr('addin.signIn')}</th>
                                            <th>{tr('addin.lastSeen')}</th>
                                            <th>{tr('addin.ip')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            const problem = SSO_PROBLEMS.has(row.ssoStatus);
                                            const platform = tr(`addin.platforms.${row.platform}`);
                                            return (
                                                <tr key={row.clientId} className={problem ? 'is-denied' : undefined}>
                                                    <td data-label={tr('addin.user')}>
                                                        <span className="fm-addin__user">
                                                            <i className={`fm-addin__dot${row.online ? ' is-online' : ''}`} aria-hidden />
                                                            {row.userName || `#${row.userId}`}
                                                        </span>
                                                    </td>
                                                    <td data-label={tr('addin.app')}>
                                                        {tr(`addin.hosts.${row.host}`)}
                                                        {platform ? <span className="fm-muted"> · {platform}</span> : null}
                                                    </td>
                                                    <td data-label={tr('addin.version')} className="fm-nowrap">
                                                        {row.addinVersion || '—'}
                                                        {row.officeVersion ? <small className="fm-muted fm-addin__sub">Office {row.officeVersion}</small> : null}
                                                    </td>
                                                    <td data-label={tr('addin.signIn')}>
                                                        {tr(`addin.methods.${row.authMethod}`)}
                                                        {problem ? (
                                                            <small className="fm-addin__sub fm-addin__sso" title={row.ssoError || undefined}>
                                                                {tr(`addin.sso.${row.ssoStatus}`)}{row.ssoError ? `: ${row.ssoError}` : ''}
                                                            </small>
                                                        ) : null}
                                                    </td>
                                                    <td data-label={tr('addin.lastSeen')} className="fm-nowrap">
                                                        {row.online ? <strong className="fm-addin__now">{tr('addin.now')}</strong> : formatDateTime(row.lastSeen, locale)}
                                                    </td>
                                                    <td data-label={tr('addin.ip')} className="fm-muted fm-nowrap">{row.ip || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="fm-muted">{tr('addin.empty')}</p>}
                    </>
                ) : null}
            </StateBlock>
        </section>
    );
}

export function TemplateView() {
    const { tr } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.template(), []);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (load.data)
            setText(load.data.folders.join('\n'));
    }, [load.data]);

    const folders = parseTemplate(text);
    const canEdit = load.data?.canEdit ?? false;

    return (
        <section className="fm-docs fm-docs--padded">
            <p className="fm-hint">{tr('template.hint')}</p>
            <StateBlock loading={load.loading && !load.data} error={load.error} onRetry={load.reload}>
                <div className="fm-template">
                    <textarea rows={14} value={text} disabled={!canEdit || busy} placeholder={tr('template.placeholder')}
                        onChange={(event) => setText(event.target.value)} />
                    <div className="fm-template__preview">
                        <ul>
                            {folders.map((path) => {
                                const parts = path.split('/');
                                return (
                                    <li key={path} style={{ paddingLeft: `${(parts.length - 1) * 1.1}rem` }}>
                                        <Icon name="folder" className="fm-ico--folder" />{parts[parts.length - 1]}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
                {canEdit ? (
                    <div className="fm-toolbar">
                        <button type="button" className="fm-btn fm-btn--primary" disabled={busy} onClick={async () => {
                            setBusy(true);
                            const result = await act(() => filesApi.saveTemplate(folders), tr('template.saved'));
                            setBusy(false);
                            if (result)
                                setText(result.folders.join('\n'));
                        }}>{tr('common.save')}</button>
                        <button type="button" className="fm-btn" disabled={busy} onClick={async () => {
                            setBusy(true);
                            const result = await act(() => filesApi.resetTemplate(), tr('template.saved'));
                            setBusy(false);
                            if (result)
                                setText(result.folders.join('\n'));
                        }}>{tr('template.reset')}</button>
                    </div>
                ) : <p className="fm-muted">{tr('template.readOnly')}</p>}
            </StateBlock>
        </section>
    );
}
