import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchLaborStatistics,
    isTimeTrackingHttpError,
    listTimeTrackingTeams,
    type LaborStatisticsResponse,
    type TimeTrackingTeamRow,
} from '@entities/time-tracking';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useI18n } from '@shared/i18n';
import { ProjectActivityChart } from './ProjectActivityChart';

function teamOptionLabel(team: TimeTrackingTeamRow): string {
    const partner = (team.partner_display_name || '').trim();
    return partner ? `${team.name.trim()} (${partner})` : team.name.trim();
}

function teamSearchText(team: TimeTrackingTeamRow): string {
    return `${team.name} ${team.partner_display_name ?? ''} ${team.id}`.replace(/\s+/g, ' ').trim();
}

type TeamStatisticsSectionProps = {
    dateFrom: string;
    dateTo: string;
};

export function TeamStatisticsSection({ dateFrom, dateTo }: TeamStatisticsSectionProps) {
    const { t } = useI18n();
    const [teams, setTeams] = useState<TimeTrackingTeamRow[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [teamsError, setTeamsError] = useState<string | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [stats, setStats] = useState<LaborStatisticsResponse | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [detailQ, setDetailQ] = useState('');

    const selectedTeam = useMemo(
        () => teams.find((team) => team.id === selectedTeamId) ?? null,
        [teams, selectedTeamId],
    );

    useEffect(() => {
        let cancelled = false;
        setTeamsLoading(true);
        setTeamsError(null);
        void listTimeTrackingTeams({ includeArchived: false })
            .then((rows) => {
                if (cancelled)
                    return;
                const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                setTeams(sorted);
            })
            .catch((e) => {
                if (cancelled)
                    return;
                setTeams([]);
                if (isTimeTrackingHttpError(e, 403))
                    setTeamsError(t('timeTrackingPage.statistics.errors.forbidden'));
                else
                    setTeamsError(e instanceof Error ? e.message : t('timeTrackingPage.statistics.errors.loadFailed'));
            })
            .finally(() => {
                if (!cancelled)
                    setTeamsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const loadStats = useCallback(async (teamId: string, from: string, to: string) => {
        const tid = teamId.trim();
        if (!tid || !from || !to) {
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
                teamId: tid,
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
        if (!selectedTeamId) {
            setStats(null);
            setStatsError(null);
            return;
        }
        void loadStats(selectedTeamId, dateFrom, dateTo);
    }, [selectedTeamId, dateFrom, dateTo, loadStats]);

    const filteredDetailRows = useMemo(() => {
        const rows = stats?.detail.rows ?? [];
        const q = detailQ.trim().toLowerCase();
        if (!q)
            return rows;
        return rows.filter((r) => {
            const hay = [
                r.lawyer_name,
                r.task_name,
                r.project_name,
                r.client_name,
                r.team_name,
                r.partner_name,
                r.period_label,
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [stats, detailQ]);

    const byUsers = stats?.charts.by_users ?? [];
    const byProjects = stats?.charts.by_projects ?? [];
    const hoursByDay = stats?.charts.hours_by_day ?? [];

    return (
        <div className="tt-statistics-project">
            <div className="tt-statistics-project__toolbar">
                <label className="tt-statistics-project__project-field">
                    <span className="tt-statistics-project__label">{t('timeTrackingPage.statistics.teamLabel')}</span>
                    <SearchableSelect<TimeTrackingTeamRow>
                        portalDropdown
                        className="tt-statistics-project__srch"
                        buttonClassName="tt-statistics-project__srch-btn"
                        aria-label={t('timeTrackingPage.statistics.teamLabel')}
                        disabled={teamsLoading || teams.length === 0}
                        placeholder={
                            teamsLoading
                                ? t('timeTrackingPage.common.loading')
                                : teams.length === 0
                                    ? t('timeTrackingPage.statistics.teamSearchEmpty')
                                    : t('timeTrackingPage.statistics.selectTeam')
                        }
                        emptyListText={t('timeTrackingPage.statistics.teamSearchEmpty')}
                        noMatchText={t('timeTrackingPage.notFound')}
                        value={selectedTeamId}
                        items={teams}
                        getOptionValue={(team) => team.id}
                        getOptionLabel={teamOptionLabel}
                        getSearchText={teamSearchText}
                        onSelect={(team) => {
                            setSelectedTeamId(team.id);
                            setDetailQ('');
                        }}
                    />
                </label>
                {selectedTeamId ? (
                    <button
                        type="button"
                        className="tt-reports__btn tt-reports__btn--outline"
                        disabled={statsLoading}
                        onClick={() => void loadStats(selectedTeamId, dateFrom, dateTo)}
                    >
                        {t('timeTrackingPage.statistics.widgetToolbar.refresh')}
                    </button>
                ) : null}
            </div>

            {teamsError ? <p className="tt-statistics-project__error">{teamsError}</p> : null}
            {statsError ? <p className="tt-statistics-project__error">{statsError}</p> : null}

            {!selectedTeamId ? (
                <div className="tt-statistics-project__empty">
                    <p className="tt-statistics-project__empty-title">{t('timeTrackingPage.statistics.selectTeam')}</p>
                    <p className="tt-statistics-project__empty-hint">{t('timeTrackingPage.statistics.teamSearchHint')}</p>
                </div>
            ) : statsLoading && !stats ? (
                <p className="tt-statistics-project__muted">{t('timeTrackingPage.common.loading')}</p>
            ) : stats ? (
                <>
                    <header className="tt-statistics-project__head">
                        <h3 className="tt-statistics-project__title">
                            {selectedTeam ? teamOptionLabel(selectedTeam) : selectedTeamId}
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
                            title={t('timeTrackingPage.statistics.teamChartTitle')}
                            hint={t('timeTrackingPage.statistics.teamChartHint')}
                        />
                    ) : null}

                    {byUsers.length > 0 ? (
                        <StackedHoursList
                            title={t('timeTrackingPage.statistics.widgets.byUsers')}
                            rows={byUsers}
                            billableShort={t('timeTrackingPage.statistics.widgets.billableShort')}
                        />
                    ) : null}

                    {byProjects.length > 0 ? (
                        <StackedHoursList
                            title={t('timeTrackingPage.statistics.widgets.byProjects')}
                            rows={byProjects}
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
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.lawyer_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.project_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.task_name')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.hours')}</th>
                                            <th scope="col">{t('timeTrackingPage.statistics.detailTable.columns.payment')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDetailRows.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.lawyer_name || '—'}</td>
                                                <td>{r.project_name || '—'}</td>
                                                <td>{r.task_name || '—'}</td>
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
