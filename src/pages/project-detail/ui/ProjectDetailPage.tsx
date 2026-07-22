import { useState, useMemo, useCallback, useEffect, useRef, useId, lazy, Suspense } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams, type NavigateFunction, } from 'react-router-dom';
import { listColleaguesAsUsers } from '@entities/contacts';
import { routes, getProjectDetailUrl } from '@shared/config';
import { useI18n, ttProjectTypeLabel } from '@shared/i18n';
import { formatDecimalHoursAsHm } from '@shared/lib/formatTrackingHours';
import { waitForAppFonts } from '@shared/lib/waitForAppFonts';
import { useCurrentUser } from '@shared/hooks';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog, DatePicker, SearchableSelect } from '@shared/ui';
import { periodToDates, reportsAllTimeDateFrom, reportsAllTimeDateTo } from '@entities/time-tracking/lib/reportsPeriodRange';
import { canAccessTimeTracking, canManageTimeTrackingClients, hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { INVOICE_STATUS_LABELS, listAllTimeManagerClientsMerged, listAllClientProjectsMerged, getClientProject, getClientProjectDashboard, getProjectTeamWorkload, listTimeTrackingUsers, listUsersWithProjectAccessToProject, listPartnerUsersWithProjectAccessToProject, listPartnerReportConfirmationsPendingItems, listPartnerReportConfirmationsConfirmed, confirmPartnerReportConfirmation, submitPartnerReportConfirmationFromPreview, parsePartnerReportConfirmationRequest, createClientProject, patchClientProject, deleteClientProject, getTimeManagerClient, readTimeManagerProjectBillableRateAmount, readProjectRecordsLanguage, notifyPartnerConfirmedReportsListInvalidate, exportReportV2, type ProjectPartnerAccessRow, type PartnerReportConfirmationRequest, type TimeManagerClientProjectCreatePayload, type TimeManagerClientProjectRow, type TimeManagerClientRow, type TimeManagerProjectDashboard, type TimeManagerProjectDashboardBudget, type TeamWorkloadMember, type TeamWorkloadResponse, type ReportFiltersV2, } from '@entities/time-tracking';
import { writeReportPreviewTransfer, type ReportPreviewTransferV2 } from '@entities/time-tracking/model/reportPreviewTransfer';
import { ClientProjectModal } from '@pages/time-tracking/ui/TimeTrackingClientProjectModal';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
import { buildProjectArchiveTogglePatch, buildProjectPauseTogglePatch } from '@entities/time-tracking/lib/projectArchiveRestore';
import { memberWeeklyCapacityHours } from '@entities/time-tracking/model/memberWeeklyCapacity';
import type { ProjectRow, TimeUserRow, TimeUsersTotals } from '@entities/time-tracking/model/types';
import { summaryTeamWeeklyCapacityHours } from '@entities/time-tracking/model/summaryTeamWeeklyCapacity';
import { TimeUsersSummary } from '@pages/time-tracking/ui/TimeUsersSummary';
import { TimeUsersTable } from '@pages/time-tracking/ui/TimeUsersTable';
import '@pages/time-tracking/ui/TimeUsersShared.css';
import './ProjectDetailPage.css';
import { ProjectDuplicatesPanel } from './ProjectDuplicatesPanel';

const ProjectDetailCharts = lazy(() => import('./ProjectDetailCharts').then((m) => ({ default: m.ProjectDetailCharts })));
function navigateBackToProjects(navigate: NavigateFunction) {
    const run = () => {
        navigate({ pathname: routes.timeTracking, search: '?tab=projects' });
    };
    if (typeof document === 'undefined') {
        run();
        return;
    }
    const doc = document as Document & {
        startViewTransition?: (cb: () => void) => void;
    };
    if (typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(run);
    }
    else {
        run();
    }
}
function fmtAmt(n: number, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}
function fmtMoney(n: number, cur: string) {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}
function memberInitials(name: string): string {
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
function defaultProjectTeamPeriod(): {
    from: string;
    to: string;
} {
    // Align with reports: full current calendar month (not month-to-date).
    const { dateFrom, dateTo } = periodToDates(new Date(), 'month');
    return { from: dateFrom, to: dateTo };
}
function fullProjectTeamPeriod(): {
    from: string;
    to: string;
} {
    const now = new Date();
    return {
        from: reportsAllTimeDateFrom(now),
        to: reportsAllTimeDateTo(now),
    };
}
type PdpPeriodPresetId = 'week' | 'month' | 'quarter' | 'year' | 'all';
const PDP_PERIOD_PRESETS: {
    id: PdpPeriodPresetId;
    label: string;
}[] = [
        { id: 'week', label: 'Эта неделя' },
        { id: 'month', label: 'Этот месяц' },
        { id: 'quarter', label: 'Этот квартал' },
        { id: 'year', label: 'Этот год' },
        { id: 'all', label: 'За всё время' },
    ];
function periodPresetToRange(id: PdpPeriodPresetId): {
    from: string;
    to: string;
} {
    if (id === 'all')
        return fullProjectTeamPeriod();
    // Same calendar bounds as Reports «Этот месяц/неделя/…» (full period, not MTD).
    const { dateFrom, dateTo } = periodToDates(new Date(), id);
    return { from: dateFrom, to: dateTo };
}
function formatDetailPeriodLabel(period: {
    from: string;
    to: string;
}): string {
    const parse = (s: string) => {
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
function teamWorkloadMemberToTimeUserRow(m: TeamWorkloadMember, periodDays: number, profileWeeklyHours: number | undefined, position: string | undefined,): TimeUserRow {
    const name = (m.display_name?.trim() || m.email || `Пользователь ${m.auth_user_id}`).trim();
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
function fmtDashboardBudgetValue(b: TimeManagerProjectDashboardBudget): string {
    if (b.budgetBy === 'none')
        return '—';
    if (b.budgetBy === 'hours_and_money' && b.money)
        return `${b.money.budget.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
    if (b.budgetBy === 'hours')
        return formatDecimalHoursAsHm(b.budget);
    return `${b.budget.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
}
function fmtDashboardBudgetSpentRemaining(b: TimeManagerProjectDashboardBudget, value: number): string {
    if (b.budgetBy === 'none')
        return '—';
    if (b.budgetBy === 'hours_and_money' && b.money)
        return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
    if (b.budgetBy === 'hours')
        return formatDecimalHoursAsHm(value);
    return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${b.currency}`;
}

function deriveDashboardBudgetSliceRemaining(slice: { budget: number; spent: number; remaining: number }): number {
    const { budget, spent } = slice;
    if (Number.isFinite(budget) && budget > 0 && Number.isFinite(spent))
        return budget - spent;
    return slice.remaining;
}

function deriveDashboardBudgetHeadlineRemaining(b: TimeManagerProjectDashboardBudget): number {
    if (b.budgetBy === 'hours_and_money' && b.money)
        return deriveDashboardBudgetSliceRemaining(b.money);
    if (Number.isFinite(b.budget) && b.budget > 0 && Number.isFinite(b.spent))
        return b.budget - b.spent;
    return b.remaining;
}
type WeekPoint = {
    idx: number;
    dayLabel: string;
    value: number;
    isThisWeek: boolean;
    isMonthStart: boolean;
    monthName: string;
    year: string;
    stackBillable?: number;
    stackNonBillable?: number;
};
type ProjectProgressChartMode = 'money' | 'billable_hours_cumulative';
function buildWeeks(weeks: number): WeekPoint[] {
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
function isWeekContainingToday(weekStartIso: string): boolean {
    const day = weekStartIso.slice(0, 10);
    const parts = day.split('-').map((x) => parseInt(x, 10));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n)))
        return false;
    const start = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
}
function buildChartDataFromDashboard(dashboard: TimeManagerProjectDashboard): {
    progressData: WeekPoint[];
    hoursData: WeekPoint[];
    progressMode: ProjectProgressChartMode;
} {
    const prog = dashboard.progressByWeek.filter((x) => x.weekStart);
    const hrs = dashboard.hoursByWeek.filter((x) => x.weekStart);
    const order: string[] = [];
    const seen = new Set<string>();
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
    const weeksWithHoursSplit = new Set<string>();
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
    const progressData: WeekPoint[] = order.map((ws, idx) => {
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
    const progressMode: ProjectProgressChartMode = useHoursProgress ? 'billable_hours_cumulative' : 'money';
    let prevMonthH = -1;
    const hoursData: WeekPoint[] = order.map((ws, idx) => {
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
const IcoEdit = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
</svg>);
const IcoChevron = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
</svg>);
const IcoInfo = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
</svg>);
type TaskMemberRow = {
    userId: string;
    name: string;
    hours: number;
    billableAmt: number;
    costs: number;
};
type TaskRow = {
    id: string;
    name: string;
    hours: number;
    billableAmt: number;
    costs: number;
    currency: string;
    billable: boolean;
    expandable: boolean;
    members: TaskMemberRow[];
};
function dashboardTasksToTaskRows(tasks: TimeManagerProjectDashboard['tasks'], currency: string): {
    billable: TaskRow[];
    nonBillable: TaskRow[];
} {
    const billable: TaskRow[] = [];
    const nonBillable: TaskRow[] = [];
    for (const t of tasks) {
        const members: TaskMemberRow[] = (t.members ?? []).map((m) => ({
            userId: m.userId,
            name: m.name,
            hours: m.hours,
            billableAmt: m.billableAmount,
            costs: m.internalCostAmount,
        }));
        const row: TaskRow = {
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
function dashboardTasksAggregateFromTotals(totals: TimeManagerProjectDashboard['totals'], currency: string): {
    billable: TaskRow[];
    nonBillable: TaskRow[];
} {
    const billable: TaskRow[] = [];
    const nonBillable: TaskRow[] = [];
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
type DetailTabId = 'tasks' | 'team' | 'invoices' | 'duplicates';
function isLinkableMemberUserId(userId: string): boolean {
    const n = Number(String(userId ?? '').trim());
    return Number.isFinite(n) && n > 0;
}
function renderTaskTableRows(rows: TaskRow[], expanded: Set<string>, toggle: (id: string) => void, onOpenMemberReport?: (taskId: string, userId: string) => void) {
    return rows.flatMap((r) => {
        const isOpen = expanded.has(r.id);
        const mainRow = (<tr key={r.id} className={`pdp__tasks-row${isOpen ? ' pdp__tasks-row--expanded' : ''}`}>
            <td className="pdp__tasks-td pdp__tasks-td--name">
                {r.expandable ? (<button type="button" className={`pdp__tasks-expand${isOpen ? ' pdp__tasks-expand--open' : ''}`} onClick={() => toggle(r.id)} aria-expanded={isOpen} aria-label={isOpen ? 'Свернуть детализацию' : 'Развернуть детализацию'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>) : (<span className="pdp__tasks-expand-placeholder" />)}
                {r.expandable ? (<button type="button" className="pdp__tasks-name-btn" onClick={() => toggle(r.id)} aria-expanded={isOpen}>
                    {r.name}
                </button>) : r.name}
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--hours">
                {r.hours > 0 ? (<button type="button" className="pdp__tasks-hours-link" onClick={() => r.expandable && toggle(r.id)}>
                    {formatDecimalHoursAsHm(r.hours)}
                </button>) : (<span className="pdp__tasks-zero">{formatDecimalHoursAsHm(0)}</span>)}
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--amt">
                {r.billableAmt > 0 ? (<span className="pdp__tasks-num">{fmtMoney(r.billableAmt, r.currency)}</span>) : (<span className="pdp__tasks-zero">{fmtMoney(0, r.currency)}</span>)}
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--costs">
                <span className="pdp__tasks-cost-with-icon">
                    {r.costs > 0 ? (<span className="pdp__tasks-num">{fmtMoney(r.costs, r.currency)}</span>) : (<span className="pdp__tasks-zero">{fmtMoney(0, r.currency)}</span>)}
                    <span className="pdp__tasks-warn-slot pdp__tasks-warn-slot--empty" aria-hidden />
                </span>
            </td>
        </tr>);
        if (!isOpen || !r.expandable)
            return [mainRow];
        const detailRows = r.members.map((m) => (<tr key={`${r.id}-${m.userId}`} className="pdp__tasks-detail-row">
            <td className="pdp__tasks-td pdp__tasks-td--name pdp__tasks-td--detail">
                <span className="pdp__tasks-detail-indent" aria-hidden />
                <span className="pdp__tasks-detail-name">{m.name}</span>
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--hours pdp__tasks-td--detail">
                {m.hours > 0 && onOpenMemberReport && isLinkableMemberUserId(m.userId) ? (<button type="button" className="pdp__tasks-hours-link" title="Открыть детальный отчёт по сотруднику и задаче" onClick={() => onOpenMemberReport(r.id, m.userId)}>
                    {formatDecimalHoursAsHm(m.hours)}
                </button>) : (<span className="pdp__tasks-num">{formatDecimalHoursAsHm(m.hours)}</span>)}
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--amt pdp__tasks-td--detail">
                {m.billableAmt > 0 ? (<span className="pdp__tasks-num">{fmtMoney(m.billableAmt, r.currency)}</span>) : (<span className="pdp__tasks-zero">{fmtMoney(0, r.currency)}</span>)}
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--costs pdp__tasks-td--detail">
                <span className="pdp__tasks-cost-with-icon">
                    {m.costs > 0 ? (<span className="pdp__tasks-num">{fmtMoney(m.costs, r.currency)}</span>) : (<span className="pdp__tasks-zero">{fmtMoney(0, r.currency)}</span>)}
                    <span className="pdp__tasks-warn-slot pdp__tasks-warn-slot--empty" aria-hidden />
                </span>
            </td>
        </tr>));
        return [mainRow, ...detailRows];
    });
}
function TasksPanel({ rows, nonBillableRows, totalHours, totalAmt, currency, periodSubtitle, breakdownHint, onOpenMemberReport, onPreviewEntries, activePeriodPresetId, activePeriodPresetLabel, onSelectPeriodPreset, onExport, exportBusy, }: {
    rows: TaskRow[];
    nonBillableRows: TaskRow[];
    totalHours: number;
    totalAmt: number;
    currency: string;
    periodSubtitle?: string;
    breakdownHint?: string;
    onOpenMemberReport?: (taskId: string, userId: string) => void;
    onPreviewEntries?: () => void;
    activePeriodPresetId?: PdpPeriodPresetId;
    activePeriodPresetLabel: string;
    onSelectPeriodPreset: (id: PdpPeriodPresetId) => void;
    onExport: (format: 'xlsx' | 'csv') => void;
    exportBusy?: boolean;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const periodMenuRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!periodMenuOpen && !exportMenuOpen)
            return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (periodMenuOpen && periodMenuRef.current && !periodMenuRef.current.contains(t))
                setPeriodMenuOpen(false);
            if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(t))
                setExportMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [periodMenuOpen, exportMenuOpen]);
    const toggle = useCallback((id: string) => {
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
    return (<div className="pdp__tasks pdp__tasks-panel">
        <div className="pdp__tasks-toolbar">
            <div className="pdp__tasks-toolbar-left">
                <span className="pdp__tasks-heading">Задачи по проекту</span>
                <span className="pdp__tasks-subheading">{periodSubtitle ?? 'За всё время'}</span>
            </div>
            <div className="pdp__tasks-toolbar-right">
                {onPreviewEntries ? (<button type="button" className="pdp__tasks-preview-btn" onClick={onPreviewEntries} title="Открыть предпросмотр всех записей проекта за выбранный период">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    Предпросмотр записей
                </button>) : null}
                <div className="pdp__period-preset-wrap" ref={periodMenuRef}>
                    <button type="button" className={`pdp__tasks-filter-btn${periodMenuOpen ? ' pdp__tasks-filter-btn--open' : ''}`} onClick={() => setPeriodMenuOpen((v) => !v)} aria-expanded={periodMenuOpen} aria-haspopup="menu">
                        {activePeriodPresetLabel}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>
                    {periodMenuOpen ? (<div className="pdp__period-preset-menu" role="menu">
                        {PDP_PERIOD_PRESETS.map((p) => (<button key={p.id} type="button" role="menuitemradio" aria-checked={activePeriodPresetId === p.id} className={`pdp__period-preset-item${activePeriodPresetId === p.id ? ' pdp__period-preset-item--active' : ''}`} onClick={() => {
                            onSelectPeriodPreset(p.id);
                            setPeriodMenuOpen(false);
                        }}>
                            {p.label}
                        </button>))}
                    </div>) : null}
                </div>
                <div className="pdp__period-preset-wrap" ref={exportMenuRef}>
                    <button type="button" className={`pdp__tasks-export-btn${exportMenuOpen ? ' pdp__tasks-export-btn--open' : ''}`} disabled={exportBusy} onClick={() => setExportMenuOpen((v) => !v)} aria-expanded={exportMenuOpen} aria-haspopup="menu">
                        {exportBusy ? 'Экспорт…' : 'Экспорт'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>
                    {exportMenuOpen && !exportBusy ? (<div className="pdp__period-preset-menu" role="menu">
                        <button type="button" role="menuitem" className="pdp__period-preset-item" onClick={() => {
                            setExportMenuOpen(false);
                            onExport('xlsx');
                        }}>
                            Excel (.xlsx)
                        </button>
                        <button type="button" role="menuitem" className="pdp__period-preset-item" onClick={() => {
                            setExportMenuOpen(false);
                            onExport('csv');
                        }}>
                            CSV
                        </button>
                    </div>) : null}
                </div>
            </div>
        </div>

        {breakdownHint ? (<p className="pdp__tasks-breakdown-hint">{breakdownHint}</p>) : null}

        <div className="pdp__tasks-sections">
            <section className="pdp__tasks-section" aria-labelledby="pdp-tasks-billable-heading">
                <div className="pdp__tasks-section__head">
                    <h3 id="pdp-tasks-billable-heading" className="pdp__tasks-section__title">
                        Оплачиваемые задачи
                    </h3>
                </div>
                <div className="pdp__tasks-section__table-wrap">
                    <table className="pdp__tasks-table">
                        <colgroup>
                            <col className="pdp__tasks-col pdp__tasks-col--name" />
                            <col className="pdp__tasks-col pdp__tasks-col--hours" />
                            <col className="pdp__tasks-col pdp__tasks-col--amt" />
                            <col className="pdp__tasks-col pdp__tasks-col--costs" />
                        </colgroup>
                        <thead>
                            <tr className="pdp__tasks-thead">
                                <th className="pdp__tasks-th pdp__tasks-th--name">Задача</th>
                                <th className="pdp__tasks-th pdp__tasks-th--hours">
                                    <span className="pdp__tasks-th-hours-label">
                                        Часы
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="pdp__tasks-sort">
                                            <path d="M18 15l-6-6-6 6" />
                                        </svg>
                                    </span>
                                </th>
                                <th className="pdp__tasks-th pdp__tasks-th--amt">Оплачиваемая сумма</th>
                                <th className="pdp__tasks-th pdp__tasks-th--costs">Затраты</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (<tr className="pdp__tasks-placeholder-row">
                                <td className="pdp__tasks-placeholder-cell" colSpan={4}>
                                    <p className="pdp__tasks-placeholder-text">Пока нет оплачиваемых задач с часами за выбранный период.</p>
                                </td>
                            </tr>)}
                            {renderTaskTableRows(rows, expanded, toggle, onOpenMemberReport)}
                            <tr className="pdp__tasks-total-row">
                                <td className="pdp__tasks-td pdp__tasks-td--name">
                                    <strong>Итого</strong>
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--hours">
                                    {totalHours > 0 ? (<button type="button" className="pdp__tasks-hours-link pdp__tasks-hours-link--bold">
                                        {formatDecimalHoursAsHm(totalHours)}
                                    </button>) : (<span className="pdp__tasks-zero">{formatDecimalHoursAsHm(totalHours)}</span>)}
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--amt">
                                    <strong className="pdp__tasks-num">{fmtMoney(totalAmt, currency)}</strong>
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--costs">
                                    <span className="pdp__tasks-cost-with-icon">
                                        <strong className="pdp__tasks-num">
                                            {billableTotalCosts > 0
                                                ? fmtMoney(billableTotalCosts, currency)
                                                : fmtMoney(0, currency)}
                                        </strong>
                                        <span className="pdp__tasks-warn-slot">
                                            <button type="button" className="pdp__tasks-warn-btn" title={costsWarnTitle} aria-label={costsWarnTitle}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pdp__tasks-warn">
                                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                    <line x1="12" y1="9" x2="12" y2="13" />
                                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                                </svg>
                                            </button>
                                        </span>
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="pdp__tasks-section" aria-labelledby="pdp-tasks-nonbill-heading">
                <div className="pdp__tasks-section__head">
                    <h3 id="pdp-tasks-nonbill-heading" className="pdp__tasks-section__title">
                        Неоплачиваемые задачи
                    </h3>
                </div>
                <div className="pdp__tasks-section__table-wrap">
                    <table className="pdp__tasks-table">
                        <colgroup>
                            <col className="pdp__tasks-col pdp__tasks-col--name" />
                            <col className="pdp__tasks-col pdp__tasks-col--hours" />
                            <col className="pdp__tasks-col pdp__tasks-col--amt" />
                            <col className="pdp__tasks-col pdp__tasks-col--costs" />
                        </colgroup>
                        <thead>
                            <tr className="pdp__tasks-thead">
                                <th className="pdp__tasks-th pdp__tasks-th--name">Задача</th>
                                <th className="pdp__tasks-th pdp__tasks-th--hours">
                                    <span className="pdp__tasks-th-hours-label">
                                        Часы
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="pdp__tasks-sort">
                                            <path d="M18 15l-6-6-6 6" />
                                        </svg>
                                    </span>
                                </th>
                                <th className="pdp__tasks-th pdp__tasks-th--amt">Оплачиваемая сумма</th>
                                <th className="pdp__tasks-th pdp__tasks-th--costs">Затраты</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nonBillableRows.length === 0 && (<tr className="pdp__tasks-placeholder-row">
                                <td className="pdp__tasks-placeholder-cell" colSpan={4}>
                                    <p className="pdp__tasks-placeholder-text">Пока нет неоплачиваемых задач с часами за выбранный период.</p>
                                </td>
                            </tr>)}
                            {renderTaskTableRows(nonBillableRows, expanded, toggle, onOpenMemberReport)}
                            <tr className="pdp__tasks-total-row">
                                <td className="pdp__tasks-td pdp__tasks-td--name">
                                    <strong>Итого</strong>
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--hours">
                                    <span className={nonBillTotal > 0 ? 'pdp__tasks-hours-link' : 'pdp__tasks-zero'}>
                                        {formatDecimalHoursAsHm(nonBillTotal)}
                                    </span>
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--amt">
                                    <strong className="pdp__tasks-num">
                                        {nonBillTotalAmt > 0 ? fmtMoney(nonBillTotalAmt, currency) : fmtMoney(0, currency)}
                                    </strong>
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--costs">
                                    <span className="pdp__tasks-cost-with-icon">
                                        <strong className="pdp__tasks-num">
                                            {nonBillTotalCosts > 0 ? fmtMoney(nonBillTotalCosts, currency) : fmtMoney(0, currency)}
                                        </strong>
                                        <span className="pdp__tasks-warn-slot pdp__tasks-warn-slot--empty" aria-hidden />
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>);
}
const TYPE_COLOR: Record<string, {
    color: string;
    bg: string;
}> = {
    'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Пакет часов': { color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
};
async function loadProjectDetailRow(projectId: string, clientIdHint: string | null): Promise<ProjectRow | null> {
    if (clientIdHint) {
        try {
            const clients = await listAllTimeManagerClientsMerged();
            const client = clients.find((c) => c.id === clientIdHint);
            if (client) {
                const p = await getClientProject(clientIdHint, projectId);
                return mapClientProjectToProjectRow(p, client);
            }
        }
        catch {
        }
    }
    const [clients, allProjects] = await Promise.all([
        listAllTimeManagerClientsMerged(),
        listAllClientProjectsMerged(true),
    ]);
    const hit = allProjects.find((x) => x.id === projectId);
    if (!hit)
        return null;
    const client = clients.find((c) => c.id === hit.client_id);
    if (!client)
        return null;
    return mapClientProjectToProjectRow(hit, client);
}
function duplicateProjectCreatePayload(src: TimeManagerClientProjectRow): TimeManagerClientProjectCreatePayload {
    const amt = src.budget_amount != null && String(src.budget_amount).trim() !== ''
        ? src.budget_amount
        : (src.project_type === 'fixed_fee' && src.fixed_fee_amount != null && String(src.fixed_fee_amount).trim() !== ''
            ? src.fixed_fee_amount
            : null);
    const prog = src.progress_budget_amount != null && String(src.progress_budget_amount).trim() !== ''
        ? src.progress_budget_amount
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
function emptyDashboardCharts(): {
    progressData: WeekPoint[];
    hoursData: WeekPoint[];
    progressMode: ProjectProgressChartMode;
} {
    const z = buildWeeks(13).map((w) => ({ ...w, value: 0 }));
    return { progressData: z, hoursData: z, progressMode: 'money' };
}
function partnerConfirmPeriodMatches(req: {
    dateFrom: string;
    dateTo: string;
}, from: string, to: string): boolean {
    return req.dateFrom === from.slice(0, 10) && req.dateTo === to.slice(0, 10);
}
function partnerConfirmSessionKey(projectId: string, from: string, to: string): string {
    return `tt-partner-confirm:${projectId.trim()}:${from.slice(0, 10)}:${to.slice(0, 10)}`;
}
function loadPartnerConfirmFromSession(projectId: string, from: string, to: string): PartnerReportConfirmationRequest | null {
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
function savePartnerConfirmToSession(projectId: string, from: string, to: string, req: PartnerReportConfirmationRequest): void {
    try {
        sessionStorage.setItem(partnerConfirmSessionKey(projectId, from, to), JSON.stringify(req));
    }
    catch {

    }
}
function ProjectPartnerReportPanel({ projectId, detailPeriod, currentUserId, }: {
    projectId: string;
    detailPeriod: {
        from: string;
        to: string;
    };
    currentUserId: number | null;
}) {
    const { showAlert, showConfirm } = useAppDialog();
    const [partners, setPartners] = useState<ProjectPartnerAccessRow[]>([]);
    const [partnersLoad, setPartnersLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('loading');
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState<PartnerReportConfirmationRequest | null>(null);
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
        const hit = (req: PartnerReportConfirmationRequest | null | undefined) => req?.signatures.find((s) => s.partnerAuthUserId === currentUserId);
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
    const fmtConfirmed = (iso: string) => {
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
    const partnerActions = (<div className="pdp__partner-report-actions">
        {listsLoad === 'loading' ? (<span className="pdp__partner-report-status">Загрузка запросов на подтверждение…</span>) : null}
        {listsLoad === 'error' ? (<span className="pdp__partner-report-muted pdp__partner-report-muted--error" role="alert">
            Не удалось загрузить статус подтверждений отчётов.
        </span>) : null}
        {showPartnerConfirmBtn ? (<button type="button" className="pdp__partner-report-btn" onClick={() => void handleConfirmReport()} disabled={confirmBusy}>
            {confirmBusy ? 'Отправка…' : 'Подтвердить принятие отчёта'}
        </button>) : null}
        {listsLoad === 'ok' && fullyConfirmed && mySig ? (<span className="pdp__partner-report-status pdp__partner-report-status--ok">
            Все необходимые партнёры подтвердили отчёт за этот период. Ваша подпись: {fmtConfirmed(mySig.confirmedAt)}.
        </span>) : null}
        {listsLoad === 'ok' && fullyConfirmed && !mySig ? (<span className="pdp__partner-report-status pdp__partner-report-status--ok">
            Отчёт за этот период полностью подтверждён партнёрами.
        </span>) : null}
        {listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig ? (<span className="pdp__partner-report-status pdp__partner-report-status--ok">
            Вы подтвердили принятие отчёта ({fmtConfirmed(mySig.confirmedAt)}). Ожидаются подписи других партнёров.
        </span>) : null}
    </div>);
    return (<section className="pdp__partner-report" aria-labelledby="pdp-partner-report-heading">
        <div className="pdp__partner-report-head">
            <h2 id="pdp-partner-report-heading" className="pdp__partner-report-title">
                Партнёры проекта
            </h2>
            {partnerActions}
        </div>
        <p className="pdp__partner-report-hint">
            Подтвердите отчёт за период карточки как партнёр. После подписей всех партнёров запись попадает в список подтверждённых на сервере; то же действие доступно из предпросмотра отчёта.
        </p>
        {partners.length === 0 ? (<p className="pdp__partner-report-muted">Нет партнёров с доступом к проекту.</p>) : (<ul className="pdp__partner-report-list">
            {partners.map((p) => (<li key={p.authUserId} className="pdp__partner-report-item">
                <span className="pdp__partner-report-name">{p.displayName}</span>
                {p.position ? (<span className="pdp__partner-report-pos">{p.position}</span>) : null}
                {currentUserId === p.authUserId ? (<span className="pdp__partner-report-you">Вы</span>) : null}
            </li>))}
        </ul>)}
    </section>);
}
function ProjectDetailPageSkeleton() {
    return (<div className="pdp pdp--loading" aria-busy="true" aria-label="Загрузка проекта">
        <header className="pdp__header pdp__header--skeleton">
            <div className="pdp__header-left">
                <span className="pdp__skel pdp__skel--back" aria-hidden />
                <span className="pdp__skel pdp__skel--title" aria-hidden />
                <span className="pdp__skel pdp__skel--badge" aria-hidden />
            </div>
            <div className="pdp__header-right">
                <span className="pdp__skel pdp__skel--btn" aria-hidden />
                <span className="pdp__skel pdp__skel--btn" aria-hidden />
                <span className="pdp__skel pdp__skel--btn" aria-hidden />
            </div>
        </header>
        <div className="pdp__body pdp__body--skeleton">
            <span className="pdp__skel pdp__skel--chart" aria-hidden />
            <div className="pdp__skel-stats">
                <span className="pdp__skel pdp__skel--stat" aria-hidden />
                <span className="pdp__skel pdp__skel--stat" aria-hidden />
                <span className="pdp__skel pdp__skel--stat" aria-hidden />
                <span className="pdp__skel pdp__skel--stat" aria-hidden />
            </div>
        </div>
    </div>);
}

function ProjectDetailBody({ project, dashboard, dashboardError, detailPeriod, onDetailPeriodChange, canManageInvoices, canManageProjects, onProjectRefresh, currentUserId, dashboardRefreshing, }: {
    project: ProjectRow;
    dashboard: TimeManagerProjectDashboard | null | undefined;
    dashboardError: string | null;
    detailPeriod: {
        from: string;
        to: string;
    };
    onDetailPeriodChange: (p: {
        from: string;
        to: string;
    }) => void;
    canManageInvoices: boolean;
    canManageProjects: boolean;
    onProjectRefresh: () => void;
    currentUserId: number | null;
    dashboardRefreshing: boolean;
}) {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAppDialog();
    const openMemberDetailReport = useCallback((taskId: string, userId: string) => {
        const uid = String(userId ?? '').trim();
        if (!uid || !Number.isFinite(Number(uid)))
            return;
        const tid = String(taskId ?? '').trim();
        const filters: ReportFiltersV2 = {
            dateFrom: detailPeriod.from.slice(0, 10),
            dateTo: detailPeriod.to.slice(0, 10),
            project_id: project.id,
            user_id: uid,
            task_id: tid || undefined,
            page: 1,
            per_page: 100,
        };
        const payload: ReportPreviewTransferV2 = { v: 2, reportType: 'time', groupBy: 'projects', filters };
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }, [project.id, detailPeriod.from, detailPeriod.to, navigate]);
    const openProjectPeriodReport = useCallback(() => {
        const filters: ReportFiltersV2 = {
            dateFrom: detailPeriod.from.slice(0, 10),
            dateTo: detailPeriod.to.slice(0, 10),
            project_id: project.id,
            page: 1,
            per_page: 100,
        };
        const payload: ReportPreviewTransferV2 = { v: 2, reportType: 'time', groupBy: 'projects', filters };
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }, [project.id, detailPeriod.from, detailPeriod.to, navigate]);
    const detailPeriodRangeId = useId();
    const { t } = useI18n();
    const backToProjectsLabel = t('timeTrackingPage.projects.newProjectPage.backToProjects');
    const onBackToProjects = useCallback(() => navigateBackToProjects(navigate), [navigate]);
    const [chartTab, setChartTab] = useState<'progress' | 'hours'>('progress');
    const [actionsOpen, setActionsOpen] = useState(false);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
    const periodMenuRef = useRef<HTMLDivElement>(null);
    const [editProjectRow, setEditProjectRow] = useState<TimeManagerClientProjectRow | null>(null);
    const [editClientRow, setEditClientRow] = useState<TimeManagerClientRow | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    useEffect(() => {
        if (!actionsOpen)
            return;
        const onDown = (e: MouseEvent) => {
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
        const onDown = (e: MouseEvent) => {
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
            let teamIds: number[] = [];
            try {
                const team = await listUsersWithProjectAccessToProject(project.id);
                teamIds = [...new Set(team.map((m) => Number(m.userId)).filter((n) => Number.isFinite(n) && n > 0))];
            }
            catch {
                teamIds = [];
            }
            const shouldCloneTeamOnCreate = (String(p.billable_rate_type ?? '').trim() || 'person_billable_rate') !== 'person_billable_rate';
            const payload: TimeManagerClientProjectCreatePayload = teamIds.length > 0 && shouldCloneTeamOnCreate
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
    const handleTasksExport = useCallback(async (format: 'xlsx' | 'csv') => {
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
    const handleTasksPeriodPreset = useCallback((id: PdpPeriodPresetId) => {
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
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTabId>('tasks');
    const detailTabDefs = useMemo((): [
        DetailTabId,
        string
    ][] => {
        const base: [
            DetailTabId,
            string
        ][] = [
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
    const [projectTeamWl, setProjectTeamWl] = useState<TeamWorkloadResponse | null>(null);
    const [teamProfileWeeklyById, setTeamProfileWeeklyById] = useState<Map<number, number>>(() => new Map());
    const [projectTeamPositionById, setProjectTeamPositionById] = useState<Map<number, string>>(() => new Map());
    const [projectTeamLoad, setProjectTeamLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [teamActionsOpen, setTeamActionsOpen] = useState<string | null>(null);
    useEffect(() => {
        if (detailTab !== 'team')
            return;
        let cancelled = false;
        setProjectTeamLoad('loading');
        setProjectTeamWl(null);
        setTeamProfileWeeklyById(new Map());
        setProjectTeamPositionById(new Map());
        void Promise.all([
            getProjectTeamWorkload(project.clientId, project.id, detailPeriod.from, detailPeriod.to),
            listTimeTrackingUsers().catch(() => []),
            listColleaguesAsUsers().catch(() => []),
        ])
            .then(([d, ttUsers, orgUsers]) => {
                if (cancelled)
                    return;
                const weekly = new Map<number, number>();
                for (const r of ttUsers) {
                    if (r.weekly_capacity_hours == null)
                        continue;
                    const w = typeof r.weekly_capacity_hours === 'number'
                        ? r.weekly_capacity_hours
                        : parseFloat(String(r.weekly_capacity_hours).replace(',', '.'));
                    if (Number.isFinite(w) && w > 0)
                        weekly.set(r.id, w);
                }
                const posAuth = new Map<number, string>();
                for (const u of orgUsers) {
                    const p = u.position?.trim();
                    if (p)
                        posAuth.set(u.id, p);
                }
                const posMerged = new Map<number, string>();
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
                }
                setProjectTeamPositionById(posMerged);
                setTeamProfileWeeklyById(weekly);
                setProjectTeamWl(d);
                setProjectTeamLoad('ok');
            })
            .catch(() => {
                if (!cancelled) {
                    setProjectTeamWl(null);
                    setTeamProfileWeeklyById(new Map());
                    setProjectTeamPositionById(new Map());
                    setProjectTeamLoad('error');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [detailTab, project.clientId, project.id, detailPeriod.from, detailPeriod.to]);
    const projectTeamUsers = useMemo((): TimeUserRow[] => {
        if (!projectTeamWl?.members?.length)
            return [];
        const days = projectTeamWl.period_days > 0 ? projectTeamWl.period_days : 1;
        return projectTeamWl.members.map((m) => teamWorkloadMemberToTimeUserRow(m, days, teamProfileWeeklyById.get(m.auth_user_id), projectTeamPositionById.get(m.auth_user_id)));
    }, [projectTeamWl, teamProfileWeeklyById, projectTeamPositionById]);
    const projectTeamTotals: TimeUsersTotals | null = useMemo(() => {
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
    const spent = dashboardOk ? dashboard!.totals.billableAmount : project.spent;
    const unbilled = dashboardOk ? dashboard!.totals.unbilledAmount : project.spent;
    const expenseEquivalentTotal = dashboardOk ? dashboard!.totals.expenseEquivalentTotal : 0;
    const expenseAmountUzs = dashboardOk ? dashboard!.totals.expenseAmountUzs : 0;
    const expenseCount = dashboardOk ? dashboard!.totals.expenseCount : 0;
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
            ? project.budget! - spentForBudget
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
            ? project.budget!
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
            ? Math.min((spentForBudget / project.budget!) * 100, 100)
            : 0;
    const singleBudgetUsedRawPct = apiBudget != null && !budgetDual && apiBudget.budget > 0
        ? (apiBudget.spent / apiBudget.budget) * 100
        : null;
    const overPct = apiBudget != null && !budgetDual && apiBudget.budget > 0 && isOver
        ? Math.min(Math.max((apiBudget.spent / apiBudget.budget) * 100 - 100, 0), 100)
        : isOver && hasBudget && apiBudget == null && hasLegacyBudget
            ? Math.min(((spentForBudget - project.budget!) / project.budget!) * 100, 50)
            : 0;
    const dualMoneyUsedRawPct = budgetDual != null && budgetDual.money.budget > 0
        ? (budgetDual.money.spent / budgetDual.money.budget) * 100
        : null;
    const dualHoursUsedRawPct = budgetDual != null && budgetDual.hours.budget > 0
        ? (budgetDual.hours.spent / budgetDual.hours.budget) * 100
        : null;
    const totalHours: number | null = dashboardOk
        ? dashboard!.totals.totalHours
        : dashboardError
            ? null
            : +(project.spent / 50000).toFixed(2);
    const billable: number | null = dashboardOk
        ? dashboard!.totals.billableHours
        : dashboardError
            ? null
            : totalHours != null
                ? +(totalHours * 0.92).toFixed(2)
                : null;
    const nonBill: number | null = dashboardOk
        ? dashboard!.totals.nonBillableHours
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
            return { billable: [] as TaskRow[], nonBillable: [] as TaskRow[] };
        }
        if (dashboard != null) {
            if (dashboard.tasks.length > 0) {
                return dashboardTasksToTaskRows(dashboard.tasks, displayCurrency);
            }
            const t = dashboard.totals;
            if (t.totalHours > 0 || t.billableHours > 0 || t.nonBillableHours > 0) {
                return dashboardTasksAggregateFromTotals(t, displayCurrency);
            }
            return { billable: [] as TaskRow[], nonBillable: [] as TaskRow[] };
        }
        return { billable: [] as TaskRow[], nonBillable: [] as TaskRow[] };
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
        ? dashboard!.totals.internalCostAmount
        : project.costs;
    const internalCostsComplete = dashboardOk ? dashboard!.totals.internalCostsComplete : false;
    const memberFilterOptions = useMemo(() => {
        if (!dashboardOk || !dashboard)
            return [] as {
                id: string;
                name: string;
            }[];
        const team = (dashboard.team ?? []).filter((m) => isLinkableMemberUserId(m.userId) && m.hours > 0);
        if (team.length)
            return team.map((m) => ({ id: m.userId, name: m.name })).sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
        const agg = new Map<string, {
            id: string;
            name: string;
            hours: number;
        }>();
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
        const pick = (rows: TaskRow[]): TaskRow[] => rows.flatMap((r) => {
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
    return (<div className="pdp pdp--ready">
        <header className="pdp__header">
            <div className="pdp__header-left">
                <AppBackButton onClick={onBackToProjects} label={backToProjectsLabel} ariaLabel={backToProjectsLabel} />
                <AppHomeLogo withSeparator />
                <div className="pdp__title-block">
                    <div className="pdp__title-row">
                        <h1 className="pdp__title">{project.name} — ({project.client})</h1>
                        <span className="pdp__type-badge" style={{ color: typeMeta.color, background: typeMeta.bg }}>
                            {ttProjectTypeLabel(project.type, t)}
                        </span>
                        {project.status === 'paused' ? (<span className="pdp__type-badge" style={{ color: '#b45309', background: '#fffbeb' }}>
                            На паузе
                        </span>) : null}
                        {project.status === 'archived' ? (<span className="pdp__type-badge" style={{ color: '#64748b', background: '#f1f5f9' }}>
                            Архив
                        </span>) : null}
                    </div>
                </div>
            </div>
            <div className="pdp__header-right app-page-header-end">
                <AppPageSettings />
                <button type="button" className="pdp__edit-btn" onClick={() => void openProjectEdit()} disabled={!canManageProjects || actionBusy} title={!canManageProjects ? 'Доступно администраторам и партнёру' : 'Редактировать проект'}>
                    <IcoEdit /> Редактировать
                </button>
                <div className="pdp__actions-wrap" ref={actionsMenuRef}>
                    <button type="button" className={`pdp__actions-btn${actionsOpen ? ' pdp__actions-btn--open' : ''}`} onClick={() => setActionsOpen(v => !v)} disabled={actionBusy} aria-expanded={actionsOpen}>
                        Действия <IcoChevron />
                    </button>
                    {actionsOpen && (<div className="pdp__actions-menu" role="menu">
                        {canManageProjects && (<>
                            {project.status !== 'archived' && (<button type="button" className="pdp__actions-item" role="menuitem" disabled={actionBusy} onClick={() => void handlePauseProject()}>
                                {project.status === 'paused' ? 'Снять с паузы' : 'На паузу'}
                            </button>)}
                            <button type="button" className="pdp__actions-item" role="menuitem" disabled={actionBusy} onClick={() => void handleArchiveProject()}>
                                {project.status === 'archived' ? 'Восстановить' : 'Архивировать'}
                            </button>
                            <button type="button" className="pdp__actions-item" role="menuitem" disabled={actionBusy} onClick={() => void handleDuplicateProject()}>
                                Дублировать
                            </button>
                        </>)}
                        <button type="button" className="pdp__actions-item" role="menuitem" onClick={handleExportProject}>
                            Экспорт
                        </button>
                        {canManageProjects && (<button type="button" className="pdp__actions-item pdp__actions-item--danger" role="menuitem" disabled={actionBusy} onClick={() => void handleDeleteProject()}>
                            Удалить
                        </button>)}
                    </div>)}
                </div>
            </div>
        </header>

        <div className={`pdp__body${dashboardRefreshing ? ' pdp__body--refreshing' : ''}`}>
            {dashboardError ? (<div className="pdp__dashboard-alert" role="alert">
                <p>Не удалось загрузить дашборд проекта: {dashboardError}</p>
            </div>) : null}

            <div className="pdp__period-bar" role="group" aria-label="Период дашборда и команды">
                <span className="pdp__period-bar-label">Период</span>
                <DatePicker
                    value={detailPeriod.from}
                    max={detailPeriod.to}
                    onChange={(iso) => {
                        const to = iso > detailPeriod.to ? iso : detailPeriod.to;
                        onDetailPeriodChange({ from: iso, to });
                    }}
                    portal
                    iconAfterLabel
                    aria-labelledby={`${detailPeriodRangeId}-from`}
                    buttonClassName="pdp__period-date-picker-btn"
                    title="Дата с"
                />
                <span id={`${detailPeriodRangeId}-from`} className="pdp__period-sr-only">Дата с</span>
                <span className="pdp__period-sep" aria-hidden>—</span>
                <DatePicker
                    value={detailPeriod.to}
                    min={detailPeriod.from}
                    onChange={(iso) => {
                        const from = iso < detailPeriod.from ? iso : detailPeriod.from;
                        onDetailPeriodChange({ from, to: iso });
                    }}
                    portal
                    iconAfterLabel
                    aria-labelledby={`${detailPeriodRangeId}-to`}
                    buttonClassName="pdp__period-date-picker-btn"
                    title="Дата по"
                />
                <span id={`${detailPeriodRangeId}-to`} className="pdp__period-sr-only">Дата по</span>
                <div className="pdp__period-actions">
                    {memberFilterOptions.length > 0 ? (<SearchableSelect<{ id: string; name: string }> portalDropdown className="pdp__period-member-select" buttonClassName="pdp__period-member-btn" aria-label="Фильтр по сотруднику" placeholder="Все сотрудники" value={selectedMemberId} items={[{ id: '', name: 'Все сотрудники' }, ...memberFilterOptions]} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.name} onSelect={(o) => setSelectedMemberId(o.id)} />) : null}
                    <div className="pdp__period-preset-wrap" ref={periodMenuRef}>
                        <button type="button" className={`pdp__period-preset-btn${periodMenuOpen ? ' pdp__period-preset-btn--open' : ''}`} onClick={() => setPeriodMenuOpen((v) => !v)} aria-expanded={periodMenuOpen} aria-haspopup="menu">
                            {activePeriodPreset?.label ?? 'Период'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                        {periodMenuOpen ? (<div className="pdp__period-preset-menu" role="menu">
                            {PDP_PERIOD_PRESETS.map((p) => (<button key={p.id} type="button" role="menuitemradio" aria-checked={activePeriodPreset?.id === p.id} className={`pdp__period-preset-item${activePeriodPreset?.id === p.id ? ' pdp__period-preset-item--active' : ''}`} onClick={() => {
                                onDetailPeriodChange(periodPresetToRange(p.id));
                                setPeriodMenuOpen(false);
                            }}>
                                {p.label}
                            </button>))}
                        </div>) : null}
                    </div>
                </div>
            </div>

            <ProjectPartnerReportPanel projectId={project.id} detailPeriod={detailPeriod} currentUserId={currentUserId} />

            <Suspense fallback={<div className="pdp__chart-card pdp__chart-card--loading" aria-hidden />}>
                <ProjectDetailCharts
                    chartTab={chartTab}
                    onChartTabChange={setChartTab}
                    dashboardOk={dashboardOk}
                    progressMode={progressMode}
                    progressData={progressData}
                    hoursData={hoursData}
                    hoverIdx={hoverIdx}
                    onHoverIdxChange={setHoverIdx}
                    thisWeekIdx={thisWeekIdx}
                    monthBoundaries={monthBoundaries}
                    hasBudget={hasBudget}
                    budgetLimitForChart={budgetLimitForChart}
                    displayCurrency={displayCurrency}
                    hoursChartStacked={hoursChartStacked}
                    yTicks={yTicks}
                    maxVal={maxVal}
                />
            </Suspense>
            <div className="pdp__stats">
                <div className="pdp__stat-card">
                    <p className="pdp__stat-label">Всего часов</p>
                    <p className="pdp__stat-value">
                        {displayTotalHours != null ? formatDecimalHoursAsHm(displayTotalHours) : '—'}
                    </p>
                    <div className="pdp__stat-rows">
                        <div className="pdp__stat-row">
                            <span>Оплачиваемые</span>
                            <span className="pdp__stat-row-val">
                                {displayBillableHours != null ? formatDecimalHoursAsHm(displayBillableHours) : '—'}
                            </span>
                        </div>
                        <div className="pdp__stat-row">
                            <span>Неоплачиваемые</span>
                            <span className="pdp__stat-row-val">
                                {displayNonBillHours != null ? formatDecimalHoursAsHm(displayNonBillHours) : '—'}
                            </span>
                        </div>
                    </div>
                </div>
                {dashboardOk && (<div className="pdp__stat-card">
                    <p className="pdp__stat-label">Расходы ({displayCurrency})</p>
                    <p className="pdp__stat-value">{fmtAmt(expenseEquivalentTotal, displayCurrency)}</p>
                    <p className="pdp__stat-hint">
                        Эквивалент заявок (как в модуле расходов) · {expenseCount} заявок (одобрено / оплачено / закрыто) · период как у фильтра дат выше
                    </p>
                    {expenseAmountUzs > 0 ? (<p className="pdp__stat-hint pdp__stat-hint--muted">
                        В сумах (UZS, без пересчёта по курсу):{' '}
                        {fmtAmt(expenseAmountUzs, 'UZS')}
                    </p>) : null}
                    {expenseCount === 0 && expenseEquivalentTotal === 0 && expenseAmountUzs === 0 ? (<p className="pdp__stat-hint pdp__stat-hint--muted">
                        Если заявки есть, убедитесь, что в них указан этот проект и что сервис расходов доступен бэкенду
                        учёта времени.
                    </p>) : null}
                </div>)}
                <div className="pdp__stat-card">
                    <p className="pdp__stat-label">
                        Остаток бюджета
                        {pctDenom != null && pctDenom > 0 && remaining != null && (overspendPct != null ? (<span className="pdp__stat-label-pct--over">
                            &nbsp;(перерасход {overspendPct}%)
                        </span>) : remainingPct != null ? (<span className="pdp__stat-label-pct">
                            &nbsp;(остаток +{remainingPct}%)
                        </span>) : null)}
                        {isOver && <span className="pdp__stat-info"><IcoInfo /></span>}
                    </p>
                    {remaining != null ? (<p className={`pdp__stat-value${isOver ? ' pdp__stat-value--red' : ''}`}>
                        {isOver ? '−' : ''}
                        {apiBudget != null
                            ? fmtDashboardBudgetSpentRemaining(apiBudget, Math.abs(remaining))
                            : fmtAmt(Math.abs(remaining), displayCurrency)}
                    </p>) : (<p className="pdp__stat-value pdp__stat-value--na">Без бюджета</p>)}
                    {hasBudget && (<div className="pdp__stat-budget-block">
                        {budgetDual ? (<>
                            <div className="pdp__stat-budget-row">
                                <span className="pdp__stat-budget-label">Лимит (деньги) за период</span>
                                <span className="pdp__stat-budget-val">
                                    {fmtDashboardBudgetValue(apiBudget!)}
                                </span>
                            </div>
                            {apiBudget != null && (dualMoneyUsedRawPct != null || apiBudget.percentUsedMoney != null && Number.isFinite(apiBudget.percentUsedMoney) || apiBudget.money?.percentUsed != null) && (<p className="pdp__stat-hint">
                                Использовано (деньги):{' '}
                                {Math.round(dualMoneyUsedRawPct ?? (apiBudget.percentUsedMoney ?? apiBudget.money?.percentUsed) ?? 0)}%
                            </p>)}
                            <div className="pdp__budget-bar">
                                <div className="pdp__budget-bar-fill pdp__budget-bar-fill--blue" style={{ width: `${dualMoneyUsedRawPct != null ? Math.min(100, dualMoneyUsedRawPct) : Math.min(100, budgetDual.money.budget > 0 ? (budgetDual.money.spent / budgetDual.money.budget) * 100 : 0)}%` }} />
                                {dualMoneyUsedRawPct != null && dualMoneyUsedRawPct > 100 ? (<div className="pdp__budget-bar-fill pdp__budget-bar-fill--red" style={{ width: `${Math.min(100, dualMoneyUsedRawPct - 100)}%` }} />) : null}
                            </div>
                            <p className="pdp__stat-hint pdp__stat-hint--muted">
                                Потрачено (деньги):{' '}
                                {fmtDashboardBudgetSpentRemaining(apiBudget!, budgetDual.money.spent)} · {apiBudget!.currency}
                            </p>
                            <div className="pdp__stat-budget-row" style={{ marginTop: '0.65rem' }}>
                                <span className="pdp__stat-budget-label">Лимит (часы) за период</span>
                                <span className="pdp__stat-budget-val">
                                    {formatDecimalHoursAsHm(budgetDual.hours.budget)}
                                </span>
                            </div>
                            {apiBudget != null && (dualHoursUsedRawPct != null || apiBudget.percentUsedHours != null && Number.isFinite(apiBudget.percentUsedHours) || apiBudget.hours?.percentUsed != null) && (<p className="pdp__stat-hint">
                                Использовано (часы):{' '}
                                {Math.round(dualHoursUsedRawPct ?? (apiBudget.percentUsedHours ?? apiBudget.hours?.percentUsed) ?? 0)}%
                            </p>)}
                            <div className="pdp__budget-bar">
                                <div className="pdp__budget-bar-fill pdp__budget-bar-fill--blue" style={{ width: `${dualHoursUsedRawPct != null ? Math.min(100, dualHoursUsedRawPct) : Math.min(100, budgetDual.hours.budget > 0 ? (budgetDual.hours.spent / budgetDual.hours.budget) * 100 : 0)}%` }} />
                                {dualHoursUsedRawPct != null && dualHoursUsedRawPct > 100 ? (<div className="pdp__budget-bar-fill pdp__budget-bar-fill--red" style={{ width: `${Math.min(100, dualHoursUsedRawPct - 100)}%` }} />) : null}
                            </div>
                            <p className="pdp__stat-hint pdp__stat-hint--muted">
                                Списано (часы): {formatDecimalHoursAsHm(budgetDual.hours.spent)}
                            </p>
                            {apiBudget != null && (dualMoneyUsedRawPct != null || dualHoursUsedRawPct != null || apiBudget.percentUsed != null) && (<p className="pdp__stat-hint">
                                Ориентир по лимиту (макс. из двух):{' '}
                                {Math.round(Math.max(dualMoneyUsedRawPct ?? 0, dualHoursUsedRawPct ?? 0, apiBudget.percentUsed ?? 0))}%
                            </p>)}
                        </>) : (<>
                            <div className="pdp__stat-budget-row">
                                <span className="pdp__stat-budget-label">
                                    {apiBudget != null ? `Лимит (${apiBudget.budgetBy === 'hours' ? 'часы' : 'деньги'}) за период` : 'Общий бюджет'}
                                </span>
                                <span className="pdp__stat-budget-val">
                                    {apiBudget != null
                                        ? fmtDashboardBudgetValue(apiBudget)
                                        : fmtAmt(project.budget!, displayCurrency)}
                                </span>
                            </div>
                            {apiBudget != null && (singleBudgetUsedRawPct != null || apiBudget.percentUsed != null && Number.isFinite(apiBudget.percentUsed)) && (<p className="pdp__stat-hint">
                                Использовано лимита:{' '}
                                {Math.round(singleBudgetUsedRawPct ?? apiBudget.percentUsed ?? 0)}%
                            </p>)}
                            <div className="pdp__budget-bar">
                                <div className="pdp__budget-bar-fill pdp__budget-bar-fill--blue" style={{ width: `${spentPct}%` }} />
                                {isOver && <div className="pdp__budget-bar-fill pdp__budget-bar-fill--red" style={{ width: `${overPct}%` }} />}
                            </div>
                            {apiBudget != null ? (<p className="pdp__stat-hint pdp__stat-hint--muted">
                                Потрачено за выбранный период:{' '}
                                {fmtDashboardBudgetSpentRemaining(apiBudget, apiBudget.spent)}
                                {apiBudget.budgetBy === 'money' ? ` · валюта лимита: ${apiBudget.currency}` : null}
                            </p>) : null}
                        </>)}
                        {budgetBurnIncludesExpenses && (<p className="pdp__stat-hint">
                            В расход бюджета включена сумма расходов ({displayCurrency}).
                        </p>)}
                    </div>)}
                </div>
                <div className="pdp__stat-card">
                    <p className="pdp__stat-label">Внутренние затраты</p>
                    {dashboardOk && !internalCostsComplete ? (<>
                        <p className="pdp__stat-value">{fmtAmt(internalCostAmount, displayCurrency)}</p>
                        <p className="pdp__stat-hint">
                            {internalCostAmount > 0
                                ? 'Себестоимость посчитана не для всех часов: задайте ставки «себестоимость» всем участникам с часами по проекту.'
                                : 'Себестоимость не задана для части команды — по этим часам затраты считаются как 0.'}
                        </p>
                    </>) : internalCostAmount > 0 ? (<p className="pdp__stat-value">
                        {fmtAmt(internalCostAmount, displayCurrency)}
                    </p>) : dashboardOk && internalCostsComplete ? (<p className="pdp__stat-value">{fmtAmt(0, displayCurrency)}</p>) : (<>
                        <p className="pdp__stat-value pdp__stat-value--na">N/A</p>
                        {!dashboardOk && !dashboardError && (<p className="pdp__stat-hint">
                            Внутренние ставки не заданы для некоторых сотрудников.
                        </p>)}
                        {dashboardError ? (<p className="pdp__stat-hint">Данные дашборда недоступны.</p>) : null}
                    </>)}
                </div>
                {canManageInvoices && (<div className="pdp__stat-card">
                    <p className="pdp__stat-label">Не выставлено счётов</p>
                    <p className="pdp__stat-value">{fmtAmt(unbilled, displayCurrency)}</p>
                    <button type="button" className="pdp__invoice-btn">Создать счёт</button>
                </div>)}

            </div>
            <div className="pdp__detail-block">
                <nav className="pdp__detail-tabs" role="tablist">
                    {detailTabDefs.map(([id, label]) => (<button key={id} role="tab" aria-selected={detailTab === id} className={`pdp__detail-tab${detailTab === id ? ' pdp__detail-tab--active' : ''}`} onClick={() => setDetailTab(id)}>
                        {label}
                    </button>))}
                </nav>

                {detailTab === 'tasks' && (<TasksPanel rows={displayTaskData.billable} nonBillableRows={displayTaskData.nonBillable} totalHours={displayBillableHours ?? 0} totalAmt={displayBillableAmount} currency={displayCurrency} periodSubtitle={tasksPanelSubtitle} breakdownHint={tasksBreakdownHint} onOpenMemberReport={openMemberDetailReport} onPreviewEntries={openProjectPeriodReport} activePeriodPresetId={activePeriodPreset?.id} activePeriodPresetLabel={activePeriodPreset?.label ?? (formatDetailPeriodLabel(detailPeriod) || 'Период')} onSelectPeriodPreset={handleTasksPeriodPreset} onExport={(format) => void handleTasksExport(format)} exportBusy={tasksExportBusy} />)}

                {detailTab === 'team' &&
                    (projectTeamLoad === 'loading' ? (<div className="pdp__detail-loading" role="status">
                        <p>Загрузка команды…</p>
                    </div>) : projectTeamLoad === 'error' ? (<div className="pdp__detail-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p>Не удалось загрузить данные команды за выбранный период.</p>
                    </div>) : projectTeamTotals && projectTeamWl ? (<div className="time-page__panel time-users pdp__team-workload">
                        <p className="pdp__team-workload__period">
                            Период:{' '}
                            <strong>
                                {projectTeamWl.date_from} — {projectTeamWl.date_to}
                            </strong>
                            {projectTeamWl.project_name ? (<>
                                {' '}
                                · проект «{projectTeamWl.project_name}»
                            </>) : null}
                        </p>
                        <TimeUsersSummary totals={projectTeamTotals} />
                        {projectTeamUsers.length === 0 ? (<div className="pdp__detail-empty pdp__detail-empty--inset">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <p>За период нет сотрудников с доступом к проекту и записями времени.</p>
                            <p className="pdp__detail-empty-hint">
                                Назначьте проект во вкладке «Пользователи» учёта времени («Доступ к проектам» в строке
                                сотрудника) или добавьте часы по этому проекту в табеле.
                            </p>
                        </div>) : (<TimeUsersTable users={projectTeamUsers} openActionsId={teamActionsOpen} onActionsOpen={setTeamActionsOpen} onActionsClose={() => setTeamActionsOpen(null)} />)}
                    </div>) : null)}

                {detailTab === 'invoices' && (dashboard != null && dashboard.invoices.length > 0 ? (<div className="pdp__tasks">
                    <table className="pdp__tasks-table">
                        <thead>
                            <tr className="pdp__tasks-thead">
                                <th className="pdp__tasks-th pdp__tasks-th--name">Дата</th>
                                <th className="pdp__tasks-th pdp__tasks-th--amt">Сумма</th>
                                <th className="pdp__tasks-th pdp__tasks-th--name">Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.invoices.map((inv) => (<tr key={inv.id} className="pdp__tasks-row">
                                <td className="pdp__tasks-td pdp__tasks-td--name">
                                    {inv.issuedAt
                                        ? new Date(inv.issuedAt).toLocaleDateString('ru-RU')
                                        : '—'}
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--amt">
                                    {fmtAmt(inv.amount, inv.currency || displayCurrency)}
                                </td>
                                <td className="pdp__tasks-td pdp__tasks-td--name">
                                    {inv.status
                                        ? (INVOICE_STATUS_LABELS[inv.status] ?? inv.status)
                                        : '—'}
                                </td>
                            </tr>))}
                        </tbody>
                    </table>
                </div>) : (<div className="pdp__detail-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <p>Счета для этого проекта не созданы</p>
                </div>))}

                {detailTab === 'duplicates' && canManageProjects ? (
                    <ProjectDuplicatesPanel
                        clientId={project.clientId}
                        projectId={project.id}
                        dateFrom={detailPeriod.from.slice(0, 10)}
                        dateTo={detailPeriod.to.slice(0, 10)}
                        onChanged={onProjectRefresh}
                    />
                ) : null}
            </div>

        </div>
        {editProjectRow && editClientRow && (<ClientProjectModal mode="edit" fixedClientId={project.clientId} initial={editProjectRow} clientsForPicker={[editClientRow]} onClose={() => {
            setEditProjectRow(null);
            setEditClientRow(null);
        }} onSaved={() => {
            setEditProjectRow(null);
            setEditClientRow(null);
            onProjectRefresh();
        }} canManage={canManageProjects} />)}
    </div>);
}
export function ProjectDetailPage() {
    const { id } = useParams<{
        id: string;
    }>();
    const [searchParams] = useSearchParams();
    const clientHint = searchParams.get('client');
    const navigate = useNavigate();
    const { t } = useI18n();
    const backToProjectsLabel = t('timeTrackingPage.projects.newProjectPage.backToProjects');
    const { user, loading: userLoading } = useCurrentUser();
    const [project, setProject] = useState<ProjectRow | null | undefined>(undefined);
    const [dashboard, setDashboard] = useState<TimeManagerProjectDashboard | null | undefined>(undefined);
    const [dashboardError, setDashboardError] = useState<string | null>(null);
    const [detailPeriod, setDetailPeriod] = useState(() => defaultProjectTeamPeriod());
    const [loadError, setLoadError] = useState<string | null>(null);
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
                        dateFrom: detailPeriod.from,
                        dateTo: detailPeriod.to,
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
        return <Navigate to={routes.home} replace />;
    }
    if (loadError) {
        return (<div className="pdp pdp--error">
            <p>{loadError}</p>
            <AppBackButton onClick={() => navigateBackToProjects(navigate)} label={backToProjectsLabel} ariaLabel={backToProjectsLabel} />
        </div>);
    }
    const shellLoading = !fontsReady
        || project === undefined
        || (project != null && dashboard === undefined);
    if (shellLoading) {
        return <ProjectDetailPageSkeleton />;
    }
    if (project === null) {
        return (<div className="pdp pdp--error">
            <p>Проект не найден</p>
            <AppBackButton onClick={() => navigateBackToProjects(navigate)} label={backToProjectsLabel} ariaLabel={backToProjectsLabel} />
        </div>);
    }
    return (<ProjectDetailBody project={project} dashboard={dashboard} dashboardError={dashboardError} detailPeriod={detailPeriod} onDetailPeriodChange={setDetailPeriod} canManageInvoices={hasFullTimeTrackingTabs(user)} canManageProjects={canManageProjects} onProjectRefresh={onProjectRefresh} currentUserId={user?.id ?? null} dashboardRefreshing={dashboardRefreshing} />);
}
