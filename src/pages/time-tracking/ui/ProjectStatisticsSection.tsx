import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchLaborStatistics,
    isTimeTrackingHttpError,
    type LaborStatisticsResponse,
} from '@entities/time-tracking';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { loadTimesheetProjectOptions, type ProjectOption } from './timesheetProjectLoader';

function projectOptionLabel(p: ProjectOption): string {
    const c = (p.client || '').trim();
    return c ? `${p.name.trim()} (${c})` : p.name.trim();
}

function projectSearchText(p: ProjectOption): string {
    return `${p.name} ${p.client} ${p.id}`.replace(/\s+/g, ' ').trim();
}

type ProjectStatisticsSectionProps = {
    dateFrom: string;
    dateTo: string;
};

export function ProjectStatisticsSection({ dateFrom, dateTo }: ProjectStatisticsSectionProps) {
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const [projects, setProjects] = useState<ProjectOption[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [stats, setStats] = useState<LaborStatisticsResponse | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [detailQ, setDetailQ] = useState('');

    const selectedProject = useMemo(
        () => projects.find((p) => p.id === selectedProjectId) ?? null,
        [projects, selectedProjectId],
    );

    useEffect(() => {
        if (!user) {
            setProjects([]);
            setProjectsLoading(false);
            return;
        }
        let cancelled = false;
        setProjectsLoading(true);
        setProjectsError(null);
        void loadTimesheetProjectOptions(user, locale, { includeClosed: true }).then(({ items, error }) => {
            if (cancelled)
                return;
            setProjects(items);
            setProjectsError(error);
            setProjectsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user, locale]);

    const loadStats = useCallback(async (projectId: string, from: string, to: string) => {
        const pid = projectId.trim();
        if (!pid || !from || !to) {
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
                projectId: pid,
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
        if (!selectedProjectId) {
            setStats(null);
            setStatsError(null);
            return;
        }
        void loadStats(selectedProjectId, dateFrom, dateTo);
    }, [selectedProjectId, dateFrom, dateTo, loadStats]);

    const filteredDetailRows = useMemo(() => {
        const rows = stats?.detail.rows ?? [];
        const q = detailQ.trim().toLowerCase();
        if (!q)
            return rows;
        return rows.filter((r) => {
            const hay = [
                r.lawyer_name,
                r.task_name,
                r.work_type,
                r.team_name,
                r.partner_name,
                r.period_label,
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [stats, detailQ]);

    const byUsers = stats?.charts.by_users ?? [];
    const hoursByDay = stats?.charts.hours_by_day ?? [];
    const maxDayHours = Math.max(1, ...hoursByDay.map((d) => d.total_hours));

    return (
        <div className="tt-statistics-project">
            <div className="tt-statistics-project__toolbar">
                <label className="tt-statistics-project__project-field">
                    <span className="tt-statistics-project__label">{t('timeTrackingPage.statistics.projectLabel')}</span>
                    <SearchableSelect<ProjectOption>
                        portalDropdown
                        className="tt-statistics-project__srch"
                        buttonClassName="tt-statistics-project__srch-btn"
                        aria-label={t('timeTrackingPage.statistics.projectLabel')}
                        disabled={projectsLoading || !user || projects.length === 0}
                        placeholder={
                            projectsLoading
                                ? t('timeTrackingPage.common.loading')
                                : projects.length === 0
                                    ? t('timeTrackingPage.statistics.projectSearchEmpty')
                                    : t('timeTrackingPage.statistics.selectProject')
                        }
                        emptyListText={t('timeTrackingPage.statistics.projectSearchEmpty')}
                        noMatchText={t('timeTrackingPage.notFound')}
                        value={selectedProjectId}
                        items={projects}
                        getOptionValue={(p) => p.id}
                        getOptionLabel={projectOptionLabel}
                        getSearchText={projectSearchText}
                        onSelect={(p) => {
                            setSelectedProjectId(p.id);
                            setDetailQ('');
                        }}
                    />
                </label>
                {selectedProjectId ? (
                    <button
                        type="button"
                        className="tt-reports__btn tt-reports__btn--outline"
                        disabled={statsLoading}
                        onClick={() => void loadStats(selectedProjectId, dateFrom, dateTo)}
                    >
                        {t('timeTrackingPage.statistics.widgetToolbar.refresh')}
                    </button>
                ) : null}
            </div>

            {projectsError ? (
                <p className="tt-statistics-project__error" role="alert">{projectsError}</p>
            ) : null}

            {!selectedProjectId ? (
                <div className="tt-statistics-project__empty" role="status">
                    <p className="tt-statistics-project__empty-title">{t('timeTrackingPage.statistics.selectProject')}</p>
                    <p className="tt-statistics-project__empty-hint">{t('timeTrackingPage.statistics.projectSearchHint')}</p>
                </div>
            ) : null}

            {selectedProjectId && statsLoading ? (
                <p className="tt-statistics-project__muted" role="status">{t('timeTrackingPage.common.loading')}</p>
            ) : null}

            {selectedProjectId && statsError ? (
                <p className="tt-statistics-project__error" role="alert">{statsError}</p>
            ) : null}

            {selectedProject && stats && !statsLoading ? (
                <>
                    <header className="tt-statistics-project__head">
                        <h3 className="tt-statistics-project__title">{projectOptionLabel(selectedProject)}</h3>
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
                        <section className="tt-statistics-project__chart" aria-label={t('timeTrackingPage.statistics.projectChartTitle')}>
                            <h4 className="tt-statistics-project__section-title">{t('timeTrackingPage.statistics.projectChartTitle')}</h4>
                            <p className="tt-statistics-project__section-hint">{t('timeTrackingPage.statistics.projectChartHint')}</p>
                            <div className="tt-statistics-project__bars" role="img" aria-label={t('timeTrackingPage.statistics.chartTitle')}>
                                {hoursByDay.map((d) => (
                                    <div key={d.date} className="tt-statistics-project__bar-col" title={`${d.date_label}: ${fmtH(d.total_hours)}`}>
                                        <div
                                            className="tt-statistics-project__bar"
                                            style={{ height: `${Math.max(4, (d.total_hours / maxDayHours) * 100)}%` }}
                                        />
                                        <span className="tt-statistics-project__bar-label">{d.date_label}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {byUsers.length > 0 ? (
                        <section className="tt-statistics-project__users" aria-label={t('timeTrackingPage.statistics.widgets.byUsers')}>
                            <h4 className="tt-statistics-project__section-title">{t('timeTrackingPage.statistics.widgets.byUsers')}</h4>
                            <ul className="tt-statistics-project__user-list">
                                {byUsers.map((u) => {
                                    const total = u.billable_hours + u.non_billable_hours;
                                    return (
                                        <li key={u.id} className="tt-statistics-project__user-row">
                                            <span className="tt-statistics-project__user-name">{u.name}</span>
                                            <span className="tt-statistics-project__user-hours">
                                                {fmtH(total)}
                                                <span className="tt-statistics-project__user-split">
                                                    {' '}({t('timeTrackingPage.statistics.widgets.billableShort')} {fmtH(u.billable_hours)})
                                                </span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
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
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.lawyer_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.task_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.work_type')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.hours')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.billable_amount')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.payment')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDetailRows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.lawyer_name || '—'}</td>
                                                <td>{r.task_name || '—'}</td>
                                                <td>{r.work_type || '—'}</td>
                                                <td>{fmtH(r.hours)}</td>
                                                <td>{fmtAmtWithIso(r.billable_amount, r.currency)}</td>
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
