import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLaborStatistics, isTimeTrackingHttpError, listTimeTrackingTeams, } from '@entities/time-tracking';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useI18n } from '@shared/i18n';
import { ProjectActivityChart } from './ProjectActivityChart';
function teamOptionLabel(team) {
    const partner = (team.partner_display_name || '').trim();
    return partner ? `${team.name.trim()} (${partner})` : team.name.trim();
}
function teamSearchText(team) {
    return `${team.name} ${team.partner_display_name ?? ''} ${team.id}`.replace(/\s+/g, ' ').trim();
}
export function TeamStatisticsSection({ dateFrom, dateTo }) {
    const { t } = useI18n();
    const [teams, setTeams] = useState([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [teamsError, setTeamsError] = useState(null);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);
    const [detailQ, setDetailQ] = useState('');
    const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? null, [teams, selectedTeamId]);
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
    const loadStats = useCallback(async (teamId, from, to) => {
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
    return (_jsxs("div", { className: "tt-statistics-project", children: [_jsxs("div", { className: "tt-statistics-project__toolbar", children: [_jsxs("label", { className: "tt-statistics-project__project-field", children: [_jsx("span", { className: "tt-statistics-project__label", children: t('timeTrackingPage.statistics.teamLabel') }), _jsx(SearchableSelect, { portalDropdown: true, className: "tt-statistics-project__srch", buttonClassName: "tt-statistics-project__srch-btn", "aria-label": t('timeTrackingPage.statistics.teamLabel'), disabled: teamsLoading || teams.length === 0, placeholder: teamsLoading
                                    ? t('timeTrackingPage.common.loading')
                                    : teams.length === 0
                                        ? t('timeTrackingPage.statistics.teamSearchEmpty')
                                        : t('timeTrackingPage.statistics.selectTeam'), emptyListText: t('timeTrackingPage.statistics.teamSearchEmpty'), noMatchText: t('timeTrackingPage.notFound'), value: selectedTeamId, items: teams, getOptionValue: (team) => team.id, getOptionLabel: teamOptionLabel, getSearchText: teamSearchText, onSelect: (team) => {
                                    setSelectedTeamId(team.id);
                                    setDetailQ('');
                                } })] }), selectedTeamId ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: statsLoading, onClick: () => void loadStats(selectedTeamId, dateFrom, dateTo), children: t('timeTrackingPage.statistics.widgetToolbar.refresh') })) : null] }), teamsError ? _jsx("p", { className: "tt-statistics-project__error", children: teamsError }) : null, statsError ? _jsx("p", { className: "tt-statistics-project__error", children: statsError }) : null, !selectedTeamId ? (_jsxs("div", { className: "tt-statistics-project__empty", children: [_jsx("p", { className: "tt-statistics-project__empty-title", children: t('timeTrackingPage.statistics.selectTeam') }), _jsx("p", { className: "tt-statistics-project__empty-hint", children: t('timeTrackingPage.statistics.teamSearchHint') })] })) : statsLoading && !stats ? (_jsx("p", { className: "tt-statistics-project__muted", children: t('timeTrackingPage.common.loading') })) : stats ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "tt-statistics-project__head", children: [_jsx("h3", { className: "tt-statistics-project__title", children: selectedTeam ? teamOptionLabel(selectedTeam) : selectedTeamId }), _jsxs("p", { className: "tt-statistics-project__period", children: [dateFrom, " \u2014 ", dateTo] })] }), _jsxs("section", { className: "tt-statistics-project__kpi", "aria-label": t('timeTrackingPage.statistics.summaryAria'), children: [_jsx(KpiCard, { label: t('timeTrackingPage.statistics.widgets.total'), value: fmtH(stats.kpi.total_hours) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.series.billable'), value: fmtH(stats.kpi.billable_hours) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.series.nonBillable'), value: fmtH(stats.kpi.non_billable_hours) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.kpi.accruedAmount'), value: fmtAmtWithIso(stats.kpi.billable_amount, stats.kpi.billable_currency) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.kpi.paidAmount'), value: fmtAmtWithIso(stats.kpi.paid_amount, stats.kpi.paid_currency) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.kpi.ratePerHour'), value: fmtAmtWithIso(stats.kpi.rate_per_hour, stats.kpi.paid_currency || stats.kpi.billable_currency) })] }), hoursByDay.length > 0 ? (_jsx(ProjectActivityChart, { days: hoursByDay, title: t('timeTrackingPage.statistics.teamChartTitle'), hint: t('timeTrackingPage.statistics.teamChartHint') })) : null, byUsers.length > 0 ? (_jsx(StackedHoursList, { title: t('timeTrackingPage.statistics.widgets.byUsers'), rows: byUsers, billableShort: t('timeTrackingPage.statistics.widgets.billableShort') })) : null, byProjects.length > 0 ? (_jsx(StackedHoursList, { title: t('timeTrackingPage.statistics.widgets.byProjects'), rows: byProjects, billableShort: t('timeTrackingPage.statistics.widgets.billableShort') })) : null, _jsxs("section", { className: "tt-statistics-project__detail", "aria-label": t('timeTrackingPage.statistics.detailTable.aria'), children: [_jsxs("div", { className: "tt-statistics-project__detail-head", children: [_jsx("h4", { className: "tt-statistics-project__section-title", children: t('timeTrackingPage.statistics.detailTable.title') }), _jsx("input", { type: "search", className: "tt-statistics-project__detail-search", value: detailQ, onChange: (e) => setDetailQ(e.target.value), placeholder: t('timeTrackingPage.statistics.detailTable.searchPlaceholder'), "aria-label": t('timeTrackingPage.statistics.detailTable.searchAria'), autoComplete: "off", spellCheck: false })] }), filteredDetailRows.length === 0 ? (_jsx("p", { className: "tt-statistics-project__muted", children: t('timeTrackingPage.statistics.detailTable.empty') })) : (_jsx("div", { className: "tt-statistics-project__table-wrap", children: _jsxs("table", { className: "tt-reports__table tt-statistics-project__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.lawyer_name') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.project_name') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.task_name') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.hours') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.payment') })] }) }), _jsx("tbody", { children: filteredDetailRows.map((r) => (_jsxs("tr", { children: [_jsx("td", { children: r.lawyer_name || '—' }), _jsx("td", { children: r.project_name || '—' }), _jsx("td", { children: r.task_name || '—' }), _jsx("td", { children: fmtH(r.hours) }), _jsx("td", { children: fmtAmtWithIso(r.payment, r.currency) })] }, r.id))) })] }) }))] })] })) : null] }));
}
function KpiCard({ label, value }) {
    return (_jsxs("div", { className: "tt-statistics-project__kpi-card", children: [_jsx("span", { className: "tt-statistics-project__kpi-label", children: label }), _jsx("strong", { className: "tt-statistics-project__kpi-value", children: value })] }));
}
function StackedHoursList({ title, rows, billableShort, }) {
    return (_jsxs("section", { className: "tt-statistics-project__users", "aria-label": title, children: [_jsx("h4", { className: "tt-statistics-project__section-title", children: title }), _jsx("ul", { className: "tt-statistics-project__user-list", children: rows.map((row) => {
                    const total = row.billable_hours + row.non_billable_hours;
                    return (_jsxs("li", { className: "tt-statistics-project__user-row", children: [_jsx("span", { className: "tt-statistics-project__user-name", children: row.name }), _jsxs("span", { className: "tt-statistics-project__user-hours", children: [fmtH(total), _jsxs("span", { className: "tt-statistics-project__user-split", children: [' ', "(", billableShort, " ", fmtH(row.billable_hours), ")"] })] })] }, row.id || row.name));
                }) })] }));
}
