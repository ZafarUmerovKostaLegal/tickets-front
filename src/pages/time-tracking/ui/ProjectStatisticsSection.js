import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLaborStatistics, isTimeTrackingHttpError, } from '@entities/time-tracking';
import { fmtAmtWithIso, fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { ProjectActivityChart } from './ProjectActivityChart';
import { loadTimesheetProjectOptions } from './timesheetProjectLoader';
function projectOptionLabel(p) {
    const c = (p.client || '').trim();
    return c ? `${p.name.trim()} (${c})` : p.name.trim();
}
function projectSearchText(p) {
    return `${p.name} ${p.client} ${p.id}`.replace(/\s+/g, ' ').trim();
}
export function ProjectStatisticsSection({ dateFrom, dateTo }) {
    const { t, locale } = useI18n();
    const { user } = useCurrentUser();
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);
    const [detailQ, setDetailQ] = useState('');
    const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
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
    const loadStats = useCallback(async (projectId, from, to) => {
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
                r.team_name,
                r.partner_name,
                r.period_label,
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [stats, detailQ]);
    const byUsers = stats?.charts.by_users ?? [];
    const hoursByDay = stats?.charts.hours_by_day ?? [];
    return (_jsxs("div", { className: "tt-statistics-project", children: [_jsxs("div", { className: "tt-statistics-project__toolbar", children: [_jsxs("label", { className: "tt-statistics-project__project-field", children: [_jsx("span", { className: "tt-statistics-project__label", children: t('timeTrackingPage.statistics.projectLabel') }), _jsx(SearchableSelect, { portalDropdown: true, className: "tt-statistics-project__srch", buttonClassName: "tt-statistics-project__srch-btn", "aria-label": t('timeTrackingPage.statistics.projectLabel'), disabled: projectsLoading || !user || projects.length === 0, placeholder: projectsLoading
                                    ? t('timeTrackingPage.common.loading')
                                    : projects.length === 0
                                        ? t('timeTrackingPage.statistics.projectSearchEmpty')
                                        : t('timeTrackingPage.statistics.selectProject'), emptyListText: t('timeTrackingPage.statistics.projectSearchEmpty'), noMatchText: t('timeTrackingPage.notFound'), value: selectedProjectId, items: projects, getOptionValue: (p) => p.id, getOptionLabel: projectOptionLabel, getSearchText: projectSearchText, onSelect: (p) => {
                                    setSelectedProjectId(p.id);
                                    setDetailQ('');
                                } })] }), selectedProjectId ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: statsLoading, onClick: () => void loadStats(selectedProjectId, dateFrom, dateTo), children: t('timeTrackingPage.statistics.widgetToolbar.refresh') })) : null] }), projectsError ? _jsx("p", { className: "tt-statistics-project__error", children: projectsError }) : null, statsError ? _jsx("p", { className: "tt-statistics-project__error", children: statsError }) : null, !selectedProjectId ? (_jsxs("div", { className: "tt-statistics-project__empty", children: [_jsx("p", { className: "tt-statistics-project__empty-title", children: t('timeTrackingPage.statistics.selectProject') }), _jsx("p", { className: "tt-statistics-project__empty-hint", children: t('timeTrackingPage.statistics.projectSearchHint') })] })) : statsLoading && !stats ? (_jsx("p", { className: "tt-statistics-project__muted", children: t('timeTrackingPage.common.loading') })) : stats ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "tt-statistics-project__head", children: [_jsx("h3", { className: "tt-statistics-project__title", children: selectedProject ? projectOptionLabel(selectedProject) : selectedProjectId }), _jsxs("p", { className: "tt-statistics-project__period", children: [dateFrom, " \u2014 ", dateTo] })] }), _jsxs("section", { className: "tt-statistics-project__kpi", "aria-label": t('timeTrackingPage.statistics.summaryAria'), children: [_jsx(KpiCard, { label: t('timeTrackingPage.statistics.widgets.total'), value: fmtH(stats.kpi.total_hours) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.series.billable'), value: fmtH(stats.kpi.billable_hours) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.series.nonBillable'), value: fmtH(stats.kpi.non_billable_hours) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.kpi.accruedAmount'), value: fmtAmtWithIso(stats.kpi.billable_amount, stats.kpi.billable_currency) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.kpi.paidAmount'), value: fmtAmtWithIso(stats.kpi.paid_amount, stats.kpi.paid_currency) }), _jsx(KpiCard, { label: t('timeTrackingPage.statistics.kpi.ratePerHour'), value: fmtAmtWithIso(stats.kpi.rate_per_hour, stats.kpi.paid_currency || stats.kpi.billable_currency) })] }), hoursByDay.length > 0 ? (_jsx(ProjectActivityChart, { days: hoursByDay, title: t('timeTrackingPage.statistics.projectChartTitle'), hint: t('timeTrackingPage.statistics.projectChartHint') })) : null, byUsers.length > 0 ? (_jsxs("section", { className: "tt-statistics-project__users", "aria-label": t('timeTrackingPage.statistics.widgets.byUsers'), children: [_jsx("h4", { className: "tt-statistics-project__section-title", children: t('timeTrackingPage.statistics.widgets.byUsers') }), _jsx("ul", { className: "tt-statistics-project__user-list", children: byUsers.map((u) => {
                                    const total = u.billable_hours + u.non_billable_hours;
                                    return (_jsxs("li", { className: "tt-statistics-project__user-row", children: [_jsx("span", { className: "tt-statistics-project__user-name", children: u.name }), _jsxs("span", { className: "tt-statistics-project__user-hours", children: [fmtH(total), _jsxs("span", { className: "tt-statistics-project__user-split", children: [' ', "(", t('timeTrackingPage.statistics.widgets.billableShort'), " ", fmtH(u.billable_hours), ")"] })] })] }, u.id));
                                }) })] })) : null, _jsxs("section", { className: "tt-statistics-project__detail", "aria-label": t('timeTrackingPage.statistics.detailTable.aria'), children: [_jsxs("div", { className: "tt-statistics-project__detail-head", children: [_jsx("h4", { className: "tt-statistics-project__section-title", children: t('timeTrackingPage.statistics.detailTable.title') }), _jsx("input", { type: "search", className: "tt-statistics-project__detail-search", value: detailQ, onChange: (e) => setDetailQ(e.target.value), placeholder: t('timeTrackingPage.statistics.detailTable.searchPlaceholder'), "aria-label": t('timeTrackingPage.statistics.detailTable.searchAria'), autoComplete: "off", spellCheck: false })] }), filteredDetailRows.length === 0 ? (_jsx("p", { className: "tt-statistics-project__muted", children: t('timeTrackingPage.statistics.detailTable.empty') })) : (_jsx("div", { className: "tt-statistics-project__table-wrap", children: _jsxs("table", { className: "tt-reports__table tt-statistics-project__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.lawyer_name') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.task_name') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.hours') }), _jsx("th", { scope: "col", children: t('timeTrackingPage.statistics.detailTable.columns.payment') })] }) }), _jsx("tbody", { children: filteredDetailRows.map((r) => (_jsxs("tr", { children: [_jsx("td", { children: r.lawyer_name || '—' }), _jsx("td", { children: r.task_name || '—' }), _jsx("td", { children: fmtH(r.hours) }), _jsx("td", { children: fmtAmtWithIso(r.payment, r.currency) })] }, r.id))) })] }) }))] })] })) : null] }));
}
function KpiCard({ label, value }) {
    return (_jsxs("div", { className: "tt-statistics-project__kpi-card", children: [_jsx("span", { className: "tt-statistics-project__kpi-label", children: label }), _jsx("strong", { className: "tt-statistics-project__kpi-value", children: value })] }));
}
