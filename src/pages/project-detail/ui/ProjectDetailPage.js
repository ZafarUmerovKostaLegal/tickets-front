import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useCallback, useEffect, useRef, useId, lazy, Suspense } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams, } from 'react-router-dom';
import { listColleaguesAsUsers } from '@entities/contacts';
import { routes, getProjectDetailUrl } from '@shared/config';
import { useI18n, ttProjectTypeLabel } from '@shared/i18n';
import { formatDecimalHoursAsHm } from '@shared/lib/formatTrackingHours';
import { waitForAppFonts } from '@shared/lib/waitForAppFonts';
import { useCurrentUser } from '@shared/hooks';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog, DatePicker, SearchableSelect, navigateWithTransition } from '@shared/ui';
import { periodToDates, reportsAllTimeDateFrom, reportsAllTimeDateTo } from '@entities/time-tracking/lib/reportsPeriodRange';
import { canAccessTimeTracking, canManageTimeTrackingClients, hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { INVOICE_STATUS_LABELS, getClientProject, getClientProjectDashboard, getProjectTeamWorkload, listTimeTrackingUsers, listUsersWithProjectAccessToProject, listPartnerUsersWithProjectAccessToProject, listPartnerReportConfirmationsPendingItems, listPartnerReportConfirmationsConfirmed, confirmPartnerReportConfirmation, submitPartnerReportConfirmationFromPreview, parsePartnerReportConfirmationRequest, createClientProject, patchClientProject, deleteClientProject, getTimeManagerClient, readTimeManagerProjectBillableRateAmount, readProjectRecordsLanguage, notifyPartnerConfirmedReportsListInvalidate, exportReportV2, isStubAuthUserEmail, pickUserDisplayLabel, } from '@entities/time-tracking';
import { writeReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import { ClientProjectModal } from '@pages/time-tracking/ui/TimeTrackingClientProjectModal';
import { loadProjectDetailRow } from '../model/loadProjectDetailRow';
import { buildProjectArchiveTogglePatch, buildProjectPauseTogglePatch } from '@entities/time-tracking/lib/projectArchiveRestore';
import { memberWeeklyCapacityHours } from '@entities/time-tracking/model/memberWeeklyCapacity';
import { summaryTeamWeeklyCapacityHours } from '@entities/time-tracking/model/summaryTeamWeeklyCapacity';
import { TimeUsersSummary } from '@pages/time-tracking/ui/TimeUsersSummary';
import { TimeUsersTable } from '@pages/time-tracking/ui/TimeUsersTable';
import '@pages/time-tracking/ui/TimeUsersShared.css';
import './ProjectDetailPage.css';
import { ProjectDuplicatesPanel } from './ProjectDuplicatesPanel';
const ProjectDetailCharts = lazy(() => import('./ProjectDetailCharts').then((m) => ({ default: m.ProjectDetailCharts })));
function navigateBackToProjects(navigate) {
    navigateWithTransition(navigate, { pathname: routes.timeTracking, search: '?tab=projects' });
}
function fmtAmt(n, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}
function fmtMoney(n, cur) {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}
function memberInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const a = parts[0][0];
        const b = parts[parts.length - 1][0];
        if (a && b)
            return (a + b).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2)
        return parts[0].slice(0, 2).toUpperCase();
    const t = name.trim();
    return t ? t.slice(0, 2).toUpperCase() : '—';
}
function defaultProjectTeamPeriod() {
    // Align with reports: full current calendar month (not month-to-date).
    const { dateFrom, dateTo } = periodToDates(new Date(), 'month');
    return { from: dateFrom, to: dateTo };
}
function fullProjectTeamPeriod() {
    const now = new Date();
    return {
        from: reportsAllTimeDateFrom(now),
        to: reportsAllTimeDateTo(now),
    };
}
const PDP_PERIOD_PRESETS = [
    { id: 'week', label: 'Эта неделя' },
    { id: 'month', label: 'Этот месяц' },
    { id: 'quarter', label: 'Этот квартал' },
    { id: 'year', label: 'Этот год' },
    { id: 'all', label: 'За всё время' },
];
function periodPresetToRange(id) {
    if (id === 'all')
        return fullProjectTeamPeriod();
    // Same calendar bounds as Reports «Этот месяц/неделя/…» (full period, not MTD).
    const { dateFrom, dateTo } = periodToDates(new Date(), id);
    return { from: dateFrom, to: dateTo };
}
function formatDetailPeriodLabel(period) {
    const parse = (s) => {
        const [y, m, d] = s.slice(0, 10).split('-').map((x) => parseInt(x, 10));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
            return new Date(NaN);
        return new Date(y, m - 1, d);
    };
    const a = parse(period.from);
    const b = parse(period.to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()))
        return '';
    const left = a.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const right = b.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${left} — ${right}`;
}
function teamWorkloadMemberToTimeUserRow(m, periodDays, profileWeeklyHours, position, resolvedName) {
    const name = (resolvedName?.trim()
        || pickUserDisplayLabel(m.display_name, m.email, m.auth_user_id)).trim();
    const pos = position?.trim();
    return {
        id: String(m.auth_user_id),
        name,
        initials: memberInitials(name),
        avatarUrl: m.picture?.trim() || undefined,
        position: pos || undefined,
        hours: Number(m.total_hours),
        billableHours: Number(m.billable_hours),
        utilizationPercent: m.workload_percent,
        capacity: memberWeeklyCapacityHours(m, periodDays, profileWeeklyHours),
    };
}
function fmtDashboardBudgetValue(b) {
    if (b.budgetBy === 'none')
        return '—';
    if (b.budgetBy === 'hours_and_money' && b.money)
        return `${b.money.budget.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
    if (b.budgetBy === 'hours')
        return formatDecimalHoursAsHm(b.budget);
    return `${b.budget.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
}
function fmtDashboardBudgetSpentRemaining(b, value) {
    if (b.budgetBy === 'none')
        return '—';
    if (b.budgetBy === 'hours_and_money' && b.money)
        return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
    if (b.budgetBy === 'hours')
        return formatDecimalHoursAsHm(value);
    return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
}
function deriveDashboardBudgetSliceRemaining(slice) {
    const { budget, spent } = slice;
    if (Number.isFinite(budget) && budget > 0 && Number.isFinite(spent))
        return budget - spent;
    return slice.remaining;
}
function deriveDashboardBudgetHeadlineRemaining(b) {
    if (b.budgetBy === 'hours_and_money' && b.money)
        return deriveDashboardBudgetSliceRemaining(b.money);
    if (Number.isFinite(b.budget) && b.budget > 0 && Number.isFinite(b.spent))
        return b.budget - b.spent;
    return b.remaining;
}
function buildWeeks(weeks) {
    const now = new Date();
    let prevMonth = -1;
    return Array.from({ length: weeks }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (weeks - 1 - i) * 7);
        const month = d.getMonth();
        const isMonthStart = month !== prevMonth;
        prevMonth = month;
        const dayLabel = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        const monthName = d.toLocaleDateString('ru-RU', { month: 'short' });
        const year = String(d.getFullYear());
        return { idx: i, dayLabel, value: 0, isThisWeek: i === weeks - 1, isMonthStart, monthName, year };
    });
}
function isWeekContainingToday(weekStartIso) {
    const day = weekStartIso.slice(0, 10);
    const parts = day.split('-').map((x) => parseInt(x, 10));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n)))
        return false;
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
}
function buildChartDataFromDashboard(dashboard) {
    const prog = dashboard.progressByWeek.filter((x) => x.weekStart);
    const hrs = dashboard.hoursByWeek.filter((x) => x.weekStart);
    const order = [];
    const seen = new Set();
    for (const x of prog) {
        if (!seen.has(x.weekStart)) {
            order.push(x.weekStart);
            seen.add(x.weekStart);
        }
    }
    for (const x of hrs) {
        if (!seen.has(x.weekStart)) {
            order.push(x.weekStart);
            seen.add(x.weekStart);
        }
    }
    if (order.length === 0) {
        return emptyDashboardCharts();
    }
    const progBy = new Map(prog.map((x) => [x.weekStart, x.cumulativeBillableAmount]));
    const hrsByRow = new Map(hrs.map((x) => [x.weekStart, x]));
    const weeksWithHoursSplit = new Set();
    for (const x of hrs) {
        const bh = x.billableHours ?? 0;
        const nb = x.nonBillableHours ?? 0;
        if (bh > 0 || nb > 0)
            weeksWithHoursSplit.add(x.weekStart);
    }
    const useStackedHoursChart = weeksWithHoursSplit.size > 0;
    const maxMoneyAlongSeries = Math.max(0, ...order.map((ws) => progBy.get(ws) ?? 0));
    const totalBillableHoursInSeries = order.reduce((s, ws) => s + (hrsByRow.get(ws)?.billableHours ?? 0), 0);
    const useHoursProgress = maxMoneyAlongSeries <= 0 &&
        totalBillableHoursInSeries > 0 &&
        (dashboard.totals.billableAmount ?? 0) <= 0;
    let prevMonthP = -1;
    let cumBillableH = 0;
    const progressData = order.map((ws, idx) => {
        const d = new Date(`${ws}T12:00:00`);
        const month = d.getMonth();
        const isMonthStart = month !== prevMonthP;
        prevMonthP = month;
        const dayLabel = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        const monthName = d.toLocaleDateString('ru-RU', { month: 'short' });
        const year = String(d.getFullYear());
        if (useHoursProgress) {
            cumBillableH += hrsByRow.get(ws)?.billableHours ?? 0;
        }
        return {
            idx,
            dayLabel,
            value: useHoursProgress ? cumBillableH : (progBy.get(ws) ?? 0),
            isThisWeek: isWeekContainingToday(ws),
            isMonthStart,
            monthName,
            year,
        };
    });
    const progressMode = useHoursProgress ? 'billable_hours_cumulative' : 'money';
    let prevMonthH = -1;
    const hoursData = order.map((ws, idx) => {
        const d = new Date(`${ws}T12:00:00`);
        const month = d.getMonth();
        const isMonthStart = month !== prevMonthH;
        prevMonthH = month;
        const dayLabel = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        const monthName = d.toLocaleDateString('ru-RU', { month: 'short' });
        const year = String(d.getFullYear());
        const row = hrsByRow.get(ws);
        const totalH = row?.hours ?? 0;
        const bh = row?.billableHours ?? 0;
        const nb = row?.nonBillableHours ?? 0;
        if (useStackedHoursChart) {
            const hasSplit = weeksWithHoursSplit.has(ws);
            const stackB = hasSplit ? bh : totalH;
            const stackN = hasSplit ? nb : 0;
            const stackedTotal = stackB + stackN;
            return {
                idx,
                dayLabel,
                value: stackedTotal,
                stackBillable: stackB,
                stackNonBillable: stackN,
                isThisWeek: isWeekContainingToday(ws),
                isMonthStart,
                monthName,
                year,
            };
        }
        return {
            idx,
            dayLabel,
            value: totalH,
            isThisWeek: isWeekContainingToday(ws),
            isMonthStart,
            monthName,
            year,
        };
    });
    return { progressData, hoursData, progressMode };
}
const IcoEdit = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
const IcoChevron = () => (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
const IcoInfo = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }));
function dashboardTasksToTaskRows(tasks, currency) {
    const billable = [];
    const nonBillable = [];
    for (const t of tasks) {
        const members = (t.members ?? []).map((m) => ({
            userId: m.userId,
            name: m.name,
            hours: m.hours,
            billableAmt: m.billableAmount,
            costs: m.internalCostAmount,
        }));
        const row = {
            id: t.taskId,
            name: t.name,
            hours: t.hours,
            billableAmt: t.billableAmount,
            costs: t.internalCostAmount,
            currency,
            billable: t.billable,
            expandable: t.hours > 0 && members.length > 0,
            members,
        };
        if (t.billable)
            billable.push(row);
        else
            nonBillable.push(row);
    }
    return { billable, nonBillable };
}
function dashboardTasksAggregateFromTotals(totals, currency) {
    const billable = [];
    const nonBillable = [];
    if (totals.totalHours > 0 &&
        totals.billableHours <= 0 &&
        totals.nonBillableHours <= 0) {
        billable.push({
            id: '__agg-total-hours',
            name: 'Часы (сводно)',
            hours: totals.totalHours,
            billableAmt: totals.billableAmount,
            costs: 0,
            currency,
            billable: true,
            expandable: false,
            members: [],
        });
        return { billable, nonBillable };
    }
    if (totals.billableHours > 0) {
        billable.push({
            id: '__agg-billable',
            name: 'Оплачиваемые (сводно)',
            hours: totals.billableHours,
            billableAmt: totals.billableAmount,
            costs: 0,
            currency,
            billable: true,
            expandable: false,
            members: [],
        });
    }
    if (totals.nonBillableHours > 0) {
        nonBillable.push({
            id: '__agg-non-billable',
            name: 'Неоплачиваемые (сводно)',
            hours: totals.nonBillableHours,
            billableAmt: 0,
            costs: 0,
            currency,
            billable: false,
            expandable: false,
            members: [],
        });
    }
    return { billable, nonBillable };
}
function isLinkableMemberUserId(userId) {
    const n = Number(String(userId ?? '').trim());
    return Number.isFinite(n) && n > 0;
}
function renderTaskTableRows(rows, expanded, toggle, onOpenMemberReport) {
    return rows.flatMap((r) => {
        const isOpen = expanded.has(r.id);
        const mainRow = (_jsxs("tr", { className: `pdp__tasks-row${isOpen ? ' pdp__tasks-row--expanded' : ''}`, children: [_jsxs("td", { className: "pdp__tasks-td pdp__tasks-td--name", children: [r.expandable ? (_jsx("button", { type: "button", className: `pdp__tasks-expand${isOpen ? ' pdp__tasks-expand--open' : ''}`, onClick: () => toggle(r.id), "aria-expanded": isOpen, "aria-label": isOpen ? 'Свернуть детализацию' : 'Развернуть детализацию', children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M9 18l6-6-6-6" }) }) })) : (_jsx("span", { className: "pdp__tasks-expand-placeholder" })), r.expandable ? (_jsx("button", { type: "button", className: "pdp__tasks-name-btn", onClick: () => toggle(r.id), "aria-expanded": isOpen, children: r.name })) : r.name] }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--hours", children: r.hours > 0 ? (_jsx("button", { type: "button", className: "pdp__tasks-hours-link", onClick: () => r.expandable && toggle(r.id), children: formatDecimalHoursAsHm(r.hours) })) : (_jsx("span", { className: "pdp__tasks-zero", children: formatDecimalHoursAsHm(0) })) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--amt", children: r.billableAmt > 0 ? (_jsx("span", { className: "pdp__tasks-num", children: fmtMoney(r.billableAmt, r.currency) })) : (_jsx("span", { className: "pdp__tasks-zero", children: fmtMoney(0, r.currency) })) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--costs", children: _jsxs("span", { className: "pdp__tasks-cost-with-icon", children: [r.costs > 0 ? (_jsx("span", { className: "pdp__tasks-num", children: fmtMoney(r.costs, r.currency) })) : (_jsx("span", { className: "pdp__tasks-zero", children: fmtMoney(0, r.currency) })), _jsx("span", { className: "pdp__tasks-warn-slot pdp__tasks-warn-slot--empty", "aria-hidden": true })] }) })] }, r.id));
        if (!isOpen || !r.expandable)
            return [mainRow];
        const detailRows = r.members.map((m) => (_jsxs("tr", { className: "pdp__tasks-detail-row", children: [_jsxs("td", { className: "pdp__tasks-td pdp__tasks-td--name pdp__tasks-td--detail", children: [_jsx("span", { className: "pdp__tasks-detail-indent", "aria-hidden": true }), _jsx("span", { className: "pdp__tasks-detail-name", children: m.name })] }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--hours pdp__tasks-td--detail", children: m.hours > 0 && onOpenMemberReport && isLinkableMemberUserId(m.userId) ? (_jsx("button", { type: "button", className: "pdp__tasks-hours-link", title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442 \u043F\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443 \u0438 \u0437\u0430\u0434\u0430\u0447\u0435", onClick: () => onOpenMemberReport(r.id, m.userId), children: formatDecimalHoursAsHm(m.hours) })) : (_jsx("span", { className: "pdp__tasks-num", children: formatDecimalHoursAsHm(m.hours) })) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--amt pdp__tasks-td--detail", children: m.billableAmt > 0 ? (_jsx("span", { className: "pdp__tasks-num", children: fmtMoney(m.billableAmt, r.currency) })) : (_jsx("span", { className: "pdp__tasks-zero", children: fmtMoney(0, r.currency) })) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--costs pdp__tasks-td--detail", children: _jsxs("span", { className: "pdp__tasks-cost-with-icon", children: [m.costs > 0 ? (_jsx("span", { className: "pdp__tasks-num", children: fmtMoney(m.costs, r.currency) })) : (_jsx("span", { className: "pdp__tasks-zero", children: fmtMoney(0, r.currency) })), _jsx("span", { className: "pdp__tasks-warn-slot pdp__tasks-warn-slot--empty", "aria-hidden": true })] }) })] }, `${r.id}-${m.userId}`)));
        return [mainRow, ...detailRows];
    });
}
function TasksPanel({ rows, nonBillableRows, totalHours, totalAmt, currency, periodSubtitle, breakdownHint, onOpenMemberReport, onPreviewEntries, activePeriodPresetId, activePeriodPresetLabel, onSelectPeriodPreset, onExport, exportBusy, }) {
    const [expanded, setExpanded] = useState(new Set());
    const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const periodMenuRef = useRef(null);
    const exportMenuRef = useRef(null);
    useEffect(() => {
        if (!periodMenuOpen && !exportMenuOpen)
            return;
        const onDoc = (e) => {
            const t = e.target;
            if (periodMenuOpen && periodMenuRef.current && !periodMenuRef.current.contains(t))
                setPeriodMenuOpen(false);
            if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(t))
                setExportMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [periodMenuOpen, exportMenuOpen]);
    const toggle = useCallback((id) => {
        setExpanded(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }, []);
    const nonBillTotal = nonBillableRows.reduce((s, r) => s + r.hours, 0);
    const billableTotalCosts = rows.reduce((s, r) => s + r.costs, 0);
    const nonBillTotalAmt = nonBillableRows.reduce((s, r) => s + r.billableAmt, 0);
    const nonBillTotalCosts = nonBillableRows.reduce((s, r) => s + r.costs, 0);
    const costsWarnTitle = 'Оценка внутренних затрат: при неполных данных по ставкам сотрудников сумма может быть уточнена позже.';
    return (_jsxs("div", { className: "pdp__tasks pdp__tasks-panel", children: [_jsxs("div", { className: "pdp__tasks-toolbar", children: [_jsxs("div", { className: "pdp__tasks-toolbar-left", children: [_jsx("span", { className: "pdp__tasks-heading", children: "\u0417\u0430\u0434\u0430\u0447\u0438 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0443" }), _jsx("span", { className: "pdp__tasks-subheading", children: periodSubtitle ?? 'За всё время' })] }), _jsxs("div", { className: "pdp__tasks-toolbar-right", children: [onPreviewEntries ? (_jsxs("button", { type: "button", className: "pdp__tasks-preview-btn", onClick: onPreviewEntries, title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0432\u0441\u0435\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }), "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0437\u0430\u043F\u0438\u0441\u0435\u0439"] })) : null, _jsxs("div", { className: "pdp__period-preset-wrap", ref: periodMenuRef, children: [_jsxs("button", { type: "button", className: `pdp__tasks-filter-btn${periodMenuOpen ? ' pdp__tasks-filter-btn--open' : ''}`, onClick: () => setPeriodMenuOpen((v) => !v), "aria-expanded": periodMenuOpen, "aria-haspopup": "menu", children: [activePeriodPresetLabel, _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), periodMenuOpen ? (_jsx("div", { className: "pdp__period-preset-menu", role: "menu", children: PDP_PERIOD_PRESETS.map((p) => (_jsx("button", { type: "button", role: "menuitemradio", "aria-checked": activePeriodPresetId === p.id, className: `pdp__period-preset-item${activePeriodPresetId === p.id ? ' pdp__period-preset-item--active' : ''}`, onClick: () => {
                                                onSelectPeriodPreset(p.id);
                                                setPeriodMenuOpen(false);
                                            }, children: p.label }, p.id))) })) : null] }), _jsxs("div", { className: "pdp__period-preset-wrap", ref: exportMenuRef, children: [_jsxs("button", { type: "button", className: `pdp__tasks-export-btn${exportMenuOpen ? ' pdp__tasks-export-btn--open' : ''}`, disabled: exportBusy, onClick: () => setExportMenuOpen((v) => !v), "aria-expanded": exportMenuOpen, "aria-haspopup": "menu", children: [exportBusy ? 'Экспорт…' : 'Экспорт', _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), exportMenuOpen && !exportBusy ? (_jsxs("div", { className: "pdp__period-preset-menu", role: "menu", children: [_jsx("button", { type: "button", role: "menuitem", className: "pdp__period-preset-item", onClick: () => {
                                                    setExportMenuOpen(false);
                                                    onExport('xlsx');
                                                }, children: "Excel (.xlsx)" }), _jsx("button", { type: "button", role: "menuitem", className: "pdp__period-preset-item", onClick: () => {
                                                    setExportMenuOpen(false);
                                                    onExport('csv');
                                                }, children: "CSV" })] })) : null] })] })] }), breakdownHint ? (_jsx("p", { className: "pdp__tasks-breakdown-hint", children: breakdownHint })) : null, _jsxs("div", { className: "pdp__tasks-sections", children: [_jsxs("section", { className: "pdp__tasks-section", "aria-labelledby": "pdp-tasks-billable-heading", children: [_jsx("div", { className: "pdp__tasks-section__head", children: _jsx("h3", { id: "pdp-tasks-billable-heading", className: "pdp__tasks-section__title", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438" }) }), _jsx("div", { className: "pdp__tasks-section__table-wrap", children: _jsxs("table", { className: "pdp__tasks-table", children: [_jsxs("colgroup", { children: [_jsx("col", { className: "pdp__tasks-col pdp__tasks-col--name" }), _jsx("col", { className: "pdp__tasks-col pdp__tasks-col--hours" }), _jsx("col", { className: "pdp__tasks-col pdp__tasks-col--amt" }), _jsx("col", { className: "pdp__tasks-col pdp__tasks-col--costs" })] }), _jsx("thead", { children: _jsxs("tr", { className: "pdp__tasks-thead", children: [_jsx("th", { className: "pdp__tasks-th pdp__tasks-th--name", children: "\u0417\u0430\u0434\u0430\u0447\u0430" }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--hours", children: _jsxs("span", { className: "pdp__tasks-th-hours-label", children: ["\u0427\u0430\u0441\u044B", _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", className: "pdp__tasks-sort", children: _jsx("path", { d: "M18 15l-6-6-6 6" }) })] }) }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--amt", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0441\u0443\u043C\u043C\u0430" }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--costs", children: "\u0417\u0430\u0442\u0440\u0430\u0442\u044B" })] }) }), _jsxs("tbody", { children: [rows.length === 0 && (_jsx("tr", { className: "pdp__tasks-placeholder-row", children: _jsx("td", { className: "pdp__tasks-placeholder-cell", colSpan: 4, children: _jsx("p", { className: "pdp__tasks-placeholder-text", children: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0445 \u0437\u0430\u0434\u0430\u0447 \u0441 \u0447\u0430\u0441\u0430\u043C\u0438 \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434." }) }) })), renderTaskTableRows(rows, expanded, toggle, onOpenMemberReport), _jsxs("tr", { className: "pdp__tasks-total-row", children: [_jsx("td", { className: "pdp__tasks-td pdp__tasks-td--name", children: _jsx("strong", { children: "\u0418\u0442\u043E\u0433\u043E" }) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--hours", children: totalHours > 0 ? (_jsx("button", { type: "button", className: "pdp__tasks-hours-link pdp__tasks-hours-link--bold", children: formatDecimalHoursAsHm(totalHours) })) : (_jsx("span", { className: "pdp__tasks-zero", children: formatDecimalHoursAsHm(totalHours) })) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--amt", children: _jsx("strong", { className: "pdp__tasks-num", children: fmtMoney(totalAmt, currency) }) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--costs", children: _jsxs("span", { className: "pdp__tasks-cost-with-icon", children: [_jsx("strong", { className: "pdp__tasks-num", children: billableTotalCosts > 0
                                                                            ? fmtMoney(billableTotalCosts, currency)
                                                                            : fmtMoney(0, currency) }), _jsx("span", { className: "pdp__tasks-warn-slot", children: _jsx("button", { type: "button", className: "pdp__tasks-warn-btn", title: costsWarnTitle, "aria-label": costsWarnTitle, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", className: "pdp__tasks-warn", children: [_jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), _jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), _jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })] }) }) })] }) })] })] })] }) })] }), _jsxs("section", { className: "pdp__tasks-section", "aria-labelledby": "pdp-tasks-nonbill-heading", children: [_jsx("div", { className: "pdp__tasks-section__head", children: _jsx("h3", { id: "pdp-tasks-nonbill-heading", className: "pdp__tasks-section__title", children: "\u041D\u0435\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438" }) }), _jsx("div", { className: "pdp__tasks-section__table-wrap", children: _jsxs("table", { className: "pdp__tasks-table", children: [_jsxs("colgroup", { children: [_jsx("col", { className: "pdp__tasks-col pdp__tasks-col--name" }), _jsx("col", { className: "pdp__tasks-col pdp__tasks-col--hours" }), _jsx("col", { className: "pdp__tasks-col pdp__tasks-col--amt" }), _jsx("col", { className: "pdp__tasks-col pdp__tasks-col--costs" })] }), _jsx("thead", { children: _jsxs("tr", { className: "pdp__tasks-thead", children: [_jsx("th", { className: "pdp__tasks-th pdp__tasks-th--name", children: "\u0417\u0430\u0434\u0430\u0447\u0430" }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--hours", children: _jsxs("span", { className: "pdp__tasks-th-hours-label", children: ["\u0427\u0430\u0441\u044B", _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", className: "pdp__tasks-sort", children: _jsx("path", { d: "M18 15l-6-6-6 6" }) })] }) }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--amt", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u0430\u044F \u0441\u0443\u043C\u043C\u0430" }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--costs", children: "\u0417\u0430\u0442\u0440\u0430\u0442\u044B" })] }) }), _jsxs("tbody", { children: [nonBillableRows.length === 0 && (_jsx("tr", { className: "pdp__tasks-placeholder-row", children: _jsx("td", { className: "pdp__tasks-placeholder-cell", colSpan: 4, children: _jsx("p", { className: "pdp__tasks-placeholder-text", children: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043D\u0435\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0445 \u0437\u0430\u0434\u0430\u0447 \u0441 \u0447\u0430\u0441\u0430\u043C\u0438 \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434." }) }) })), renderTaskTableRows(nonBillableRows, expanded, toggle, onOpenMemberReport), _jsxs("tr", { className: "pdp__tasks-total-row", children: [_jsx("td", { className: "pdp__tasks-td pdp__tasks-td--name", children: _jsx("strong", { children: "\u0418\u0442\u043E\u0433\u043E" }) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--hours", children: _jsx("span", { className: nonBillTotal > 0 ? 'pdp__tasks-hours-link' : 'pdp__tasks-zero', children: formatDecimalHoursAsHm(nonBillTotal) }) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--amt", children: _jsx("strong", { className: "pdp__tasks-num", children: nonBillTotalAmt > 0 ? fmtMoney(nonBillTotalAmt, currency) : fmtMoney(0, currency) }) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--costs", children: _jsxs("span", { className: "pdp__tasks-cost-with-icon", children: [_jsx("strong", { className: "pdp__tasks-num", children: nonBillTotalCosts > 0 ? fmtMoney(nonBillTotalCosts, currency) : fmtMoney(0, currency) }), _jsx("span", { className: "pdp__tasks-warn-slot pdp__tasks-warn-slot--empty", "aria-hidden": true })] }) })] })] })] }) })] })] })] }));
}
const TYPE_COLOR = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Пакет часов': { color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
};
function duplicateProjectCreatePayload(src) {
    const amt = src.budget_amount != null && String(src.budget_amount).trim() !== ''
        ? src.budget_amount
        : (src.project_type === 'fixed_fee' && src.fixed_fee_amount != null && String(src.fixed_fee_amount).trim() !== ''
            ? src.fixed_fee_amount
            : null);
    const progRaw = src.progress_budget_amount ?? src.progressBudgetAmount;
    const prog = progRaw != null && String(progRaw).trim() !== ''
        ? progRaw
        : null;
    return {
        name: `${String(src.name ?? '').trim()} (копия)`,
        code: null,
        currency: src.currency,
        startDate: src.start_date ? src.start_date.slice(0, 10) : null,
        endDate: null,
        notes: src.notes,
        reportVisibility: src.report_visibility,
        recordsLanguage: readProjectRecordsLanguage(src),
        projectType: src.project_type,
        billableRateType: src.billable_rate_type,
        projectBillableRateAmount: readTimeManagerProjectBillableRateAmount(src).trim() || null,
        budgetAmount: amt,
        progressBudgetAmount: prog,
        budgetHours: src.budget_hours,
        budgetResetsEveryMonth: src.budget_resets_every_month,
        budgetIncludesExpenses: src.budget_includes_expenses,
        sendBudgetAlerts: src.send_budget_alerts,
        budgetAlertThresholdPercent: src.budget_alert_threshold_percent,
        ...(src.project_type === 'hour_package'
            ? {
                packageHoursPerMonth: src.package_hours_per_month ?? src.packageHoursPerMonth ?? src.budget_hours,
                packageFeeAmount: src.package_fee_amount ?? src.packageFeeAmount ?? amt,
            }
            : {}),
    };
}
function emptyDashboardCharts() {
    const z = buildWeeks(13).map((w) => ({ ...w, value: 0 }));
    return { progressData: z, hoursData: z, progressMode: 'money' };
}
function partnerConfirmPeriodMatches(req, from, to) {
    return req.dateFrom === from.slice(0, 10) && req.dateTo === to.slice(0, 10);
}
function partnerConfirmSessionKey(projectId, from, to) {
    return `tt-partner-confirm:${projectId.trim()}:${from.slice(0, 10)}:${to.slice(0, 10)}`;
}
function loadPartnerConfirmFromSession(projectId, from, to) {
    try {
        const raw = sessionStorage.getItem(partnerConfirmSessionKey(projectId, from, to));
        if (!raw)
            return null;
        return parsePartnerReportConfirmationRequest(JSON.parse(raw));
    }
    catch {
        return null;
    }
}
function savePartnerConfirmToSession(projectId, from, to, req) {
    try {
        sessionStorage.setItem(partnerConfirmSessionKey(projectId, from, to), JSON.stringify(req));
    }
    catch {
    }
}
function ProjectPartnerReportPanel({ projectId, detailPeriod, currentUserId, }) {
    const { showAlert, showConfirm } = useAppDialog();
    const [partners, setPartners] = useState([]);
    const [partnersLoad, setPartnersLoad] = useState('loading');
    const [pendingReqs, setPendingReqs] = useState([]);
    const [confirmedReqs, setConfirmedReqs] = useState([]);
    const [listsLoad, setListsLoad] = useState('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState(null);
    const periodFrom = detailPeriod.from.slice(0, 10);
    const periodTo = detailPeriod.to.slice(0, 10);
    const pid = projectId.trim();
    useEffect(() => {
        let cancelled = false;
        setPartnersLoad('loading');
        void listPartnerUsersWithProjectAccessToProject(projectId).then((rows) => {
            if (!cancelled) {
                setPartners(rows);
                setPartnersLoad('ok');
            }
        }).catch(() => {
            if (!cancelled)
                setPartnersLoad('error');
        });
        return () => {
            cancelled = true;
        };
    }, [projectId]);
    useEffect(() => {
        setSessionSnapshot(loadPartnerConfirmFromSession(projectId, detailPeriod.from, detailPeriod.to));
    }, [projectId, detailPeriod.from, detailPeriod.to]);
    useEffect(() => {
        let cancelled = false;
        if (currentUserId == null) {
            setPendingReqs([]);
            setConfirmedReqs([]);
            setListsLoad('idle');
            return;
        }
        if (partnersLoad !== 'ok') {
            setListsLoad('idle');
            return;
        }
        if (!partners.some((p) => p.authUserId === currentUserId)) {
            setPendingReqs([]);
            setConfirmedReqs([]);
            setListsLoad('idle');
            return;
        }
        setListsLoad('loading');
        void Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]).then(([p, c]) => {
            if (!cancelled) {
                setPendingReqs(p);
                setConfirmedReqs(c);
                setListsLoad('ok');
            }
        }).catch(() => {
            if (!cancelled) {
                setPendingReqs([]);
                setConfirmedReqs([]);
                setListsLoad('error');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, detailPeriod.from, detailPeriod.to, currentUserId, partnersLoad, partners]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && partnerConfirmPeriodMatches(r, periodFrom, periodTo)), [pendingReqs, pid, periodFrom, periodTo]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && partnerConfirmPeriodMatches(r, periodFrom, periodTo)), [confirmedReqs, pid, periodFrom, periodTo]);
    const periodLabel = formatDetailPeriodLabel(detailPeriod);
    const mySig = useMemo(() => {
        if (currentUserId == null)
            return undefined;
        const hit = (req) => req?.signatures.find((s) => s.partnerAuthUserId === currentUserId);
        return hit(confirmedForProject) ?? hit(pendingForProject) ?? hit(sessionSnapshot);
    }, [currentUserId, confirmedForProject, pendingForProject, sessionSnapshot]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const refreshConfirmationLists = async () => {
        const [p, c] = await Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]);
        setPendingReqs(p);
        setConfirmedReqs(c);
    };
    const showPartnerConfirmBtn = listsLoad === 'ok' && !fullyConfirmed && !mySig;
    const handleConfirmReport = async () => {
        if (confirmBusy || !showPartnerConfirmBtn)
            return;
        const ok = await showConfirm({
            title: 'Подтвердить принятие отчёта?',
            message: periodLabel ? `Вы подтверждаете принятие отчётности за период ${periodLabel}. После подписей всех партнёров отчёт попадает в список подтверждённых.` : 'Вы подтверждаете принятие отчётности за выбранный период. После подписей всех партнёров отчёт попадает в список подтверждённых.',
            confirmLabel: 'Подтвердить',
        });
        if (!ok)
            return;
        setConfirmBusy(true);
        try {
            let requestId = pendingForProject?.id;
            if (!requestId) {
                const created = await submitPartnerReportConfirmationFromPreview({
                    projectId: pid,
                    dateFrom: periodFrom,
                    dateTo: periodTo,
                });
                requestId = created.id;
                await refreshConfirmationLists();
            }
            if (!requestId) {
                await showAlert({ message: 'Не удалось получить запрос подтверждения.' });
                return;
            }
            const out = await confirmPartnerReportConfirmation(requestId);
            savePartnerConfirmToSession(pid, periodFrom, periodTo, out);
            setSessionSnapshot(out);
            await refreshConfirmationLists();
            if (out.status === 'fully_confirmed')
                notifyPartnerConfirmedReportsListInvalidate();
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось отправить подтверждение.',
            });
        }
        finally {
            setConfirmBusy(false);
        }
    };
    const fmtConfirmed = (iso) => {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime()))
                return iso;
            return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
        }
        catch {
            return iso;
        }
    };
    if (currentUserId == null)
        return null;
    if (partnersLoad === 'idle' || partnersLoad === 'loading')
        return null;
    if (partnersLoad === 'error')
        return null;
    if (!partners.some((p) => p.authUserId === currentUserId))
        return null;
    const partnerActions = (_jsxs("div", { className: "pdp__partner-report-actions", children: [listsLoad === 'loading' ? (_jsx("span", { className: "pdp__partner-report-status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u043D\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435\u2026" })) : null, listsLoad === 'error' ? (_jsx("span", { className: "pdp__partner-report-muted pdp__partner-report-muted--error", role: "alert", children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0439 \u043E\u0442\u0447\u0451\u0442\u043E\u0432." })) : null, showPartnerConfirmBtn ? (_jsx("button", { type: "button", className: "pdp__partner-report-btn", onClick: () => void handleConfirmReport(), disabled: confirmBusy, children: confirmBusy ? 'Отправка…' : 'Подтвердить принятие отчёта' })) : null, listsLoad === 'ok' && fullyConfirmed && mySig ? (_jsxs("span", { className: "pdp__partner-report-status pdp__partner-report-status--ok", children: ["\u0412\u0441\u0435 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u044B\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u044B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0438 \u043E\u0442\u0447\u0451\u0442 \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434. \u0412\u0430\u0448\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u044C: ", fmtConfirmed(mySig.confirmedAt), "."] })) : null, listsLoad === 'ok' && fullyConfirmed && !mySig ? (_jsx("span", { className: "pdp__partner-report-status pdp__partner-report-status--ok", children: "\u041E\u0442\u0447\u0451\u0442 \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430\u043C\u0438." })) : null, listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig ? (_jsxs("span", { className: "pdp__partner-report-status pdp__partner-report-status--ok", children: ["\u0412\u044B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B\u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0435 \u043E\u0442\u0447\u0451\u0442\u0430 (", fmtConfirmed(mySig.confirmedAt), "). \u041E\u0436\u0438\u0434\u0430\u044E\u0442\u0441\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0434\u0440\u0443\u0433\u0438\u0445 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432."] })) : null] }));
    return (_jsxs("section", { className: "pdp__partner-report", "aria-labelledby": "pdp-partner-report-heading", children: [_jsxs("div", { className: "pdp__partner-report-head", children: [_jsx("h2", { id: "pdp-partner-report-heading", className: "pdp__partner-report-title", children: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u0430" }), partnerActions] }), _jsx("p", { className: "pdp__partner-report-hint", children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043E\u0442\u0447\u0451\u0442 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043A\u0430\u043A \u043F\u0430\u0440\u0442\u043D\u0451\u0440. \u041F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0435\u0439 \u0432\u0441\u0435\u0445 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432 \u0437\u0430\u043F\u0438\u0441\u044C \u043F\u043E\u043F\u0430\u0434\u0430\u0435\u0442 \u0432 \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435; \u0442\u043E \u0436\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0438\u0437 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u043E\u0442\u0447\u0451\u0442\u0430." }), partners.length === 0 ? (_jsx("p", { className: "pdp__partner-report-muted", children: "\u041D\u0435\u0442 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432 \u0441 \u0434\u043E\u0441\u0442\u0443\u043F\u043E\u043C \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443." })) : (_jsx("ul", { className: "pdp__partner-report-list", children: partners.map((p) => (_jsxs("li", { className: "pdp__partner-report-item", children: [_jsx("span", { className: "pdp__partner-report-name", children: p.displayName }), p.position ? (_jsx("span", { className: "pdp__partner-report-pos", children: p.position })) : null, currentUserId === p.authUserId ? (_jsx("span", { className: "pdp__partner-report-you", children: "\u0412\u044B" })) : null] }, p.authUserId))) }))] }));
}
function ProjectDetailPageSkeleton() {
    return (_jsxs("div", { className: "pdp pdp--loading", "aria-busy": "true", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430", children: [_jsxs("header", { className: "pdp__header pdp__header--skeleton", children: [_jsxs("div", { className: "pdp__header-left", children: [_jsx("span", { className: "pdp__skel pdp__skel--back", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--title", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--badge", "aria-hidden": true })] }), _jsxs("div", { className: "pdp__header-right", children: [_jsx("span", { className: "pdp__skel pdp__skel--btn", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--btn", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--btn", "aria-hidden": true })] })] }), _jsxs("div", { className: "pdp__body pdp__body--skeleton", children: [_jsx("span", { className: "pdp__skel pdp__skel--chart", "aria-hidden": true }), _jsxs("div", { className: "pdp__skel-stats", children: [_jsx("span", { className: "pdp__skel pdp__skel--stat", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--stat", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--stat", "aria-hidden": true }), _jsx("span", { className: "pdp__skel pdp__skel--stat", "aria-hidden": true })] })] })] }));
}
function ProjectDetailBody({ project, dashboard, dashboardError, detailPeriod, onDetailPeriodChange, canManageInvoices, canManageProjects, onProjectRefresh, currentUserId, dashboardRefreshing, }) {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAppDialog();
    const openMemberDetailReport = useCallback((taskId, userId) => {
        const uid = String(userId ?? '').trim();
        if (!uid || !Number.isFinite(Number(uid)))
            return;
        const tid = String(taskId ?? '').trim();
        const filters = {
            dateFrom: detailPeriod.from.slice(0, 10),
            dateTo: detailPeriod.to.slice(0, 10),
            project_id: project.id,
            user_id: uid,
            task_id: tid || undefined,
            page: 1,
            per_page: 100,
        };
        const payload = { v: 2, reportType: 'time', groupBy: 'projects', filters };
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }, [project.id, detailPeriod.from, detailPeriod.to, navigate]);
    const openProjectPeriodReport = useCallback(() => {
        const filters = {
            dateFrom: detailPeriod.from.slice(0, 10),
            dateTo: detailPeriod.to.slice(0, 10),
            project_id: project.id,
            page: 1,
            per_page: 100,
        };
        const payload = { v: 2, reportType: 'time', groupBy: 'projects', filters };
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }, [project.id, detailPeriod.from, detailPeriod.to, navigate]);
    const detailPeriodRangeId = useId();
    const { t } = useI18n();
    const backToProjectsLabel = t('timeTrackingPage.projects.newProjectPage.backToProjects');
    const onBackToProjects = useCallback(() => navigateBackToProjects(navigate), [navigate]);
    const [chartTab, setChartTab] = useState('progress');
    const [actionsOpen, setActionsOpen] = useState(false);
    const actionsMenuRef = useRef(null);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
    const periodMenuRef = useRef(null);
    const [editProjectRow, setEditProjectRow] = useState(null);
    const [editClientRow, setEditClientRow] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);
    useEffect(() => {
        if (!actionsOpen)
            return;
        const onDown = (e) => {
            const el = actionsMenuRef.current;
            if (el && e.target instanceof Node && !el.contains(e.target))
                setActionsOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [actionsOpen]);
    useEffect(() => {
        if (!periodMenuOpen)
            return;
        const onDown = (e) => {
            const el = periodMenuRef.current;
            if (el && e.target instanceof Node && !el.contains(e.target))
                setPeriodMenuOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [periodMenuOpen]);
    const openProjectEdit = useCallback(async () => {
        if (!canManageProjects || actionBusy)
            return;
        setActionBusy(true);
        setActionsOpen(false);
        try {
            const [c, p] = await Promise.all([
                getTimeManagerClient(project.clientId),
                getClientProject(project.clientId, project.id),
            ]);
            setEditClientRow(c);
            setEditProjectRow(p);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось загрузить проект для редактирования' });
        }
        finally {
            setActionBusy(false);
        }
    }, [canManageProjects, actionBusy, project.clientId, project.id, showAlert]);
    const handleArchiveProject = useCallback(async () => {
        if (!canManageProjects || actionBusy)
            return;
        const restoring = project.status === 'archived';
        if (!restoring) {
            const confirmArchive = await showConfirm({
                title: 'Архивировать проект?',
                message: 'Проект будет скрыт из активных списков. Продолжить?',
                confirmLabel: 'Архивировать',
            });
            if (!confirmArchive) {
                setActionsOpen(false);
                return;
            }
        }
        setActionBusy(true);
        setActionsOpen(false);
        try {
            await patchClientProject(project.clientId, project.id, buildProjectArchiveTogglePatch(!restoring));
            onProjectRefresh();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : (restoring ? 'Не удалось восстановить проект' : 'Не удалось архивировать проект') });
        }
        finally {
            setActionBusy(false);
        }
    }, [canManageProjects, actionBusy, project.clientId, project.id, project.status, onProjectRefresh, showAlert, showConfirm]);
    const handlePauseProject = useCallback(async () => {
        if (!canManageProjects || actionBusy || project.status === 'archived')
            return;
        const pausing = project.status !== 'paused';
        if (pausing) {
            const okPause = await showConfirm({
                title: 'Поставить проект на паузу?',
                message: 'Пока проект на паузе, списание времени по нему недоступно. Продолжить?',
                confirmLabel: 'На паузу',
            });
            if (!okPause) {
                setActionsOpen(false);
                return;
            }
        }
        setActionBusy(true);
        setActionsOpen(false);
        try {
            await patchClientProject(project.clientId, project.id, buildProjectPauseTogglePatch(pausing));
            onProjectRefresh();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : (pausing ? 'Не удалось поставить проект на паузу' : 'Не удалось снять проект с паузы') });
        }
        finally {
            setActionBusy(false);
        }
    }, [canManageProjects, actionBusy, project.clientId, project.id, project.status, onProjectRefresh, showAlert, showConfirm]);
    const handleDuplicateProject = useCallback(async () => {
        if (!canManageProjects || actionBusy)
            return;
        setActionBusy(true);
        setActionsOpen(false);
        try {
            const p = await getClientProject(project.clientId, project.id);
            const basePayload = duplicateProjectCreatePayload(p);
            let teamIds = [];
            try {
                const team = await listUsersWithProjectAccessToProject(project.id);
                teamIds = [...new Set(team.map((m) => Number(m.userId)).filter((n) => Number.isFinite(n) && n > 0))];
            }
            catch {
                teamIds = [];
            }
            const shouldCloneTeamOnCreate = (String(p.billable_rate_type ?? '').trim() || 'person_billable_rate') !== 'person_billable_rate';
            const payload = teamIds.length > 0 && shouldCloneTeamOnCreate
                ? { ...basePayload, initialTimeTrackingUserAuthIds: teamIds }
                : basePayload;
            const created = await createClientProject(project.clientId, payload);
            navigate(getProjectDetailUrl(created.id, project.clientId));
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось создать копию проекта' });
        }
        finally {
            setActionBusy(false);
        }
    }, [canManageProjects, actionBusy, project.clientId, project.id, navigate, showAlert]);
    const [tasksExportBusy, setTasksExportBusy] = useState(false);
    const handleExportProject = useCallback(() => {
        setActionsOpen(false);
        navigate(`${routes.timeTracking}?tab=reports`);
    }, [navigate]);
    const handleTasksExport = useCallback(async (format) => {
        setTasksExportBusy(true);
        try {
            await exportReportV2('time', 'projects', {
                dateFrom: detailPeriod.from.slice(0, 10),
                dateTo: detailPeriod.to.slice(0, 10),
                project_id: project.id,
                client_id: project.clientId,
            }, format, {
                timeExport: 'detail',
                clientName: project.client,
                projectName: project.name,
            });
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось экспортировать отчёт',
            });
        }
        finally {
            setTasksExportBusy(false);
        }
    }, [detailPeriod.from, detailPeriod.to, project.id, project.clientId, project.client, project.name, showAlert]);
    const handleTasksPeriodPreset = useCallback((id) => {
        onDetailPeriodChange(periodPresetToRange(id));
    }, [onDetailPeriodChange]);
    const handleDeleteProject = useCallback(async () => {
        if (!canManageProjects || actionBusy)
            return;
        if (project.deletable === false) {
            await showAlert({
                message: 'Проект нельзя удалить: к нему привязаны данные. Сначала архивируйте проект при необходимости.',
            });
            setActionsOpen(false);
            return;
        }
        const confirmDelete = await showConfirm({
            title: 'Удалить проект?',
            message: 'Это действие необратимо.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!confirmDelete) {
            setActionsOpen(false);
            return;
        }
        setActionBusy(true);
        setActionsOpen(false);
        try {
            await deleteClientProject(project.clientId, project.id);
            navigate(routes.timeTracking);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось удалить проект' });
        }
        finally {
            setActionBusy(false);
        }
    }, [canManageProjects, actionBusy, project.clientId, project.id, project.deletable, navigate, showAlert, showConfirm]);
    const [hoverIdx, setHoverIdx] = useState(null);
    const [detailTab, setDetailTab] = useState('tasks');
    const detailTabDefs = useMemo(() => {
        const base = [
            ['tasks', 'Задачи'],
            ['team', 'Команда'],
        ];
        if (canManageInvoices)
            base.push(['invoices', 'Счета']);
        if (canManageProjects)
            base.push(['duplicates', 'Дубликаты']);
        return base;
    }, [canManageInvoices, canManageProjects]);
    useEffect(() => {
        if (!canManageInvoices && detailTab === 'invoices')
            setDetailTab('tasks');
        if (!canManageProjects && detailTab === 'duplicates')
            setDetailTab('tasks');
    }, [canManageInvoices, canManageProjects, detailTab]);
    const [projectTeamWl, setProjectTeamWl] = useState(null);
    const [teamProfileWeeklyById, setTeamProfileWeeklyById] = useState(() => new Map());
    const [projectTeamPositionById, setProjectTeamPositionById] = useState(() => new Map());
    const [projectTeamNameById, setProjectTeamNameById] = useState(() => new Map());
    const [projectTeamLoad, setProjectTeamLoad] = useState('idle');
    const [teamActionsOpen, setTeamActionsOpen] = useState(null);
    useEffect(() => {
        if (detailTab !== 'team')
            return;
        let cancelled = false;
        setProjectTeamLoad('loading');
        setProjectTeamWl(null);
        setTeamProfileWeeklyById(new Map());
        setProjectTeamPositionById(new Map());
        setProjectTeamNameById(new Map());
        void Promise.all([
            getProjectTeamWorkload(project.clientId, project.id, detailPeriod.from, detailPeriod.to),
            listTimeTrackingUsers().catch(() => []),
            listColleaguesAsUsers().catch(() => []),
        ])
            .then(([d, ttUsers, orgUsers]) => {
            if (cancelled)
                return;
            const weekly = new Map();
            for (const r of ttUsers) {
                if (r.weekly_capacity_hours == null)
                    continue;
                const w = typeof r.weekly_capacity_hours === 'number'
                    ? r.weekly_capacity_hours
                    : parseFloat(String(r.weekly_capacity_hours).replace(',', '.'));
                if (Number.isFinite(w) && w > 0)
                    weekly.set(r.id, w);
            }
            const posAuth = new Map();
            const namesById = new Map();
            for (const u of orgUsers) {
                const p = u.position?.trim();
                if (p)
                    posAuth.set(u.id, p);
                const label = pickUserDisplayLabel(u.display_name, u.email, u.id);
                if (!label.startsWith('Пользователь '))
                    namesById.set(u.id, label);
            }
            for (const t of ttUsers) {
                const dn = t.display_name?.trim();
                if (dn && !isStubAuthUserEmail(dn)) {
                    namesById.set(t.id, dn);
                    continue;
                }
                if (namesById.has(t.id))
                    continue;
                const label = pickUserDisplayLabel(t.display_name, t.email, t.id);
                if (!label.startsWith('Пользователь '))
                    namesById.set(t.id, label);
            }
            const posMerged = new Map();
            for (const t of ttUsers) {
                const fromTt = t.position?.trim();
                if (fromTt)
                    posMerged.set(t.id, fromTt);
                else {
                    const fb = posAuth.get(t.id);
                    if (fb)
                        posMerged.set(t.id, fb);
                }
            }
            for (const mem of d.members) {
                if (!posMerged.has(mem.auth_user_id)) {
                    const fb = posAuth.get(mem.auth_user_id);
                    if (fb)
                        posMerged.set(mem.auth_user_id, fb);
                }
                if (!namesById.has(mem.auth_user_id)) {
                    const label = pickUserDisplayLabel(mem.display_name, mem.email, mem.auth_user_id);
                    namesById.set(mem.auth_user_id, label);
                }
            }
            setProjectTeamPositionById(posMerged);
            setProjectTeamNameById(namesById);
            setTeamProfileWeeklyById(weekly);
            setProjectTeamWl(d);
            setProjectTeamLoad('ok');
        })
            .catch(() => {
            if (!cancelled) {
                setProjectTeamWl(null);
                setTeamProfileWeeklyById(new Map());
                setProjectTeamPositionById(new Map());
                setProjectTeamNameById(new Map());
                setProjectTeamLoad('error');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [detailTab, project.clientId, project.id, detailPeriod.from, detailPeriod.to]);
    const projectTeamUsers = useMemo(() => {
        if (!projectTeamWl?.members?.length)
            return [];
        const days = projectTeamWl.period_days > 0 ? projectTeamWl.period_days : 1;
        return projectTeamWl.members.map((m) => teamWorkloadMemberToTimeUserRow(m, days, teamProfileWeeklyById.get(m.auth_user_id), projectTeamPositionById.get(m.auth_user_id), projectTeamNameById.get(m.auth_user_id)));
    }, [projectTeamWl, teamProfileWeeklyById, projectTeamPositionById, projectTeamNameById]);
    const projectTeamTotals = useMemo(() => {
        if (!projectTeamWl)
            return null;
        const s = projectTeamWl.summary;
        const periodDays = projectTeamWl.period_days > 0 ? projectTeamWl.period_days : 1;
        return {
            totalHours: Number(s.total_hours),
            teamCapacity: summaryTeamWeeklyCapacityHours(s, periodDays),
            billableHours: Number(s.billable_hours),
            nonBillableHours: Number(s.non_billable_hours),
            teamWorkloadPercent: Math.min(Math.max(s.team_workload_percent, 0), 100),
        };
    }, [projectTeamWl]);
    const dashboardOk = dashboard != null && !dashboardError;
    const displayCurrency = dashboard?.currency != null && String(dashboard.currency).trim() !== ''
        ? String(dashboard.currency).trim()
        : project.currency;
    const spent = dashboardOk ? dashboard.totals.billableAmount : project.spent;
    const unbilled = dashboardOk ? dashboard.totals.unbilledAmount : project.spent;
    const expenseEquivalentTotal = dashboardOk ? dashboard.totals.expenseEquivalentTotal : 0;
    const expenseAmountUzs = dashboardOk ? dashboard.totals.expenseAmountUzs : 0;
    const expenseCount = dashboardOk ? dashboard.totals.expenseCount : 0;
    const apiBudget = dashboardOk && dashboard?.budget?.hasBudget === true ? dashboard.budget : null;
    const budgetDual = apiBudget?.budgetBy === 'hours_and_money' && apiBudget.money && apiBudget.hours
        ? { money: apiBudget.money, hours: apiBudget.hours }
        : null;
    const hasLegacyBudget = project.budget != null;
    const hasBudget = apiBudget != null || hasLegacyBudget;
    const budgetBurnIncludesExpenses = apiBudget == null && hasLegacyBudget && project.budgetIncludesExpenses === true && dashboardOk;
    const spentForBudget = apiBudget != null
        ? (budgetDual ? budgetDual.money.spent : apiBudget.spent)
        : spent + (budgetBurnIncludesExpenses ? expenseEquivalentTotal : 0);
    const remaining = apiBudget != null
        ? deriveDashboardBudgetHeadlineRemaining(apiBudget)
        : hasLegacyBudget
            ? project.budget - spentForBudget
            : null;
    const dualMoneyRemainingEff = budgetDual != null ? deriveDashboardBudgetSliceRemaining(budgetDual.money) : null;
    const dualHoursRemainingEff = budgetDual != null ? deriveDashboardBudgetSliceRemaining(budgetDual.hours) : null;
    const budgetLimitForChart = apiBudget != null
        ? (apiBudget.budgetBy === 'money' || apiBudget.budgetBy === 'hours_and_money'
            ? (budgetDual ? budgetDual.money.budget : apiBudget.budget)
            : null)
        : project.budget ?? null;
    const pctDenom = apiBudget != null
        ? (budgetDual ? budgetDual.money.budget : apiBudget.budget)
        : hasLegacyBudget
            ? project.budget
            : null;
    const remainingPct = pctDenom != null && pctDenom > 0 && remaining != null && remaining >= 0
        ? Math.round((remaining / pctDenom) * 100)
        : null;
    const overspendPct = pctDenom != null && pctDenom > 0 && remaining != null && remaining < 0
        ? Math.round((Math.abs(remaining) / pctDenom) * 100)
        : null;
    const isOver = (() => {
        if (apiBudget == null)
            return remaining != null && remaining < 0;
        if (budgetDual)
            return (dualMoneyRemainingEff != null && dualMoneyRemainingEff < 0)
                || (dualHoursRemainingEff != null && dualHoursRemainingEff < 0);
        return remaining != null && remaining < 0;
    })();
    const spentPct = apiBudget != null && !budgetDual
        ? (apiBudget.budget > 0
            ? Math.min((apiBudget.spent / apiBudget.budget) * 100, 100)
            : 0)
        : hasLegacyBudget
            ? Math.min((spentForBudget / project.budget) * 100, 100)
            : 0;
    const singleBudgetUsedRawPct = apiBudget != null && !budgetDual && apiBudget.budget > 0
        ? (apiBudget.spent / apiBudget.budget) * 100
        : null;
    const overPct = apiBudget != null && !budgetDual && apiBudget.budget > 0 && isOver
        ? Math.min(Math.max((apiBudget.spent / apiBudget.budget) * 100 - 100, 0), 100)
        : isOver && hasBudget && apiBudget == null && hasLegacyBudget
            ? Math.min(((spentForBudget - project.budget) / project.budget) * 100, 50)
            : 0;
    const dualMoneyUsedRawPct = budgetDual != null && budgetDual.money.budget > 0
        ? (budgetDual.money.spent / budgetDual.money.budget) * 100
        : null;
    const dualHoursUsedRawPct = budgetDual != null && budgetDual.hours.budget > 0
        ? (budgetDual.hours.spent / budgetDual.hours.budget) * 100
        : null;
    const totalHours = dashboardOk
        ? dashboard.totals.totalHours
        : dashboardError
            ? null
            : +(project.spent / 50000).toFixed(2);
    const billable = dashboardOk
        ? dashboard.totals.billableHours
        : dashboardError
            ? null
            : totalHours != null
                ? +(totalHours * 0.92).toFixed(2)
                : null;
    const nonBill = dashboardOk
        ? dashboard.totals.nonBillableHours
        : dashboardError
            ? null
            : totalHours != null && billable != null
                ? +(totalHours - billable).toFixed(2)
                : null;
    const { progressData, hoursData, progressMode } = useMemo(() => {
        if (dashboardError || dashboard == null)
            return emptyDashboardCharts();
        return buildChartDataFromDashboard(dashboard);
    }, [dashboard, dashboardError]);
    const hoursChartStacked = useMemo(() => hoursData.some((d) => d.stackBillable != null && d.stackNonBillable != null), [hoursData]);
    const taskData = useMemo(() => {
        if (dashboardError) {
            return { billable: [], nonBillable: [] };
        }
        if (dashboard != null) {
            if (dashboard.tasks.length > 0) {
                return dashboardTasksToTaskRows(dashboard.tasks, displayCurrency);
            }
            const t = dashboard.totals;
            if (t.totalHours > 0 || t.billableHours > 0 || t.nonBillableHours > 0) {
                return dashboardTasksAggregateFromTotals(t, displayCurrency);
            }
            return { billable: [], nonBillable: [] };
        }
        return { billable: [], nonBillable: [] };
    }, [dashboard, dashboardError, displayCurrency]);
    const tasksBreakdownHint = dashboard != null &&
        !dashboardError &&
        dashboard.tasks.length === 0 &&
        dashboard.totals.totalHours <= 0 &&
        dashboard.totals.billableHours <= 0 &&
        dashboard.totals.nonBillableHours <= 0
        ? 'Детализация по задачам появится, когда API начнёт возвращать список tasks для выбранного периода.'
        : undefined;
    const tasksPeriodSubtitle = formatDetailPeriodLabel(detailPeriod) || 'За период';
    const twIdx = progressData.findIndex((d) => d.isThisWeek);
    const thisWeekIdx = twIdx >= 0 ? twIdx : Math.max(0, progressData.length - 1);
    const typeMeta = TYPE_COLOR[project.type] ?? TYPE_COLOR['Без бюджета'];
    const maxVal = progressMode === 'money'
        ? (progressData.length
            ? Math.max(...progressData.map((d) => d.value), budgetLimitForChart ?? 0)
            : budgetLimitForChart ?? 0) * 1.15
        : Math.max(0.01, ...(progressData.length ? progressData.map((d) => d.value) : [0])) * 1.15;
    const yTicks = Array.from({ length: 5 }, (_, i) => progressMode === 'money' ? Math.round((maxVal / 4) * i) : +((maxVal / 4) * i).toFixed(2));
    const monthBoundaries = progressData.filter((d) => d.isMonthStart && d.idx > 0);
    const internalCostAmount = dashboardOk
        ? dashboard.totals.internalCostAmount
        : project.costs;
    const internalCostsComplete = dashboardOk ? dashboard.totals.internalCostsComplete : false;
    const memberFilterOptions = useMemo(() => {
        if (!dashboardOk || !dashboard)
            return [];
        const team = (dashboard.team ?? []).filter((m) => isLinkableMemberUserId(m.userId) && m.hours > 0);
        if (team.length)
            return team.map((m) => ({ id: m.userId, name: m.name })).sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
        const agg = new Map();
        for (const t of dashboard.tasks ?? []) {
            for (const m of t.members ?? []) {
                if (!isLinkableMemberUserId(m.userId))
                    continue;
                const cur = agg.get(m.userId);
                if (cur)
                    cur.hours += m.hours;
                else
                    agg.set(m.userId, { id: m.userId, name: m.name, hours: m.hours });
            }
        }
        return [...agg.values()].filter((x) => x.hours > 0).map((x) => ({ id: x.id, name: x.name })).sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    }, [dashboard, dashboardOk]);
    useEffect(() => {
        if (selectedMemberId && !memberFilterOptions.some((o) => o.id === selectedMemberId))
            setSelectedMemberId('');
    }, [memberFilterOptions, selectedMemberId]);
    const memberFilterActive = selectedMemberId !== '' && memberFilterOptions.some((o) => o.id === selectedMemberId);
    const displayTaskData = useMemo(() => {
        if (!memberFilterActive)
            return taskData;
        const pick = (rows) => rows.flatMap((r) => {
            const m = r.members.find((mm) => mm.userId === selectedMemberId);
            if (!m || m.hours <= 0)
                return [];
            return [{ ...r, hours: m.hours, billableAmt: m.billableAmt, costs: m.costs, members: [m], expandable: false }];
        });
        return { billable: pick(taskData.billable), nonBillable: pick(taskData.nonBillable) };
    }, [taskData, selectedMemberId, memberFilterActive]);
    const memberKpi = useMemo(() => {
        if (!memberFilterActive)
            return null;
        let bh = 0;
        let nh = 0;
        let amt = 0;
        for (const r of displayTaskData.billable) {
            bh += r.hours;
            amt += r.billableAmt;
        }
        for (const r of displayTaskData.nonBillable) {
            nh += r.hours;
            amt += r.billableAmt;
        }
        return { totalHours: +(bh + nh).toFixed(2), billable: +bh.toFixed(2), nonBill: +nh.toFixed(2), billableAmount: amt };
    }, [memberFilterActive, displayTaskData]);
    const displayTotalHours = memberKpi ? memberKpi.totalHours : totalHours;
    const displayBillableHours = memberKpi ? memberKpi.billable : billable;
    const displayNonBillHours = memberKpi ? memberKpi.nonBill : nonBill;
    const displayBillableAmount = memberKpi ? memberKpi.billableAmount : spent;
    const selectedMemberName = memberFilterActive
        ? (memberFilterOptions.find((o) => o.id === selectedMemberId)?.name ?? '')
        : '';
    const tasksPanelSubtitle = selectedMemberName
        ? `${tasksPeriodSubtitle} · ${selectedMemberName}`
        : tasksPeriodSubtitle;
    const activePeriodPreset = PDP_PERIOD_PRESETS.find((p) => {
        const r = periodPresetToRange(p.id);
        return r.from === detailPeriod.from && r.to === detailPeriod.to;
    });
    return (_jsxs("div", { className: "pdp pdp--ready", children: [_jsxs("header", { className: "pdp__header", children: [_jsxs("div", { className: "pdp__header-left", children: [_jsx(AppBackButton, { onClick: onBackToProjects, label: backToProjectsLabel, ariaLabel: backToProjectsLabel }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "pdp__title-block", children: _jsxs("div", { className: "pdp__title-row", children: [_jsxs("h1", { className: "pdp__title", children: [project.name, " \u2014 (", project.client, ")"] }), _jsx("span", { className: "pdp__type-badge", style: { color: typeMeta.color, background: typeMeta.bg }, children: ttProjectTypeLabel(project.type, t) }), project.status === 'paused' ? (_jsx("span", { className: "pdp__type-badge", style: { color: '#b45309', background: '#fffbeb' }, children: "\u041D\u0430 \u043F\u0430\u0443\u0437\u0435" })) : null, project.status === 'archived' ? (_jsx("span", { className: "pdp__type-badge", style: { color: '#64748b', background: '#f1f5f9' }, children: "\u0410\u0440\u0445\u0438\u0432" })) : null] }) })] }), _jsxs("div", { className: "pdp__header-right app-page-header-end", children: [_jsx(AppPageSettings, {}), _jsxs("button", { type: "button", className: "pdp__edit-btn", onClick: () => void openProjectEdit(), disabled: !canManageProjects || actionBusy, title: !canManageProjects ? 'Доступно администраторам и партнёру' : 'Редактировать проект', children: [_jsx(IcoEdit, {}), " \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C"] }), _jsxs("div", { className: "pdp__actions-wrap", ref: actionsMenuRef, children: [_jsxs("button", { type: "button", className: `pdp__actions-btn${actionsOpen ? ' pdp__actions-btn--open' : ''}`, onClick: () => setActionsOpen(v => !v), disabled: actionBusy, "aria-expanded": actionsOpen, children: ["\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F ", _jsx(IcoChevron, {})] }), actionsOpen && (_jsxs("div", { className: "pdp__actions-menu", role: "menu", children: [canManageProjects && (_jsxs(_Fragment, { children: [project.status !== 'archived' && (_jsx("button", { type: "button", className: "pdp__actions-item", role: "menuitem", disabled: actionBusy, onClick: () => void handlePauseProject(), children: project.status === 'paused' ? 'Снять с паузы' : 'На паузу' })), _jsx("button", { type: "button", className: "pdp__actions-item", role: "menuitem", disabled: actionBusy, onClick: () => void handleArchiveProject(), children: project.status === 'archived' ? 'Восстановить' : 'Архивировать' }), _jsx("button", { type: "button", className: "pdp__actions-item", role: "menuitem", disabled: actionBusy, onClick: () => void handleDuplicateProject(), children: "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C" })] })), _jsx("button", { type: "button", className: "pdp__actions-item", role: "menuitem", onClick: handleExportProject, children: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442" }), canManageProjects && (_jsx("button", { type: "button", className: "pdp__actions-item pdp__actions-item--danger", role: "menuitem", disabled: actionBusy, onClick: () => void handleDeleteProject(), children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" }))] }))] })] })] }), _jsxs("div", { className: `pdp__body${dashboardRefreshing ? ' pdp__body--refreshing' : ''}`, children: [dashboardError ? (_jsx("div", { className: "pdp__dashboard-alert", role: "alert", children: _jsxs("p", { children: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u0430\u0448\u0431\u043E\u0440\u0434 \u043F\u0440\u043E\u0435\u043A\u0442\u0430: ", dashboardError] }) })) : null, _jsxs("div", { className: "pdp__period-bar", role: "group", "aria-label": "\u041F\u0435\u0440\u0438\u043E\u0434 \u0434\u0430\u0448\u0431\u043E\u0440\u0434\u0430 \u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u044B", children: [_jsx("span", { className: "pdp__period-bar-label", children: "\u041F\u0435\u0440\u0438\u043E\u0434" }), _jsx(DatePicker, { value: detailPeriod.from, max: detailPeriod.to, onChange: (iso) => {
                                    const to = iso > detailPeriod.to ? iso : detailPeriod.to;
                                    onDetailPeriodChange({ from: iso, to });
                                }, portal: true, iconAfterLabel: true, "aria-labelledby": `${detailPeriodRangeId}-from`, buttonClassName: "pdp__period-date-picker-btn", title: "\u0414\u0430\u0442\u0430 \u0441" }), _jsx("span", { id: `${detailPeriodRangeId}-from`, className: "pdp__period-sr-only", children: "\u0414\u0430\u0442\u0430 \u0441" }), _jsx("span", { className: "pdp__period-sep", "aria-hidden": true, children: "\u2014" }), _jsx(DatePicker, { value: detailPeriod.to, min: detailPeriod.from, onChange: (iso) => {
                                    const from = iso < detailPeriod.from ? iso : detailPeriod.from;
                                    onDetailPeriodChange({ from, to: iso });
                                }, portal: true, iconAfterLabel: true, "aria-labelledby": `${detailPeriodRangeId}-to`, buttonClassName: "pdp__period-date-picker-btn", title: "\u0414\u0430\u0442\u0430 \u043F\u043E" }), _jsx("span", { id: `${detailPeriodRangeId}-to`, className: "pdp__period-sr-only", children: "\u0414\u0430\u0442\u0430 \u043F\u043E" }), _jsxs("div", { className: "pdp__period-actions", children: [memberFilterOptions.length > 0 ? (_jsx(SearchableSelect, { portalDropdown: true, className: "pdp__period-member-select", buttonClassName: "pdp__period-member-btn", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443", placeholder: "\u0412\u0441\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438", value: selectedMemberId, items: [{ id: '', name: 'Все сотрудники' }, ...memberFilterOptions], getOptionValue: (o) => o.id, getOptionLabel: (o) => o.name, getSearchText: (o) => o.name, onSelect: (o) => setSelectedMemberId(o.id) })) : null, _jsxs("div", { className: "pdp__period-preset-wrap", ref: periodMenuRef, children: [_jsxs("button", { type: "button", className: `pdp__period-preset-btn${periodMenuOpen ? ' pdp__period-preset-btn--open' : ''}`, onClick: () => setPeriodMenuOpen((v) => !v), "aria-expanded": periodMenuOpen, "aria-haspopup": "menu", children: [activePeriodPreset?.label ?? 'Период', _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), periodMenuOpen ? (_jsx("div", { className: "pdp__period-preset-menu", role: "menu", children: PDP_PERIOD_PRESETS.map((p) => (_jsx("button", { type: "button", role: "menuitemradio", "aria-checked": activePeriodPreset?.id === p.id, className: `pdp__period-preset-item${activePeriodPreset?.id === p.id ? ' pdp__period-preset-item--active' : ''}`, onClick: () => {
                                                        onDetailPeriodChange(periodPresetToRange(p.id));
                                                        setPeriodMenuOpen(false);
                                                    }, children: p.label }, p.id))) })) : null] })] })] }), _jsx(ProjectPartnerReportPanel, { projectId: project.id, detailPeriod: detailPeriod, currentUserId: currentUserId }), _jsx(Suspense, { fallback: _jsx("div", { className: "pdp__chart-card pdp__chart-card--loading", "aria-hidden": true }), children: _jsx(ProjectDetailCharts, { chartTab: chartTab, onChartTabChange: setChartTab, dashboardOk: dashboardOk, progressMode: progressMode, progressData: progressData, hoursData: hoursData, hoverIdx: hoverIdx, onHoverIdxChange: setHoverIdx, thisWeekIdx: thisWeekIdx, monthBoundaries: monthBoundaries, hasBudget: hasBudget, budgetLimitForChart: budgetLimitForChart, displayCurrency: displayCurrency, hoursChartStacked: hoursChartStacked, yTicks: yTicks, maxVal: maxVal }) }), _jsxs("div", { className: "pdp__stats", children: [_jsxs("div", { className: "pdp__stat-card", children: [_jsx("p", { className: "pdp__stat-label", children: "\u0412\u0441\u0435\u0433\u043E \u0447\u0430\u0441\u043E\u0432" }), _jsx("p", { className: "pdp__stat-value", children: displayTotalHours != null ? formatDecimalHoursAsHm(displayTotalHours) : '—' }), _jsxs("div", { className: "pdp__stat-rows", children: [_jsxs("div", { className: "pdp__stat-row", children: [_jsx("span", { children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435" }), _jsx("span", { className: "pdp__stat-row-val", children: displayBillableHours != null ? formatDecimalHoursAsHm(displayBillableHours) : '—' })] }), _jsxs("div", { className: "pdp__stat-row", children: [_jsx("span", { children: "\u041D\u0435\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435" }), _jsx("span", { className: "pdp__stat-row-val", children: displayNonBillHours != null ? formatDecimalHoursAsHm(displayNonBillHours) : '—' })] })] })] }), dashboardOk && (_jsxs("div", { className: "pdp__stat-card", children: [_jsxs("p", { className: "pdp__stat-label", children: ["\u0420\u0430\u0441\u0445\u043E\u0434\u044B (", displayCurrency, ")"] }), _jsx("p", { className: "pdp__stat-value", children: fmtAmt(expenseEquivalentTotal, displayCurrency) }), _jsxs("p", { className: "pdp__stat-hint", children: ["\u042D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442 \u0437\u0430\u044F\u0432\u043E\u043A (\u043A\u0430\u043A \u0432 \u043C\u043E\u0434\u0443\u043B\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432) \u00B7 ", expenseCount, " \u0437\u0430\u044F\u0432\u043E\u043A (\u043E\u0434\u043E\u0431\u0440\u0435\u043D\u043E / \u043E\u043F\u043B\u0430\u0447\u0435\u043D\u043E / \u0437\u0430\u043A\u0440\u044B\u0442\u043E) \u00B7 \u043F\u0435\u0440\u0438\u043E\u0434 \u043A\u0430\u043A \u0443 \u0444\u0438\u043B\u044C\u0442\u0440\u0430 \u0434\u0430\u0442 \u0432\u044B\u0448\u0435"] }), expenseAmountUzs > 0 ? (_jsxs("p", { className: "pdp__stat-hint pdp__stat-hint--muted", children: ["\u0412 \u0441\u0443\u043C\u0430\u0445 (UZS, \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u0441\u0447\u0451\u0442\u0430 \u043F\u043E \u043A\u0443\u0440\u0441\u0443):", ' ', fmtAmt(expenseAmountUzs, 'UZS')] })) : null, expenseCount === 0 && expenseEquivalentTotal === 0 && expenseAmountUzs === 0 ? (_jsx("p", { className: "pdp__stat-hint pdp__stat-hint--muted", children: "\u0415\u0441\u043B\u0438 \u0437\u0430\u044F\u0432\u043A\u0438 \u0435\u0441\u0442\u044C, \u0443\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u0432 \u043D\u0438\u0445 \u0443\u043A\u0430\u0437\u0430\u043D \u044D\u0442\u043E\u0442 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438 \u0447\u0442\u043E \u0441\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0431\u044D\u043A\u0435\u043D\u0434\u0443 \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438." })) : null] })), _jsxs("div", { className: "pdp__stat-card", children: [_jsxs("p", { className: "pdp__stat-label", children: ["\u041E\u0441\u0442\u0430\u0442\u043E\u043A \u0431\u044E\u0434\u0436\u0435\u0442\u0430", pctDenom != null && pctDenom > 0 && remaining != null && (overspendPct != null ? (_jsxs("span", { className: "pdp__stat-label-pct--over", children: ["\u00A0(\u043F\u0435\u0440\u0435\u0440\u0430\u0441\u0445\u043E\u0434 ", overspendPct, "%)"] })) : remainingPct != null ? (_jsxs("span", { className: "pdp__stat-label-pct", children: ["\u00A0(\u043E\u0441\u0442\u0430\u0442\u043E\u043A +", remainingPct, "%)"] })) : null), isOver && _jsx("span", { className: "pdp__stat-info", children: _jsx(IcoInfo, {}) })] }), remaining != null ? (_jsxs("p", { className: `pdp__stat-value${isOver ? ' pdp__stat-value--red' : ''}`, children: [isOver ? '−' : '', apiBudget != null
                                                ? fmtDashboardBudgetSpentRemaining(apiBudget, Math.abs(remaining))
                                                : fmtAmt(Math.abs(remaining), displayCurrency)] })) : (_jsx("p", { className: "pdp__stat-value pdp__stat-value--na", children: "\u0411\u0435\u0437 \u0431\u044E\u0434\u0436\u0435\u0442\u0430" })), hasBudget && (_jsxs("div", { className: "pdp__stat-budget-block", children: [budgetDual ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "pdp__stat-budget-row", children: [_jsx("span", { className: "pdp__stat-budget-label", children: "\u041B\u0438\u043C\u0438\u0442 (\u0434\u0435\u043D\u044C\u0433\u0438) \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434" }), _jsx("span", { className: "pdp__stat-budget-val", children: fmtDashboardBudgetValue(apiBudget) })] }), apiBudget != null && (dualMoneyUsedRawPct != null || apiBudget.percentUsedMoney != null && Number.isFinite(apiBudget.percentUsedMoney) || apiBudget.money?.percentUsed != null) && (_jsxs("p", { className: "pdp__stat-hint", children: ["\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E (\u0434\u0435\u043D\u044C\u0433\u0438):", ' ', Math.round(dualMoneyUsedRawPct ?? (apiBudget.percentUsedMoney ?? apiBudget.money?.percentUsed) ?? 0), "%"] })), _jsxs("div", { className: "pdp__budget-bar", children: [_jsx("div", { className: "pdp__budget-bar-fill pdp__budget-bar-fill--blue", style: { width: `${dualMoneyUsedRawPct != null ? Math.min(100, dualMoneyUsedRawPct) : Math.min(100, budgetDual.money.budget > 0 ? (budgetDual.money.spent / budgetDual.money.budget) * 100 : 0)}%` } }), dualMoneyUsedRawPct != null && dualMoneyUsedRawPct > 100 ? (_jsx("div", { className: "pdp__budget-bar-fill pdp__budget-bar-fill--red", style: { width: `${Math.min(100, dualMoneyUsedRawPct - 100)}%` } })) : null] }), _jsxs("p", { className: "pdp__stat-hint pdp__stat-hint--muted", children: ["\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E (\u0434\u0435\u043D\u044C\u0433\u0438):", ' ', fmtDashboardBudgetSpentRemaining(apiBudget, budgetDual.money.spent), " \u00B7 ", apiBudget.currency] }), _jsxs("div", { className: "pdp__stat-budget-row", style: { marginTop: '0.65rem' }, children: [_jsx("span", { className: "pdp__stat-budget-label", children: "\u041B\u0438\u043C\u0438\u0442 (\u0447\u0430\u0441\u044B) \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434" }), _jsx("span", { className: "pdp__stat-budget-val", children: formatDecimalHoursAsHm(budgetDual.hours.budget) })] }), apiBudget != null && (dualHoursUsedRawPct != null || apiBudget.percentUsedHours != null && Number.isFinite(apiBudget.percentUsedHours) || apiBudget.hours?.percentUsed != null) && (_jsxs("p", { className: "pdp__stat-hint", children: ["\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E (\u0447\u0430\u0441\u044B):", ' ', Math.round(dualHoursUsedRawPct ?? (apiBudget.percentUsedHours ?? apiBudget.hours?.percentUsed) ?? 0), "%"] })), _jsxs("div", { className: "pdp__budget-bar", children: [_jsx("div", { className: "pdp__budget-bar-fill pdp__budget-bar-fill--blue", style: { width: `${dualHoursUsedRawPct != null ? Math.min(100, dualHoursUsedRawPct) : Math.min(100, budgetDual.hours.budget > 0 ? (budgetDual.hours.spent / budgetDual.hours.budget) * 100 : 0)}%` } }), dualHoursUsedRawPct != null && dualHoursUsedRawPct > 100 ? (_jsx("div", { className: "pdp__budget-bar-fill pdp__budget-bar-fill--red", style: { width: `${Math.min(100, dualHoursUsedRawPct - 100)}%` } })) : null] }), _jsxs("p", { className: "pdp__stat-hint pdp__stat-hint--muted", children: ["\u0421\u043F\u0438\u0441\u0430\u043D\u043E (\u0447\u0430\u0441\u044B): ", formatDecimalHoursAsHm(budgetDual.hours.spent)] }), apiBudget != null && (dualMoneyUsedRawPct != null || dualHoursUsedRawPct != null || apiBudget.percentUsed != null) && (_jsxs("p", { className: "pdp__stat-hint", children: ["\u041E\u0440\u0438\u0435\u043D\u0442\u0438\u0440 \u043F\u043E \u043B\u0438\u043C\u0438\u0442\u0443 (\u043C\u0430\u043A\u0441. \u0438\u0437 \u0434\u0432\u0443\u0445):", ' ', Math.round(Math.max(dualMoneyUsedRawPct ?? 0, dualHoursUsedRawPct ?? 0, apiBudget.percentUsed ?? 0)), "%"] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "pdp__stat-budget-row", children: [_jsx("span", { className: "pdp__stat-budget-label", children: apiBudget != null ? `Лимит (${apiBudget.budgetBy === 'hours' ? 'часы' : 'деньги'}) за период` : 'Общий бюджет' }), _jsx("span", { className: "pdp__stat-budget-val", children: apiBudget != null
                                                                    ? fmtDashboardBudgetValue(apiBudget)
                                                                    : fmtAmt(project.budget, displayCurrency) })] }), apiBudget != null && (singleBudgetUsedRawPct != null || apiBudget.percentUsed != null && Number.isFinite(apiBudget.percentUsed)) && (_jsxs("p", { className: "pdp__stat-hint", children: ["\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E \u043B\u0438\u043C\u0438\u0442\u0430:", ' ', Math.round(singleBudgetUsedRawPct ?? apiBudget.percentUsed ?? 0), "%"] })), _jsxs("div", { className: "pdp__budget-bar", children: [_jsx("div", { className: "pdp__budget-bar-fill pdp__budget-bar-fill--blue", style: { width: `${spentPct}%` } }), isOver && _jsx("div", { className: "pdp__budget-bar-fill pdp__budget-bar-fill--red", style: { width: `${overPct}%` } })] }), apiBudget != null ? (_jsxs("p", { className: "pdp__stat-hint pdp__stat-hint--muted", children: ["\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434:", ' ', fmtDashboardBudgetSpentRemaining(apiBudget, apiBudget.spent), apiBudget.budgetBy === 'money' ? ` · валюта лимита: ${apiBudget.currency}` : null] })) : null] })), budgetBurnIncludesExpenses && (_jsxs("p", { className: "pdp__stat-hint", children: ["\u0412 \u0440\u0430\u0441\u0445\u043E\u0434 \u0431\u044E\u0434\u0436\u0435\u0442\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0441\u0443\u043C\u043C\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 (", displayCurrency, ")."] }))] }))] }), _jsxs("div", { className: "pdp__stat-card", children: [_jsx("p", { className: "pdp__stat-label", children: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0437\u0430\u0442\u0440\u0430\u0442\u044B" }), dashboardOk && !internalCostsComplete ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "pdp__stat-value", children: fmtAmt(internalCostAmount, displayCurrency) }), _jsx("p", { className: "pdp__stat-hint", children: internalCostAmount > 0
                                                    ? 'Себестоимость посчитана не для всех часов: задайте ставки «себестоимость» всем участникам с часами по проекту.'
                                                    : 'Себестоимость не задана для части команды — по этим часам затраты считаются как 0.' })] })) : internalCostAmount > 0 ? (_jsx("p", { className: "pdp__stat-value", children: fmtAmt(internalCostAmount, displayCurrency) })) : dashboardOk && internalCostsComplete ? (_jsx("p", { className: "pdp__stat-value", children: fmtAmt(0, displayCurrency) })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "pdp__stat-value pdp__stat-value--na", children: "N/A" }), !dashboardOk && !dashboardError && (_jsx("p", { className: "pdp__stat-hint", children: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0441\u0442\u0430\u0432\u043A\u0438 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B \u0434\u043B\u044F \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432." })), dashboardError ? (_jsx("p", { className: "pdp__stat-hint", children: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0434\u0430\u0448\u0431\u043E\u0440\u0434\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B." })) : null] }))] }), canManageInvoices && (_jsxs("div", { className: "pdp__stat-card", children: [_jsx("p", { className: "pdp__stat-label", children: "\u041D\u0435 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u0441\u0447\u0451\u0442\u043E\u0432" }), _jsx("p", { className: "pdp__stat-value", children: fmtAmt(unbilled, displayCurrency) }), _jsx("button", { type: "button", className: "pdp__invoice-btn", children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0447\u0451\u0442" })] })), _jsxs("div", { className: "pdp__stat-card pdp__stat-card--notes", children: [_jsx("p", { className: "pdp__stat-label", children: "\u0417\u0430\u043C\u0435\u0442\u043A\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430" }), project.notes ? (_jsx("p", { className: "pdp__notes-text", children: project.notes })) : (_jsx("p", { className: "pdp__stat-hint", children: "\u0417\u0430\u043C\u0435\u0442\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442. \u0418\u0445 \u043C\u043E\u0436\u043D\u043E \u0443\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0440\u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430." })), canManageProjects ? (_jsx("button", { type: "button", className: "pdp__invoice-btn", disabled: actionBusy, onClick: () => void openProjectEdit(), children: project.notes ? 'Изменить' : 'Добавить заметку' })) : null] })] }), _jsxs("div", { className: "pdp__detail-block", children: [_jsx("nav", { className: "pdp__detail-tabs", role: "tablist", children: detailTabDefs.map(([id, label]) => (_jsx("button", { role: "tab", "aria-selected": detailTab === id, className: `pdp__detail-tab${detailTab === id ? ' pdp__detail-tab--active' : ''}`, onClick: () => setDetailTab(id), children: label }, id))) }), detailTab === 'tasks' && (_jsx(TasksPanel, { rows: displayTaskData.billable, nonBillableRows: displayTaskData.nonBillable, totalHours: displayBillableHours ?? 0, totalAmt: displayBillableAmount, currency: displayCurrency, periodSubtitle: tasksPanelSubtitle, breakdownHint: tasksBreakdownHint, onOpenMemberReport: openMemberDetailReport, onPreviewEntries: openProjectPeriodReport, activePeriodPresetId: activePeriodPreset?.id, activePeriodPresetLabel: activePeriodPreset?.label ?? (formatDetailPeriodLabel(detailPeriod) || 'Период'), onSelectPeriodPreset: handleTasksPeriodPreset, onExport: (format) => void handleTasksExport(format), exportBusy: tasksExportBusy })), detailTab === 'team' &&
                                (projectTeamLoad === 'loading' ? (_jsx("div", { className: "pdp__detail-loading", role: "status", children: _jsx("p", { children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u044B\u2026" }) })) : projectTeamLoad === 'error' ? (_jsxs("div", { className: "pdp__detail-empty", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }), _jsx("p", { children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434." })] })) : projectTeamTotals && projectTeamWl ? (_jsxs("div", { className: "time-page__panel time-users pdp__team-workload", children: [_jsxs("p", { className: "pdp__team-workload__period", children: ["\u041F\u0435\u0440\u0438\u043E\u0434:", ' ', _jsxs("strong", { children: [projectTeamWl.date_from, " \u2014 ", projectTeamWl.date_to] }), projectTeamWl.project_name ? (_jsxs(_Fragment, { children: [' ', "\u00B7 \u043F\u0440\u043E\u0435\u043A\u0442 \u00AB", projectTeamWl.project_name, "\u00BB"] })) : null] }), _jsx(TimeUsersSummary, { totals: projectTeamTotals }), projectTeamUsers.length === 0 ? (_jsxs("div", { className: "pdp__detail-empty pdp__detail-empty--inset", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: [_jsx("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" })] }), _jsx("p", { children: "\u0417\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u043D\u0435\u0442 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432 \u0441 \u0434\u043E\u0441\u0442\u0443\u043F\u043E\u043C \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0438 \u0437\u0430\u043F\u0438\u0441\u044F\u043C\u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u0438." }), _jsx("p", { className: "pdp__detail-empty-hint", children: "\u041D\u0430\u0437\u043D\u0430\u0447\u044C\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \u00AB\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438\u00BB \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 (\u00AB\u0414\u043E\u0441\u0442\u0443\u043F \u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C\u00BB \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430) \u0438\u043B\u0438 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0447\u0430\u0441\u044B \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0443 \u0432 \u0442\u0430\u0431\u0435\u043B\u0435." })] })) : (_jsx(TimeUsersTable, { users: projectTeamUsers, openActionsId: teamActionsOpen, onActionsOpen: setTeamActionsOpen, onActionsClose: () => setTeamActionsOpen(null) }))] })) : null), detailTab === 'invoices' && (dashboard != null && dashboard.invoices.length > 0 ? (_jsx("div", { className: "pdp__tasks", children: _jsxs("table", { className: "pdp__tasks-table", children: [_jsx("thead", { children: _jsxs("tr", { className: "pdp__tasks-thead", children: [_jsx("th", { className: "pdp__tasks-th pdp__tasks-th--name", children: "\u0414\u0430\u0442\u0430" }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--amt", children: "\u0421\u0443\u043C\u043C\u0430" }), _jsx("th", { className: "pdp__tasks-th pdp__tasks-th--name", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: dashboard.invoices.map((inv) => (_jsxs("tr", { className: "pdp__tasks-row", children: [_jsx("td", { className: "pdp__tasks-td pdp__tasks-td--name", children: inv.issuedAt
                                                            ? new Date(inv.issuedAt).toLocaleDateString('ru-RU')
                                                            : '—' }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--amt", children: fmtAmt(inv.amount, inv.currency || displayCurrency) }), _jsx("td", { className: "pdp__tasks-td pdp__tasks-td--name", children: inv.status
                                                            ? (INVOICE_STATUS_LABELS[inv.status] ?? inv.status)
                                                            : '—' })] }, inv.id))) })] }) })) : (_jsxs("div", { className: "pdp__detail-empty", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", children: [_jsx("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }), _jsx("line", { x1: "8", y1: "21", x2: "16", y2: "21" }), _jsx("line", { x1: "12", y1: "17", x2: "12", y2: "21" })] }), _jsx("p", { children: "\u0421\u0447\u0435\u0442\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u044B" })] }))), detailTab === 'duplicates' && canManageProjects ? (_jsx(ProjectDuplicatesPanel, { clientId: project.clientId, projectId: project.id, dateFrom: detailPeriod.from.slice(0, 10), dateTo: detailPeriod.to.slice(0, 10), onChanged: onProjectRefresh })) : null] })] }), editProjectRow && editClientRow && (_jsx(ClientProjectModal, { mode: "edit", fixedClientId: project.clientId, initial: editProjectRow, clientsForPicker: [editClientRow], onClose: () => {
                    setEditProjectRow(null);
                    setEditClientRow(null);
                }, onSaved: () => {
                    setEditProjectRow(null);
                    setEditClientRow(null);
                    onProjectRefresh();
                }, canManage: canManageProjects }))] }));
}
export function ProjectDetailPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const clientHint = searchParams.get('client');
    const navigate = useNavigate();
    const { t } = useI18n();
    const backToProjectsLabel = t('timeTrackingPage.projects.newProjectPage.backToProjects');
    const { user, loading: userLoading } = useCurrentUser();
    const [project, setProject] = useState(undefined);
    const [dashboard, setDashboard] = useState(undefined);
    const [dashboardError, setDashboardError] = useState(null);
    const [detailPeriod, setDetailPeriod] = useState(() => defaultProjectTeamPeriod());
    const detailPeriodRef = useRef(detailPeriod);
    detailPeriodRef.current = detailPeriod;
    const [loadError, setLoadError] = useState(null);
    const [fontsReady, setFontsReady] = useState(false);
    const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
    const [projectRefreshTick, setProjectRefreshTick] = useState(0);
    const onProjectRefresh = useCallback(() => { setProjectRefreshTick((t) => t + 1); }, []);
    useEffect(() => {
        let cancelled = false;
        void waitForAppFonts().then(() => {
            if (!cancelled)
                setFontsReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, [id]);
    useEffect(() => {
        if (!id || userLoading)
            return;
        if (!canAccessTimeTracking(user))
            return;
        let cancelled = false;
        setProject(undefined);
        setDashboard(undefined);
        setLoadError(null);
        setDashboardError(null);
        setDashboardRefreshing(false);
        void (async () => {
            try {
                const row = await loadProjectDetailRow(id, clientHint);
                if (cancelled)
                    return;
                setProject(row);
                if (!row) {
                    setDashboard(null);
                    return;
                }
                try {
                    const d = await getClientProjectDashboard(row.clientId, row.id, {
                        dateFrom: detailPeriodRef.current.from,
                        dateTo: detailPeriodRef.current.to,
                    });
                    if (!cancelled) {
                        setDashboard(d);
                        setDashboardError(null);
                    }
                }
                catch (e) {
                    if (!cancelled) {
                        setDashboard(null);
                        setDashboardError(e instanceof Error ? e.message : 'ошибка сети или сервера');
                    }
                }
            }
            catch (e) {
                if (!cancelled) {
                    setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить проект');
                    setProject(null);
                    setDashboard(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, clientHint, user, userLoading, projectRefreshTick]);
    const canManageProjects = canManageTimeTrackingClients(user);
    const skipPeriodDashboardFetch = useRef(true);
    useEffect(() => {
        skipPeriodDashboardFetch.current = true;
    }, [id, projectRefreshTick]);
    useEffect(() => {
        if (!project?.clientId || !project?.id)
            return;
        if (skipPeriodDashboardFetch.current) {
            skipPeriodDashboardFetch.current = false;
            return;
        }
        let cancelled = false;
        setDashboardRefreshing(true);
        void getClientProjectDashboard(project.clientId, project.id, {
            dateFrom: detailPeriod.from,
            dateTo: detailPeriod.to,
        })
            .then((d) => {
            if (!cancelled) {
                setDashboard(d);
                setDashboardError(null);
            }
        })
            .catch((e) => {
            if (!cancelled) {
                setDashboard(null);
                setDashboardError(e instanceof Error ? e.message : 'ошибка сети или сервера');
            }
        })
            .finally(() => {
            if (!cancelled)
                setDashboardRefreshing(false);
        });
        return () => {
            cancelled = true;
        };
    }, [project?.clientId, project?.id, detailPeriod.from, detailPeriod.to]);
    if (userLoading)
        return null;
    if (!canAccessTimeTracking(user)) {
        return _jsx(Navigate, { to: routes.home, replace: true });
    }
    if (loadError) {
        return (_jsxs("div", { className: "pdp pdp--error", children: [_jsx("p", { children: loadError }), _jsx(AppBackButton, { onClick: () => navigateBackToProjects(navigate), label: backToProjectsLabel, ariaLabel: backToProjectsLabel })] }));
    }
    const shellLoading = !fontsReady
        || project === undefined
        || (project != null && dashboard === undefined);
    if (shellLoading) {
        return _jsx(ProjectDetailPageSkeleton, {});
    }
    if (project === null) {
        return (_jsxs("div", { className: "pdp pdp--error", children: [_jsx("p", { children: "\u041F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" }), _jsx(AppBackButton, { onClick: () => navigateBackToProjects(navigate), label: backToProjectsLabel, ariaLabel: backToProjectsLabel })] }));
    }
    return (_jsx(ProjectDetailBody, { project: project, dashboard: dashboard, dashboardError: dashboardError, detailPeriod: detailPeriod, onDetailPeriodChange: setDetailPeriod, canManageInvoices: hasFullTimeTrackingTabs(user), canManageProjects: canManageProjects, onProjectRefresh: onProjectRefresh, currentUserId: user?.id ?? null, dashboardRefreshing: dashboardRefreshing }));
}
