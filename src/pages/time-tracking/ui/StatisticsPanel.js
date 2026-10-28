import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatPeriodLabel, periodToDates } from '@entities/time-tracking/lib/reportsPeriodRange';
import { PERIOD_OPTIONS, } from '@entities/time-tracking/model/reportsPanelConfig';
import { useI18n, ttReportPeriodLabel } from '@shared/i18n';
import { ProjectStatisticsSection } from './ProjectStatisticsSection';
import { TeamStatisticsSection } from './TeamStatisticsSection';
import { UserStatisticsSection } from './UserStatisticsSection';
import './StatisticsPanel.css';
const STATS_TABS = [
    { id: 'project', labelKey: 'timeTrackingPage.statistics.subTabs.project' },
    { id: 'team', labelKey: 'timeTrackingPage.statistics.subTabs.team' },
    { id: 'user', labelKey: 'timeTrackingPage.statistics.subTabs.user' },
];
function parseStatsTab(raw) {
    if (raw === 'team' || raw === 'user' || raw === 'project')
        return raw;
    return 'project';
}
const IcoChevLeft = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M15 18l-6-6 6-6" }) }));
const IcoChevRight = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M9 18l6-6-6-6" }) }));
const IcoChevDown = () => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
function shiftPeriodDate(date, granularity, direction) {
    const next = new Date(date);
    if (granularity === 'week')
        next.setDate(next.getDate() + 7 * direction);
    else if (granularity === 'month')
        next.setMonth(next.getMonth() + direction);
    else if (granularity === 'quarter')
        next.setMonth(next.getMonth() + 3 * direction);
    else if (granularity === 'year')
        next.setFullYear(next.getFullYear() + direction);
    return next;
}
export function StatisticsPanel() {
    const { t } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseStatsTab(searchParams.get('statsTab'));
    const [periodDate, setPeriodDate] = useState(() => new Date());
    const [periodGranularity, setPeriodGranularity] = useState('month');
    const [periodDropdown, setPeriodDropdown] = useState(false);
    const periodDropdownRef = useRef(null);
    const { dateFrom, dateTo } = useMemo(() => periodToDates(periodDate, periodGranularity), [periodDate, periodGranularity]);
    const setActiveTab = useCallback((tab) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('statsTab', tab);
            return next;
        }, { replace: true });
    }, [setSearchParams]);
    const periodTitle = useMemo(() => {
        if (periodGranularity === 'all')
            return t('timeTrackingPage.reports.periods.all');
        return formatPeriodLabel(periodDate, periodGranularity);
    }, [periodDate, periodGranularity, t]);
    useEffect(() => {
        if (!periodDropdown)
            return;
        const onDoc = (e) => {
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target))
                setPeriodDropdown(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [periodDropdown]);
    return (_jsxs("div", { className: "tt-reports tt-statistics", "aria-label": t('timeTrackingPage.statistics.pageAria'), children: [_jsxs("div", { className: "tt-reports__type-block", children: [_jsx("p", { className: "tt-reports__type-block-title", id: "tt-stats-section-heading", children: t('timeTrackingPage.statistics.sectionTitle') }), _jsx("nav", { className: "tt-reports__type-nav", role: "tablist", "aria-labelledby": "tt-stats-section-heading", children: STATS_TABS.map((tab) => (_jsx("button", { type: "button", role: "tab", id: `tt-stats-tab-${tab.id}`, "aria-selected": activeTab === tab.id, "aria-controls": "tt-stats-tabpanel", className: `tt-reports__type-tab${activeTab === tab.id ? ' tt-reports__type-tab--active' : ''}`, onClick: () => setActiveTab(tab.id), children: t(tab.labelKey) }, tab.id))) })] }), _jsxs("div", { className: "tt-reports__header", children: [_jsxs("div", { className: "tt-reports__header-left", children: [_jsx("button", { type: "button", className: "tt-reports__nav-btn", onClick: () => setPeriodDate((d) => shiftPeriodDate(d, periodGranularity, -1)), disabled: periodGranularity === 'all', "aria-label": t('timeTrackingPage.reports.header.prevPeriod'), children: _jsx(IcoChevLeft, {}) }), _jsx("h2", { className: "tt-reports__period-title", children: periodTitle }), _jsx("button", { type: "button", className: "tt-reports__nav-btn", onClick: () => setPeriodDate((d) => shiftPeriodDate(d, periodGranularity, 1)), disabled: periodGranularity === 'all', "aria-label": t('timeTrackingPage.reports.header.nextPeriod'), children: _jsx(IcoChevRight, {}) })] }), _jsx("div", { className: "tt-reports__header-right", children: _jsxs("div", { className: "tt-reports__period-dropdown-wrap", ref: periodDropdownRef, children: [_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown", onClick: () => setPeriodDropdown((v) => !v), "aria-expanded": periodDropdown, children: [ttReportPeriodLabel(periodGranularity, t), " ", _jsx(IcoChevDown, {})] }), periodDropdown ? (_jsx("div", { className: "tt-reports__period-dropdown", role: "listbox", children: PERIOD_OPTIONS.map((opt) => (_jsx("button", { type: "button", role: "option", "aria-selected": periodGranularity === opt.id, className: `tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`, onClick: () => {
                                            setPeriodGranularity(opt.id);
                                            setPeriodDropdown(false);
                                        }, children: ttReportPeriodLabel(opt.id, t) }, opt.id))) })) : null] }) })] }), _jsx("div", { id: "tt-stats-tabpanel", role: "tabpanel", className: "tt-statistics__tab-panel", "aria-labelledby": `tt-stats-tab-${activeTab}`, children: activeTab === 'project' ? (_jsx(ProjectStatisticsSection, { dateFrom: dateFrom, dateTo: dateTo })) : activeTab === 'team' ? (_jsx(TeamStatisticsSection, { dateFrom: dateFrom, dateTo: dateTo })) : activeTab === 'user' ? (_jsx(UserStatisticsSection, { dateFrom: dateFrom, dateTo: dateTo })) : (_jsx("div", { className: "tt-statistics-project__empty", role: "status", children: _jsx("p", { className: "tt-statistics-project__empty-title", children: t('timeTrackingPage.statistics.tabPlaceholder') }) })) }, activeTab)] }));
}
