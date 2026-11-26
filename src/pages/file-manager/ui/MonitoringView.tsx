import { useMemo, useState } from 'react';
import { filesApi, type StatsResponse } from '../api/filesApi';
import { formatBytes, formatDateTime } from '../lib/filesFormat';
import { Icon, StateBlock, useFm, useLoad, type IconName } from './fmShared';
import { DeletedFilesCard } from './DeletedFilesCard';
import './MonitoringView.css';

type Tone = 'accent' | 'ok' | 'warn' | 'alert' | 'muted';

type Props = {
    onOpenAudit: () => void;
    onOpenRequests: () => void;
    onOpenTrash: () => void;
    onOpenMatter: (matterId: string) => void;
};

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function Kpi({ icon, label, value, sub, tone, onClick }: {
    icon: IconName;
    label: string;
    value: string | number;
    sub?: string;
    tone: Tone;
    onClick?: () => void;
}) {
    const body = (
        <>
            <span className="fm-mon-kpi__ico" aria-hidden><Icon name={icon} /></span>
            <span className="fm-mon-kpi__text">
                <small>{label}</small>
                <strong>{value}</strong>
                {sub ? <em>{sub}</em> : null}
            </span>
            {onClick ? <Icon name="chevron" className="fm-mon-kpi__go" /> : null}
        </>
    );
    return onClick
        ? <button type="button" className={`fm-mon-kpi is-${tone} is-link`} onClick={onClick}>{body}</button>
        : <div className={`fm-mon-kpi is-${tone}`}>{body}</div>;
}

function Ranked({ title, icon, rows, empty, emptyIcon, person, onPick }: {
    title: string;
    icon: IconName;
    rows: Array<{ id: string; name: string; value: number; label: string }>;
    empty: string;
    emptyIcon: IconName;
    person?: boolean;
    onPick?: (id: string) => void;
}) {
    const max = Math.max(1, ...rows.map((row) => row.value));
    return (
        <section className="fm-mon-card">
            <h3><span className="fm-mon-card__ico" aria-hidden><Icon name={icon} /></span>{title}</h3>
            {rows.length === 0 ? (
                <div className="fm-mon-empty"><Icon name={emptyIcon} /><p>{empty}</p></div>
            ) : (
                <ol className="fm-mon-rank">
                    {rows.map((row, index) => {
                        const content = (
                            <>
                                <span className={`fm-mon-rank__place${index < 3 ? ` is-top${index + 1}` : ''}`}>{index + 1}</span>
                                {person ? <span className={`fm-mon-rank__avatar fm-mon-rank__avatar--${index % 6}`} aria-hidden>{initials(row.name)}</span> : null}
                                <span className="fm-mon-rank__main">
                                    <span className="fm-mon-rank__line">
                                        <strong title={row.name}>{row.name}</strong>
                                        <em>{row.label}</em>
                                    </span>
                                    <span className="fm-mon-rank__bar" aria-hidden>
                                        <i style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
                                    </span>
                                </span>
                            </>
                        );
                        return (
                            <li key={row.id}>
                                {onPick ? (
                                    <button type="button" className="fm-mon-rank__row is-link" onClick={() => onPick(row.id)}>{content}</button>
                                ) : <div className="fm-mon-rank__row">{content}</div>}
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

export function MonitoringView({ onOpenAudit, onOpenRequests, onOpenTrash, onOpenMatter }: Props) {
    const { tr, locale } = useFm();
    const stats = useLoad(() => filesApi.stats(), []);
    const [loadedAt, setLoadedAt] = useState<Date | null>(null);
    const [shownFor, setShownFor] = useState<StatsResponse | null>(null);
    const data = stats.data;
    if (data && data !== shownFor) {
        setShownFor(data);
        setLoadedAt(new Date());
    }

    const plural = useMemo(() => new Intl.PluralRules(locale.startsWith('ru') ? 'ru' : 'en'), [locale]);
    const count = (n: number, key: 'events' | 'downloads') => `${n} ${tr(`monitoringX.${key}.${plural.select(n)}`)}`;

    return (
        <section className="fm-mon">
            <StateBlock loading={stats.loading && !data} error={stats.error} onRetry={stats.reload}>
                {data ? (
                    <>
                        <div className="fm-mon__bar">
                            <p>
                                {tr('monitoringX.subtitle')}
                                {loadedAt ? <span> · {tr('monitoringX.updated', { time: loadedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span> : null}
                            </p>
                            <button type="button" className="fm-btn" disabled={stats.loading} onClick={stats.reload}>
                                <Icon name="refresh" />{tr('browser.refresh')}
                            </button>
                        </div>

                        {data.deniedDay || data.pendingRequests ? (
                            <div className="fm-mon__alerts">
                                {data.deniedDay ? (
                                    <button type="button" className="fm-mon-alert is-alert" onClick={onOpenAudit}>
                                        <Icon name="shield" />
                                        <span>{tr('monitoringX.alertDenied', { n: data.deniedDay })}</span>
                                        <Icon name="chevron" />
                                    </button>
                                ) : null}
                                {data.pendingRequests ? (
                                    <button type="button" className="fm-mon-alert is-warn" onClick={onOpenRequests}>
                                        <Icon name="inbox" />
                                        <span>{tr('monitoringX.alertPending', { n: data.pendingRequests })}</span>
                                        <Icon name="chevron" />
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="fm-mon__kpis">
                            <Kpi icon="folder" tone="accent" label={tr('monitoring.documents')} value={data.documents.toLocaleString(locale)} />
                            <Kpi icon="pulse" tone="accent" label={tr('monitoring.storage')} value={formatBytes(data.storedBytes, locale)}
                                sub={`${data.versions} ${tr('monitoring.versions')}${data.trashBytes ? ` · ${tr('deletedX.inTrash', { size: formatBytes(data.trashBytes, locale) })}` : ''}`} />
                            <Kpi icon="upload" tone="ok" label={tr('monitoring.uploadsWeek')} value={data.uploadsWeek} />
                            <Kpi icon="download" tone="ok" label={tr('monitoring.downloadsDay')} value={data.downloadsDay} />
                            <Kpi icon="shield" tone={data.deniedDay ? 'alert' : 'muted'} label={tr('monitoring.deniedDay')} value={data.deniedDay}
                                onClick={onOpenAudit} />
                            <Kpi icon="lock" tone={data.checkedOut ? 'warn' : 'muted'} label={tr('monitoring.checkedOut')} value={data.checkedOut} />
                            <Kpi icon="trash" tone="muted" label={tr('monitoring.inTrash')} value={data.inTrash} onClick={onOpenTrash} />
                            <Kpi icon="inbox" tone={data.pendingRequests ? 'warn' : 'muted'} label={tr('monitoring.pending')} value={data.pendingRequests}
                                onClick={onOpenRequests} />
                        </div>

                        <div className="fm-mon__grid">
                            <Ranked
                                title={tr('monitoring.activeUsers')}
                                icon="user"
                                person
                                empty={tr('monitoringX.emptyActivity')}
                                emptyIcon="user"
                                rows={data.activeUsers.map((row) => ({ id: String(row.userId), name: row.name, value: row.events, label: count(row.events, 'events') }))}
                            />
                            <Ranked
                                title={tr('monitoring.activeMatters')}
                                icon="briefcase"
                                empty={tr('monitoringX.emptyActivity')}
                                emptyIcon="briefcase"
                                onPick={onOpenMatter}
                                rows={data.activeMatters.map((row) => ({ id: row.matterId, name: row.name, value: row.events, label: count(row.events, 'events') }))}
                            />
                            <Ranked
                                title={tr('monitoring.topDownloaders')}
                                icon="download"
                                person
                                empty={tr('monitoringX.emptyDownloads')}
                                emptyIcon="download"
                                rows={data.topDownloaders.map((row) => ({ id: String(row.userId), name: row.name, value: row.downloads, label: count(row.downloads, 'downloads') }))}
                            />
                            <section className={data.recentDenied.length ? 'fm-mon-card is-alert' : 'fm-mon-card'}>
                                <h3>
                                    <span className="fm-mon-card__ico" aria-hidden><Icon name="shield" /></span>
                                    {tr('monitoring.recentDenied')}
                                    <button type="button" className="fm-mon-card__link" onClick={onOpenAudit}>{tr('nav.audit')} →</button>
                                </h3>
                                {data.recentDenied.length ? (
                                    <ul className="fm-mon-denied">
                                        {data.recentDenied.map((row) => (
                                            <li key={row.id}>
                                                <span className="fm-mon-denied__dot" aria-hidden />
                                                <span className="fm-mon-denied__text">
                                                    <strong>{row.userName}</strong>
                                                    <span>{row.matterName || row.targetName}</span>
                                                </span>
                                                <time>{formatDateTime(row.at, locale)}</time>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="fm-mon-empty is-ok"><Icon name="check" /><p>{tr('monitoringX.emptyDenied')}</p></div>
                                )}
                            </section>
                        </div>
                        <DeletedFilesCard onChanged={stats.reload} onOpenMatter={onOpenMatter} />
                    </>
                ) : null}
            </StateBlock>
        </section>
    );
}
