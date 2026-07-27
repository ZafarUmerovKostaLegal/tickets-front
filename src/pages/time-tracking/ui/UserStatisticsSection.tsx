import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchLaborStatistics,
    fetchLaborStatisticsMeta,
    isTimeTrackingHttpError,
    type LaborStatisticsMeta,
    type LaborStatisticsResponse,
} from '@entities/time-tracking';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useI18n } from '@shared/i18n';
import { ProjectActivityChart } from './ProjectActivityChart';

type UserOption = LaborStatisticsMeta['lawyers'][number];

function userOptionLabel(u: UserOption): string {
    const name = (u.name || '').trim();
    const email = (u.email || '').trim();
    if (name && email)
        return `${name} (${email})`;
    return name || email || u.id;
}

function userSearchText(u: UserOption): string {
    return `${u.name ?? ''} ${u.email ?? ''} ${u.id}`.replace(/\s+/g, ' ').trim();
}

type UserStatisticsSectionProps = {
    dateFrom: string;
    dateTo: string;
};

export function UserStatisticsSection({ dateFrom, dateTo }: UserStatisticsSectionProps) {
    const { t } = useI18n();
    const [users, setUsers] = useState<UserOption[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [stats, setStats] = useState<LaborStatisticsResponse | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [detailQ, setDetailQ] = useState('');

    const selectedUser = useMemo(
        () => users.find((u) => u.id === selectedUserId) ?? null,
        [users, selectedUserId],
    );

    useEffect(() => {
        let cancelled = false;
        setUsersLoading(true);
        setUsersError(null);
        void fetchLaborStatisticsMeta()
            .then((meta) => {
                if (cancelled)
                    return;
                setUsers(meta.lawyers ?? []);
            })
            .catch((e) => {
                if (cancelled)
                    return;
                setUsers([]);
                if (isTimeTrackingHttpError(e, 403))
                    setUsersError(t('timeTrackingPage.statistics.errors.forbidden'));
                else
                    setUsersError(e instanceof Error ? e.message : t('timeTrackingPage.statistics.errors.loadFailed'));
            })
            .finally(() => {
                if (!cancelled)
                    setUsersLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const loadStats = useCallback(async (lawyerId: string, from: string, to: string) => {
        const lid = lawyerId.trim();
        if (!lid || !from || !to) {
            setStats(null);
            setStatsError(null);
            return;
        }
        setStatsLoading(true);
        setStatsError(null);
        try {
            const data = await fetchLaborStatistics({
                dateFrom: from,
                dateTo: to,
                lawyerId: lid,
                page: 1,
                perPage: 100,
                sort: 'hours',
                sortDir: 'desc',
            });
            setStats(data);
        }
        catch (e) {
            setStats(null);
            if (isTimeTrackingHttpError(e, 403))
                setStatsError(t('timeTrackingPage.statistics.errors.forbidden'));
            else
                setStatsError(e instanceof Error ? e.message : t('timeTrackingPage.statistics.errors.loadFailed'));
        }
        finally {
            setStatsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (!selectedUserId) {
            setStats(null);
            setStatsError(null);
            return;
        }
        void loadStats(selectedUserId, dateFrom, dateTo);
    }, [selectedUserId, dateFrom, dateTo, loadStats]);

    const filteredDetailRows = useMemo(() => {
        const rows = stats?.detail.rows ?? [];
        const q = detailQ.trim().toLowerCase();
        if (!q)
            return rows;
        return rows.filter((r) => {
            const hay = [
                r.project_name,
                r.task_name,
                r.client_name,
                r.team_name,
                r.partner_name,
                r.period_label,
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [stats, detailQ]);

    const byProjects = stats?.charts.by_projects ?? [];
    const byClients = stats?.charts.by_clients ?? [];
    const hoursByDay = stats?.charts.hours_by_day ?? [];

    return (
        <div className="tt-statistics-project">
            <div className="tt-statistics-project__toolbar">
                <label className="tt-statistics-project__project-field">
                    <span className="tt-statistics-project__label">{t('timeTrackingPage.statistics.userLabel')}</span>
                    <SearchableSelect<UserOption>
                        portalDropdown
                        className="tt-statistics-project__srch"
                        buttonClassName="tt-statistics-project__srch-btn"
                        aria-label={t('timeTrackingPage.statistics.userLabel')}
                        disabled={usersLoading || users.length === 0}
                        placeholder={
                            usersLoading
                                ? t('timeTrackingPage.common.loading')
                                : users.length === 0
                                    ? t('timeTrackingPage.statistics.userSearchEmpty')
                                    : t('timeTrackingPage.statistics.selectUser')
                        }
                        emptyListText={t('timeTrackingPage.statistics.userSearchEmpty')}
                        noMatchText={t('timeTrackingPage.notFound')}
                        value={selectedUserId}
                        items={users}
                        getOptionValue={(u) => u.id}
                        getOptionLabel={userOptionLabel}
                        getSearchText={userSearchText}
                        onSelect={(u) => {
                            setSelectedUserId(u.id);
                            setDetailQ('');
                        }}
                    />
                </label>
                {selectedUserId ? (
                    <button
                        type="button"
                        className="tt-reports__btn tt-reports__btn--outline"
                        disabled={statsLoading}
                        onClick={() => void loadStats(selectedUserId, dateFrom, dateTo)}
                    >
                        {t('timeTrackingPage.statistics.widgetToolbar.refresh')}
                    </button>
                ) : null}
            </div>

            {usersError ? <p className="tt-statistics-project__error">{usersError}</p> : null}
            {statsError ? <p className="tt-statistics-project__error">{statsError}</p> : null}

            {!selectedUserId ? (
                <div className="tt-statistics-project__empty">
                    <p className="tt-statistics-project__empty-title">{t('timeTrackingPage.statistics.selectUser')}</p>
                    <p className="tt-statistics-project__empty-hint">{t('timeTrackingPage.statistics.userSearchHint')}</p>
                </div>
            ) : statsLoading && !stats ? (
                <p className="tt-statistics-project__muted">{t('timeTrackingPage.common.loading')}</p>
            ) : stats ? (
                <>
                    <header className="tt-statistics-project__head">
                        <h3 className="tt-statistics-project__title">
                            {selectedUser ? userOptionLabel(selectedUser) : selectedUserId}
                        </h3>
                        <p className="tt-statistics-project__period">
                            {dateFrom} — {dateTo}
                        </p>
                    </header>

                    <section className="tt-statistics-project__kpi" aria-label={t('timeTrackingPage.statistics.summaryAria')}>
                        <KpiCard label={t('timeTrackingPage.statistics.widgets.total')} value={fmtH(stats.kpi.total_hours)} />
                        <KpiCard label={t('timeTrackingPage.statistics.series.billable')} value={fmtH(stats.kpi.billable_hours)} />
                        <KpiCard label={t('timeTrackingPage.statistics.series.nonBillable')} value={fmtH(stats.kpi.non_billable_hours)} />
                        <KpiCard
                            label={t('timeTrackingPage.statistics.kpi.accruedAmount')}
                            value={fmtAmtWithIso(stats.kpi.billable_amount, stats.kpi.billable_currency)}
                        />
                        <KpiCard
                            label={t('timeTrackingPage.statistics.kpi.paidAmount')}
                            value={fmtAmtWithIso(stats.kpi.paid_amount, stats.kpi.paid_currency)}
                        />
                        <KpiCard
                            label={t('timeTrackingPage.statistics.kpi.ratePerHour')}
                            value={fmtAmtWithIso(stats.kpi.rate_per_hour, stats.kpi.paid_currency || stats.kpi.billable_currency)}
                        />
                    </section>

                    {hoursByDay.length > 0 ? (
                        <ProjectActivityChart
                            days={hoursByDay}
                            title={t('timeTrackingPage.statistics.userChartTitle')}
                            hint={t('timeTrackingPage.statistics.userChartHint')}
                        />
                    ) : null}

                    {byProjects.length > 0 ? (
                        <StackedHoursList
                            title={t('timeTrackingPage.statistics.widgets.byProjects')}
                            rows={byProjects}
                            billableShort={t('timeTrackingPage.statistics.widgets.billableShort')}
                        />
                    ) : null}

                    {byClients.length > 0 ? (
                        <StackedHoursList
                            title={t('timeTrackingPage.statistics.widgets.byClients')}
                            rows={byClients}
                            billableShort={t('timeTrackingPage.statistics.widgets.billableShort')}
                        />
                    ) : null}

                    <section className="tt-statistics-project__detail" aria-label={t('timeTrackingPage.statistics.detailTable.aria')}>
                        <div className="tt-statistics-project__detail-head">
                            <h4 className="tt-statistics-project__section-title">{t('timeTrackingPage.statistics.detailTable.title')}</h4>
                            <input
                                type="search"
                                className="tt-statistics-project__detail-search"
                                value={detailQ}
                                onChange={(e) => setDetailQ(e.target.value)}
                                placeholder={t('timeTrackingPage.statistics.detailTable.searchPlaceholder')}
                                aria-label={t('timeTrackingPage.statistics.detailTable.searchAria')}
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                        {filteredDetailRows.length === 0 ? (
                            <p className="tt-statistics-project__muted">{t('timeTrackingPage.statistics.detailTable.empty')}</p>
                        ) : (
                            <div className="tt-statistics-project__table-wrap">
                                <table className="tt-reports__table tt-statistics-project__table">
                                    <thead>
                                        <tr>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.project_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.task_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.client_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.hours')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.payment')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDetailRows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.project_name || '—'}</td>
                                                <td>{r.task_name || '—'}</td>
                                                <td>{r.client_name || '—'}</td>
                                                <td>{fmtH(r.hours)}</td>
                                                <td>{fmtAmtWithIso(r.payment, r.currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            ) : null}
        </div>
    );
}

function KpiCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="tt-statistics-project__kpi-card">
            <span className="tt-statistics-project__kpi-label">{label}</span>
            <strong className="tt-statistics-project__kpi-value">{value}</strong>
        </div>
    );
}

function StackedHoursList({
    title,
    rows,
    billableShort,
}: {
    title: string;
    rows: Array<{ id: string; name: string; billable_hours: number; non_billable_hours: number }>;
    billableShort: string;
}) {
    return (
        <section className="tt-statistics-project__users" aria-label={title}>
            <h4 className="tt-statistics-project__section-title">{title}</h4>
            <ul className="tt-statistics-project__user-list">
                {rows.map((row) => {
                    const total = row.billable_hours + row.non_billable_hours;
                    return (
                        <li key={row.id || row.name} className="tt-statistics-project__user-row">
                            <span className="tt-statistics-project__user-name">{row.name}</span>
                            <span className="tt-statistics-project__user-hours">
                                {fmtH(total)}
                                <span className="tt-statistics-project__user-split">
                                    {' '}({billableShort} {fmtH(row.billable_hours)})
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
