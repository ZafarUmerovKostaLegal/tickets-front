import { useEffect, useMemo, useState } from 'react';
import { filesApi, type AuditRow, type ClientsResponse } from '../api/filesApi';
import { formatBytes, formatDateTime, parseTemplate } from '../lib/filesFormat';
import { FmSelect } from './fmSelect';
import { Icon, StateBlock, saveBlob, useAction, useFm, useLoad } from './fmShared';

const AUDIT_ACTIONS = [
    'upload', 'version', 'open', 'download', 'checkout', 'checkin', 'discard', 'rename', 'properties', 'move', 'delete',
    'restore', 'purge', 'folder_create', 'folder_rename', 'folder_move', 'folder_delete', 'provision', 'acl_set',
    'acl_remove', 'request_create', 'request_approve', 'request_reject', 'template_update', 'denied',
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
