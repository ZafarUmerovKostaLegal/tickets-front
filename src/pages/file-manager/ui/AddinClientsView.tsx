import { useEffect, useMemo, useState } from 'react';
import { filesApi, type AddinClient, type AddinSigninFailure } from '../api/filesApi';
import { formatDateTime } from '../lib/filesFormat';
import { Icon, StateBlock, useFm, useLoad } from './fmShared';
import { Kpi } from './MonitoringView';
import './MonitoringView.css';
import './AddinClientsView.css';

type Filter = 'all' | 'online' | 'problems' | 'outdated';

const SSO_PROBLEMS = new Set<AddinClient['ssoStatus']>(['failed', 'unsupported', 'consent']);
const HOSTS: AddinClient['host'][] = ['outlook', 'word', 'excel', 'powerpoint'];
const PLATFORMS: AddinClient['platform'][] = ['windows', 'mac', 'web', 'ios', 'android'];
const HOST_MARK: Record<AddinClient['host'], string> = { outlook: 'O', word: 'W', excel: 'X', powerpoint: 'P', unknown: '·' };

type Person = {
    userId: number;
    name: string;
    online: boolean;
    lastSeen: string | null;
    installs: AddinClient[];
    problem: boolean;
    outdated: boolean;
};

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function versionParts(value: string): number[] {
    return value.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a: string, b: string): number {
    const left = versionParts(a);
    const right = versionParts(b);
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const diff = (left[index] ?? 0) - (right[index] ?? 0);
        if (diff)
            return diff;
    }
    return 0;
}

function useRelative(locale: string) {
    return useMemo(() => {
        const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        return (iso: string | null): string => {
            if (!iso)
                return '—';
            const minutes = Math.round((Date.parse(iso) - Date.now()) / 60000);
            if (Math.abs(minutes) < 60)
                return format.format(minutes, 'minute');
            const hours = Math.round(minutes / 60);
            if (Math.abs(hours) < 24)
                return format.format(hours, 'hour');
            return format.format(Math.round(hours / 24), 'day');
        };
    }, [locale]);
}

export function AddinClientsView() {
    const { tr, locale } = useFm();
    const load = useLoad(() => filesApi.addinClients(30), []);
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const relative = useRelative(locale);
    const reload = load.reload;
    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!document.hidden)
                reload();
        }, 60_000);
        return () => window.clearInterval(timer);
    }, [reload]);

    const data = load.data;
    const clients = useMemo(() => data?.clients ?? [], [data]);
    const failures = data?.failures ?? [];
    const latest = useMemo(
        () => clients.map((row) => row.addinVersion).filter(Boolean).sort(compareVersions).pop() ?? '',
        [clients],
    );

    const people = useMemo(() => {
        const map = new Map<number, Person>();
        for (const row of clients) {
            const person = map.get(row.userId) ?? {
                userId: row.userId, name: row.userName || `#${row.userId}`, online: false, lastSeen: null, installs: [], problem: false, outdated: false,
            };
            person.installs.push(row);
            person.online ||= row.online;
            person.problem ||= SSO_PROBLEMS.has(row.ssoStatus);
            person.outdated ||= Boolean(latest && row.addinVersion && compareVersions(row.addinVersion, latest) < 0);
            if (!person.lastSeen || (row.lastSeen && row.lastSeen > person.lastSeen))
                person.lastSeen = row.lastSeen;
            map.set(row.userId, person);
        }
        return [...map.values()].sort((a, b) => Number(b.online) - Number(a.online) || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
    }, [clients, latest]);

    const needle = query.trim().toLowerCase();
    const visible = people.filter((person) => (
        (filter === 'online' ? person.online : filter === 'problems' ? person.problem : filter === 'outdated' ? person.outdated : true)
        && (!needle || person.name.toLowerCase().includes(needle))
    ));
    const counts: Record<Filter, number> = {
        all: people.length,
        online: people.filter((person) => person.online).length,
        problems: people.filter((person) => person.problem).length,
        outdated: people.filter((person) => person.outdated).length,
    };
    const hostCounts = HOSTS.map((host) => ({ host, n: clients.filter((row) => row.host === host).length }));
    const platformCounts = PLATFORMS.map((platform) => ({ platform, n: clients.filter((row) => row.platform === platform).length })).filter((item) => item.n);
    const maxHost = Math.max(1, ...hostCounts.map((item) => item.n));

    return (
        <section className="fm-mon fm-kf">
            <StateBlock loading={load.loading && !data} error={load.error} onRetry={load.reload}>
                {data ? (
                    <>
                        <div className="fm-mon__bar">
                            <p>{tr('addin.hint')}</p>
                            <button type="button" className="fm-btn" disabled={load.loading} onClick={load.reload}>
                                <Icon name="refresh" />{tr('addinX.refresh')}
                            </button>
                        </div>

                        {failures.length ? (
                            <div className="fm-mon__alerts">
                                <a className="fm-mon-alert is-alert" href="#fm-kf-failures">
                                    <Icon name="shield" />
                                    <span>{tr('addinX.alertFailures', { n: data.summary.signinFailures })}</span>
                                </a>
                            </div>
                        ) : null}

                        <div className="fm-mon__kpis">
                            <Kpi icon="pulse" tone="ok" label={tr('addin.online')} value={data.summary.online}
                                sub={tr('addinX.onlineSub', { n: data.summary.onlineUsers })} onClick={() => setFilter('online')} />
                            <Kpi icon="user" tone="accent" label={tr('addinX.people')} value={data.summary.users}
                                sub={tr('addinX.installsSub', { n: data.summary.installs })} onClick={() => setFilter('all')} />
                            <Kpi icon="refresh" tone={counts.outdated ? 'warn' : 'muted'} label={tr('addinX.outdated')} value={counts.outdated}
                                sub={latest ? tr('addinX.latest', { v: latest }) : undefined} onClick={() => setFilter('outdated')} />
                            <Kpi icon="key" tone={data.summary.signinFailures || data.summary.ssoProblems ? 'alert' : 'muted'} label={tr('addinX.failures')}
                                value={data.summary.signinFailures} sub={tr('addinX.ssoSub', { n: data.summary.ssoProblems })}
                                onClick={() => setFilter('problems')} />
                        </div>

                        <div className="fm-kf__split">
                            <section className="fm-mon-card">
                                <h3><span className="fm-mon-card__ico" aria-hidden><Icon name="grid" /></span>{tr('addinX.where')}</h3>
                                <ul className="fm-kf-hosts">
                                    {hostCounts.map(({ host, n }) => (
                                        <li key={host}>
                                            <span className={`fm-kf-app fm-kf-app--${host}`} aria-hidden>{HOST_MARK[host]}</span>
                                            <span className="fm-kf-hosts__name">{tr(`addin.hosts.${host}`)}</span>
                                            <span className="fm-mon-rank__bar" aria-hidden><i style={{ width: `${(n / maxHost) * 100}%` }} /></span>
                                            <strong>{n}</strong>
                                        </li>
                                    ))}
                                </ul>
                                {platformCounts.length ? (
                                    <div className="fm-kf-chips">
                                        {platformCounts.map(({ platform, n }) => (
                                            <span key={platform} className="fm-kf-chip">{tr(`addin.platforms.${platform}`)} <b>{n}</b></span>
                                        ))}
                                    </div>
                                ) : null}
                            </section>

                            <section id="fm-kf-failures" className={failures.length ? 'fm-mon-card is-alert' : 'fm-mon-card'}>
                                <h3><span className="fm-mon-card__ico" aria-hidden><Icon name="key" /></span>{tr('addinX.failuresTitle')}</h3>
                                {failures.length ? (
                                    <ul className="fm-kf-fails">
                                        {failures.slice(0, 20).map((row) => <FailureRow key={row.id} row={row} relative={relative} />)}
                                    </ul>
                                ) : (
                                    <div className="fm-mon-empty is-ok"><Icon name="check" /><p>{tr('addinX.noFailures')}</p></div>
                                )}
                            </section>
                        </div>

                        <section className="fm-mon-card fm-kf-people">
                            <div className="fm-kf__toolbar">
                                <div className="fm-kf__tabs" role="tablist">
                                    {(['all', 'online', 'problems', 'outdated'] as Filter[]).map((id) => (
                                        <button key={id} type="button" role="tab" aria-selected={filter === id}
                                            className={`fm-kf__tab${filter === id ? ' is-on' : ''}`} onClick={() => setFilter(id)}>
                                            {tr(`addinX.filters.${id}`)}<b>{counts[id]}</b>
                                        </button>
                                    ))}
                                </div>
                                <label className="fm-kf__search">
                                    <Icon name="search" />
                                    <input type="search" value={query} placeholder={tr('addinX.search')} aria-label={tr('addinX.search')}
                                        onChange={(event) => setQuery(event.target.value)} />
                                </label>
                            </div>
                            {visible.length ? (
                                <ul className="fm-kf-list">
                                    {visible.map((person, index) => (
                                        <li key={person.userId} className={`fm-kf-person${person.problem ? ' is-problem' : ''}`}>
                                            <span className={`fm-mon-rank__avatar fm-mon-rank__avatar--${index % 6} fm-kf-person__avatar`} aria-hidden>
                                                {initials(person.name)}
                                                <i className={person.online ? 'is-online' : undefined} />
                                            </span>
                                            <div className="fm-kf-person__main">
                                                <div className="fm-kf-person__head">
                                                    <strong>{person.name}</strong>
                                                    {person.online
                                                        ? <span className="fm-kf-badge is-ok">{tr('addin.now')}</span>
                                                        : <span className="fm-kf-person__seen" title={formatDateTime(person.lastSeen, locale)}>{relative(person.lastSeen)}</span>}
                                                </div>
                                                <ul className="fm-kf-devices">
                                                    {person.installs.map((row) => (
                                                        <Device key={row.clientId} row={row} latest={latest} relative={relative} />
                                                    ))}
                                                </ul>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : <div className="fm-mon-empty"><Icon name="user" /><p>{people.length ? tr('addinX.nothing') : tr('addin.empty')}</p></div>}
                        </section>
                    </>
                ) : null}
            </StateBlock>
        </section>
    );
}

function Device({ row, latest, relative }: { row: AddinClient; latest: string; relative: (iso: string | null) => string }) {
    const { tr, locale } = useFm();
    const problem = SSO_PROBLEMS.has(row.ssoStatus);
    const outdated = Boolean(latest && row.addinVersion && compareVersions(row.addinVersion, latest) < 0);
    const platform = tr(`addin.platforms.${row.platform}`);
    return (
        <li className={`fm-kf-device${row.online ? ' is-online' : ''}`}>
            <span className={`fm-kf-app fm-kf-app--${row.host}`} aria-hidden>{HOST_MARK[row.host]}</span>
            <span className="fm-kf-device__main">
                <span className="fm-kf-device__line">
                    <b>{tr(`addin.hosts.${row.host}`)}</b>
                    {platform ? <span>{platform}</span> : null}
                    <span className={outdated ? 'fm-kf-badge is-warn' : 'fm-kf-badge'}>
                        v{row.addinVersion || '?'}{outdated ? ` → ${latest}` : ''}
                    </span>
                    <span className="fm-kf-badge is-muted">{tr(`addin.methods.${row.authMethod}`)}</span>
                </span>
                <span className="fm-kf-device__meta">
                    {row.online ? <em className="is-ok">{tr('addin.now')}</em> : <em title={formatDateTime(row.lastSeen, locale)}>{relative(row.lastSeen)}</em>}
                    {row.officeVersion ? <span>Office {row.officeVersion}</span> : null}
                    {row.ip ? <span>IP {row.ip}</span> : null}
                </span>
                {problem ? (
                    <span className="fm-kf-device__err">
                        {tr(`addin.sso.${row.ssoStatus}`)}{row.ssoError ? `: ${row.ssoError}` : ''}
                    </span>
                ) : null}
            </span>
        </li>
    );
}

function FailureRow({ row, relative }: { row: AddinSigninFailure; relative: (iso: string | null) => string }) {
    const { tr, locale } = useFm();
    const [first, ...rest] = row.error.split('\n');
    const platform = tr(`addin.platforms.${row.platform}`);
    return (
        <li className="fm-kf-fail">
            <span className="fm-mon-denied__dot" aria-hidden />
            <div className="fm-kf-fail__main">
                <div className="fm-kf-fail__head">
                    <strong>{row.email || tr('addinX.unknownUser')}</strong>
                    <em title={formatDateTime(row.at, locale)}>{relative(row.at)}</em>
                </div>
                <span className="fm-kf-fail__device">
                    {tr(`addin.hosts.${row.host}`)}{platform ? ` · ${platform}` : ''}
                    {row.officeVersion ? ` · Office ${row.officeVersion}` : ''}
                    {row.addinVersion ? ` · v${row.addinVersion}` : ''}
                    {row.ip ? ` · ${row.ip}` : ''}
                </span>
                <p className="fm-kf-fail__error">{first || '—'}</p>
                {rest.length ? (
                    <details className="fm-kf-fail__more">
                        <summary>{tr('addinX.details')}</summary>
                        <pre>{rest.join('\n')}</pre>
                    </details>
                ) : null}
            </div>
        </li>
    );
}
