import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useMemo, useCallback, useId, } from 'react';
import './ReportsPanel.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { fetchReportsMeta, fetchReportsUsersForFilter, fetchTimeReport, fetchExpenseReport, fetchUninvoicedReport, fetchBudgetReport, fetchAllTimeReportClientRows, fetchAllTimeReportProjectRows, fetchAllTimeReportTaskRows, fetchAllTimeReportTeamRows, fetchAllExpenseReportRows, fetchAllUninvoicedReportRows, fetchAllBudgetReportRows, exportReportV2, isTimeTrackingHttpError, listPartnerReportConfirmationsConfirmed, listPartnerReportConfirmationsPendingItems, fetchAllInvoices, listAllClientProjectsMerged, getUserProjectAccess, submitPartnerReportConfirmationFromPreview, notifyPartnerConfirmedReportsListInvalidate, } from '@entities/time-tracking';
import { budgetReportHoursMetrics, budgetReportMoneyMetrics } from '@entities/time-tracking/lib/projectBudgetReportMetrics';
import { ReportsSkeleton } from './ReportsSkeleton';
import { ConfirmedPartnerReportsPanel } from './ConfirmedPartnerReportsPanel';
import { ForReviewReportsPanel } from './ForReviewReportsPanel';
import { DatePicker } from '@shared/ui/DatePicker';
import { AttentionBanner, useAppDialog } from '@shared/ui';
import { useI18n, ttReportGroupLabel, ttReportPeriodLabel, ttReportTypeLabel } from '@shared/i18n';
import { writeReportPreviewTransfer, buildReportPreviewTransferUrl, } from '@entities/time-tracking/model/reportPreviewTransfer';
import { ReportsRowContextMenu } from './ReportsRowContextMenu';
import { REPORT_TYPES, GROUPS_FOR_TYPE, DEFAULT_GROUP, PERIOD_OPTIONS, PER_PAGE, migrateStoredReportType, isExpenseLikeReportType, coerceGroupByForType, isReportsSection, isPartnerConfirmedSubview, normalizeReportsSection, } from '@entities/time-tracking/model/reportsPanelConfig';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '@entities/time-tracking/model/partnerConfirmedReports';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { readReportsPrefsFromStorage, writeReportsPrefsToStorage, readInitialReportsRangeState } from '@entities/time-tracking/lib/reportsPrefsStorage';
import { isoDateLocal, parseIsoDateLocal, periodToDates, formatPeriodLabel, formatIsoRangeTitle, clampReportsDateRange } from '@entities/time-tracking/lib/reportsPeriodRange';
import { fmtH, fmtAmt, fmtAmtWithIso, sortCurrencyBuckets, pct, } from '@entities/time-tracking/lib/reportsFormatUtils';
import { sortTimeReportRowsForDisplay } from '@entities/time-tracking/lib/timeReportRows';
import { collectMyParticipatingProjectIds, partnerProjectClientIds, filterReportRowsByPartnerProjects, } from '@entities/time-tracking/lib/partnerReportProjectScope';
import { badgeForProjectInReportWindow, buildClientPartnerBadgeMap, } from '@entities/time-tracking/lib/timeReportPartnerBadges';
import { usePartnerForReviewBadge } from '@entities/time-tracking/lib/usePartnerForReviewBadge';
import { ReportsUserFilterDropdown } from './ReportsUserFilterDropdown';
import { TimeTable } from './ReportsTimeTable';
import { ExpenseTable } from './ReportsExpenseTable';
import { UninvoicedTable } from './ReportsUninvoicedTable';
import { BudgetTable } from './ReportsBudgetTable';
export { ExpenseTable } from './ReportsExpenseTable';
export { UninvoicedTable } from './ReportsUninvoicedTable';
export { BudgetTable } from './ReportsBudgetTable';
const IcoChevLeft = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M15 18l-6-6 6-6" }) }));
const IcoChevRight = () => (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M9 18l6-6-6-6" }) }));
const IcoChevDown = () => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
const IcoDownload = () => (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
const IcoBudget = () => (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("line", { x1: "12", y1: "1", x2: "12", y2: "23" }), _jsx("path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" })] }));
function buildReportRowHaystack(row) {
    if (!row || typeof row !== 'object')
        return '';
    const o = row;
    const parts = [];
    const push = (v) => {
        if (v == null)
            return;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            const s = String(v).trim();
            if (s)
                parts.push(s);
        }
    };
    for (const k of [
        'client_name',
        'project_name',
        'task_name',
        'user_name',
        'name',
        'code',
        'currency',
        'client_id',
        'task_id',
        'project_id',
        'invoiceNumber',
        'invoice_number',
        'expense_category_name',
        'project_code',
    ]) {
        push(o[k]);
    }
    push(o.user_id);
    const users = o.users;
    if (Array.isArray(users)) {
        for (const u of users) {
            if (u && typeof u === 'object') {
                const ur = u;
                push(ur.user_name);
                push(ur.display_name);
                push(ur.email);
                push(ur.status);
                push(ur.expense_status);
                push(ur.workflow_status);
            }
        }
    }
    return parts.join(' ').toLowerCase();
}
function parseReportsSectionParam(value) {
    return isReportsSection(value) ? value : null;
}
export function ReportsPanel() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useI18n();
    const reportsDateRangeId = useId();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const { badge: forReviewBadge, count: forReviewCount } = usePartnerForReviewBadge(Boolean(user));
    const savedPrefs = useMemo(() => readReportsPrefsFromStorage(), []);
    const initRange = useMemo(() => readInitialReportsRangeState(), []);
    const [reportsSection, setReportsSection] = useState(() => {
        const fromUrl = parseReportsSectionParam(searchParams.get('reportsSection'));
        const fromPrefs = savedPrefs?.reportsSection;
        const raw = fromUrl ?? (isReportsSection(fromPrefs) ? fromPrefs : 'build');
        return normalizeReportsSection(raw);
    });
    const [partnerConfirmedSubview, setPartnerConfirmedSubview] = useState(() => {
        const section = parseReportsSectionParam(searchParams.get('reportsSection'));
        if (section === 'monthly-archive' || searchParams.get('partnerView') === 'archive')
            return 'archive';
        if (savedPrefs?.reportsSection === 'monthly-archive')
            return 'archive';
        if (isPartnerConfirmedSubview(savedPrefs?.partnerConfirmedSubview))
            return savedPrefs.partnerConfirmedSubview;
        return 'list';
    });
    const [partnerReportScope, setPartnerReportScope] = useState('all');
    useEffect(() => {
        const section = parseReportsSectionParam(searchParams.get('reportsSection'));
        const partnerView = searchParams.get('partnerView');
        if (!section && partnerView !== 'archive')
            return;
        if (section === 'monthly-archive' || section === 'partner-confirmed' || partnerView === 'archive') {
            setReportsSection('partner-confirmed');
            if (section === 'monthly-archive' || partnerView === 'archive')
                setPartnerConfirmedSubview('archive');
        }
        else if (section) {
            setReportsSection(normalizeReportsSection(section));
        }
        const next = new URLSearchParams(searchParams);
        next.delete('reportsSection');
        next.delete('partnerView');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);
    const partnerScopeSectionActive = reportsSection === 'weekly' || reportsSection === 'monthly';
    const partnerConfirmedOnlyFilter = partnerScopeSectionActive && partnerReportScope === 'confirmed';
    const [onlyMyProjects, setOnlyMyProjects] = useState(() => savedPrefs?.onlyMyProjects === true);
    const partnerProjectsScopeActive = onlyMyProjects && user != null && reportsSection !== 'partner-confirmed' && reportsSection !== 'for-review';
    const [partnerAllowedProjectIds, setPartnerAllowedProjectIds] = useState(null);
    const [partnerAllowedClientIds, setPartnerAllowedClientIds] = useState(null);
    const withPartnerReportScope = useCallback((base) => ({
        ...base,
        ...(partnerConfirmedOnlyFilter ? { partner_confirmed_only: true } : {}),
        ...(partnerProjectsScopeActive && user ? { partner_auth_user_id: user.id } : {}),
    }), [partnerConfirmedOnlyFilter, partnerProjectsScopeActive, user]);
    const [periodDate, setPeriodDate] = useState(() => initRange.periodDate);
    const [periodGranularity, setPeriodGranularity] = useState(() => initRange.periodGranularity);
    const [customRangeActive, setCustomRangeActive] = useState(() => initRange.customRangeActive);
    const activePeriodGranularity = useMemo(() => {
        if (reportsSection === 'weekly')
            return 'week';
        if (reportsSection === 'monthly')
            return 'month';
        return periodGranularity;
    }, [reportsSection, periodGranularity]);
    const periodGranularityLocked = reportsSection === 'weekly' || reportsSection === 'monthly';
    const selectPartnerConfirmedSubview = useCallback((next) => {
        setPartnerConfirmedSubview(next);
    }, []);
    const selectReportsSection = useCallback((section) => {
        setReportsSection(normalizeReportsSection(section));
        if (section === 'weekly') {
            setPartnerReportScope('all');
            setPeriodGranularity('week');
            setPeriodDate(new Date());
            setCustomRangeActive(false);
        }
        else if (section === 'monthly') {
            setPartnerReportScope('all');
            setPeriodGranularity('month');
            setPeriodDate(new Date());
            setCustomRangeActive(false);
        }
    }, []);
    const [dateFrom, setDateFrom] = useState(() => initRange.dateFrom);
    const [dateTo, setDateTo] = useState(() => initRange.dateTo);
    const [periodDropdown, setPeriodDropdown] = useState(false);
    const periodDropdownRef = useRef(null);
    const presetRange = useMemo(() => periodToDates(periodDate, activePeriodGranularity), [periodDate, activePeriodGranularity]);
    useEffect(() => {
        if (customRangeActive)
            return;
        setDateFrom(presetRange.dateFrom);
        setDateTo(presetRange.dateTo);
    }, [presetRange.dateFrom, presetRange.dateTo, customRangeActive]);
    // Legacy prefs / manual ranges may still hold 2000-01-01 → today; clamp to API max.
    useEffect(() => {
        const clamped = clampReportsDateRange(dateFrom, dateTo);
        if (clamped.dateFrom !== dateFrom || clamped.dateTo !== dateTo) {
            setDateFrom(clamped.dateFrom);
            setDateTo(clamped.dateTo);
        }
    }, [dateFrom, dateTo]);
    const periodTitle = useMemo(() => {
        if (customRangeActive)
            return formatIsoRangeTitle(dateFrom, dateTo);
        if (activePeriodGranularity === 'all')
            return t('timeTrackingPage.reports.periods.all');
        return formatPeriodLabel(periodDate, activePeriodGranularity);
    }, [customRangeActive, dateFrom, dateTo, periodDate, activePeriodGranularity, t]);
    function goPrev() {
        if (activePeriodGranularity === 'all')
            return;
        setCustomRangeActive(false);
        setPeriodDate((d) => {
            const next = new Date(d);
            if (activePeriodGranularity === 'week')
                next.setDate(next.getDate() - 7);
            else if (activePeriodGranularity === 'month')
                next.setMonth(next.getMonth() - 1);
            else if (activePeriodGranularity === 'quarter')
                next.setMonth(next.getMonth() - 3);
            else
                next.setFullYear(next.getFullYear() - 1);
            return next;
        });
    }
    function goNext() {
        if (activePeriodGranularity === 'all')
            return;
        setCustomRangeActive(false);
        setPeriodDate((d) => {
            const next = new Date(d);
            if (activePeriodGranularity === 'week')
                next.setDate(next.getDate() + 7);
            else if (activePeriodGranularity === 'month')
                next.setMonth(next.getMonth() + 1);
            else if (activePeriodGranularity === 'quarter')
                next.setMonth(next.getMonth() + 3);
            else
                next.setFullYear(next.getFullYear() + 1);
            return next;
        });
    }
    useEffect(() => {
        if (!periodDropdown)
            return;
        const h = (e) => {
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target))
                setPeriodDropdown(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [periodDropdown]);
    const [reportType, setReportType] = useState(() => migrateStoredReportType(savedPrefs?.reportType));
    const [groupBy, setGroupBy] = useState(() => coerceGroupByForType(migrateStoredReportType(savedPrefs?.reportType), savedPrefs?.groupBy));
    const groups = GROUPS_FOR_TYPE[reportType];
    function changeReportType(t) {
        setReportType(t);
        const def = DEFAULT_GROUP[t];
        if (def)
            setGroupBy(def);
        setPage(1);
        setExpandedRows(new Set());
        setTableSearch('');
        setDebouncedTableSearch('');
        setSearchFullRows(null);
        setResults([]);
        setPagination(null);
        setServerTotals(null);
        setError(null);
        setResultsViewKey(null);
    }
    function changeGroupBy(g) {
        setGroupBy(g);
        setPage(1);
        setExpandedRows(new Set());
        setTableSearch('');
        setDebouncedTableSearch('');
        setSearchFullRows(null);
        setResults([]);
        setPagination(null);
        setError(null);
        setResultsViewKey(null);
    }
    const [selectedUserIds, setSelectedUserIds] = useState(() => {
        if (!Array.isArray(savedPrefs?.selectedUserIds))
            return [];
        return savedPrefs.selectedUserIds
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0);
    });
    const [includeFixed, setIncludeFixed] = useState(() => typeof savedPrefs?.includeFixed === 'boolean' ? savedPrefs.includeFixed : true);
    const [usersForFilter, setUsersForFilter] = useState([]);
    const [usersForFilterError, setUsersForFilterError] = useState(null);
    const [results, setResults] = useState([]);
    /** Rows belong to this view; ignore stale payloads after tab switches. */
    const [resultsViewKey, setResultsViewKey] = useState(null);
    const reportFetchGenRef = useRef(0);
    const [serverTotals, setServerTotals] = useState(null);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [partnerConfirmedList, setPartnerConfirmedList] = useState([]);
    const [partnerPendingList, setPartnerPendingList] = useState([]);
    const [invoicesForPartnerHints, setInvoicesForPartnerHints] = useState([]);
    const [hintProjectMirror, setHintProjectMirror] = useState([]);
    const [partnerHintsLoadFailed, setPartnerHintsLoadFailed] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [exportBusy, setExportBusy] = useState(false);
    const [submitForReviewBusy, setSubmitForReviewBusy] = useState(false);
    const [rowContextMenu, setRowContextMenu] = useState(null);
    const [reportPageSizeMax, setReportPageSizeMax] = useState(null);
    const effectivePerPage = useMemo(() => {
        const cap = reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : 5000;
        return Math.max(PER_PAGE, Math.min(2000, cap));
    }, [reportPageSizeMax]);
    const [tableSearch, setTableSearch] = useState('');
    const [debouncedTableSearch, setDebouncedTableSearch] = useState('');
    const [searchFullRows, setSearchFullRows] = useState(null);
    const [searchFullLoading, setSearchFullLoading] = useState(false);
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedTableSearch(tableSearch.trim()), 450);
        return () => window.clearTimeout(t);
    }, [tableSearch]);
    const fullSearchActive = debouncedTableSearch.trim().length >= 2;
    useEffect(() => {
        if (!fullSearchActive || !dateFrom || !dateTo || dateFrom > dateTo) {
            setSearchFullRows(null);
            setSearchFullLoading(false);
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        setSearchFullLoading(true);
        setSearchFullRows(null);
        const filtersBase = withPartnerReportScope({
            dateFrom,
            dateTo,
            user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
            include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
        });
        const searchFetchOpts = { maxPages: 6, signal: controller.signal };
        void (async () => {
            try {
                let out = [];
                if (reportType === 'time') {
                    if (groupBy === 'clients')
                        out = await fetchAllTimeReportClientRows(filtersBase, searchFetchOpts);
                    else if (groupBy === 'projects')
                        out = await fetchAllTimeReportProjectRows(filtersBase, searchFetchOpts);
                    else if (groupBy === 'tasks')
                        out = await fetchAllTimeReportTaskRows(filtersBase, searchFetchOpts);
                    else if (groupBy === 'team')
                        out = await fetchAllTimeReportTeamRows(filtersBase, searchFetchOpts);
                }
                else if (isExpenseLikeReportType(reportType)) {
                    out = await fetchAllExpenseReportRows(groupBy, filtersBase, searchFetchOpts);
                }
                else if (reportType === 'uninvoiced') {
                    out = await fetchAllUninvoicedReportRows(filtersBase, searchFetchOpts);
                }
                else if (reportType === 'project-budget') {
                    out = await fetchAllBudgetReportRows(filtersBase, searchFetchOpts);
                }
                if (!cancelled)
                    setSearchFullRows(out);
            }
            catch {
                if (!cancelled)
                    setSearchFullRows([]);
            }
            finally {
                if (!cancelled)
                    setSearchFullLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [fullSearchActive, reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, reportPageSizeMax, withPartnerReportScope]);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setUsersForFilterError(null);
        fetchReportsUsersForFilter(controller.signal)
            .then((list) => {
            if (cancelled)
                return;
            const filtered = list.filter((u) => !isHiddenSystemUser({ email: u.email, display_name: u.displayName }));
            setUsersForFilter(filtered);
            setUsersForFilterError(null);
            if (filtered.length === 1 && user && filtered[0].id === user.id) {
                setSelectedUserIds((prev) => (prev.length === 0 ? [user.id] : prev));
            }
        })
            .catch((e) => {
            if (cancelled || (e instanceof Error && e.name === 'AbortError'))
                return;
            setUsersForFilter([]);
            if (isTimeTrackingHttpError(e, 401) || isTimeTrackingHttpError(e, 403))
                setUsersForFilterError(t('timeTrackingPage.reports.header.usersFilterError'));
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [user, t]);
    useEffect(() => {
        if (!partnerProjectsScopeActive || !user) {
            setPartnerAllowedProjectIds(null);
            setPartnerAllowedClientIds(null);
            return;
        }
        let cancelled = false;
        void Promise.all([listAllClientProjectsMerged(true), getUserProjectAccess(user.id)])
            .then(([projects, access]) => {
            if (cancelled)
                return;
            const pids = collectMyParticipatingProjectIds(projects, user.id, access.projectIds);
            setPartnerAllowedProjectIds(pids);
            setPartnerAllowedClientIds(partnerProjectClientIds(projects, pids));
        })
            .catch(() => {
            if (!cancelled) {
                setPartnerAllowedProjectIds(new Set());
                setPartnerAllowedClientIds(new Set());
            }
        });
        return () => {
            cancelled = true;
        };
    }, [partnerProjectsScopeActive, user]);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        void fetchReportsMeta(controller.signal)
            .then((m) => {
            if (!cancelled)
                setReportPageSizeMax(m.pageSizeMax);
        })
            .catch(() => {
            if (!cancelled)
                setReportPageSizeMax(null);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);
    const reloadPartnerReportHints = useCallback(() => {
        void (async () => {
            try {
                const [conf, pending] = await Promise.all([
                    listPartnerReportConfirmationsConfirmed(),
                    listPartnerReportConfirmationsPendingItems(),
                ]);
                const confList = Array.isArray(conf) ? conf : [];
                const pendingList = Array.isArray(pending) ? pending : [];
                setPartnerConfirmedList(confList);
                setPartnerPendingList(pendingList);
                if (confList.length > 0) {
                    try {
                        const invoices = await fetchAllInvoices();
                        setInvoicesForPartnerHints(invoices);
                        setPartnerHintsLoadFailed(false);
                    }
                    catch {
                        setInvoicesForPartnerHints([]);
                        setPartnerHintsLoadFailed(true);
                    }
                }
                else {
                    setInvoicesForPartnerHints([]);
                    setPartnerHintsLoadFailed(false);
                }
            }
            catch {
                setPartnerConfirmedList([]);
                setPartnerPendingList([]);
                setInvoicesForPartnerHints([]);
                setPartnerHintsLoadFailed(true);
            }
        })();
    }, []);
    useEffect(() => {
        if (reportType !== 'time') {
            setHintProjectMirror([]);
            return;
        }
        reloadPartnerReportHints();
    }, [reportType, reloadPartnerReportHints]);
    useEffect(() => {
        const handler = () => {
            reloadPartnerReportHints();
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, handler);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, handler);
    }, [reloadPartnerReportHints]);
    useEffect(() => {
        let cancelled = false;
        if (reportType !== 'time' || groupBy !== 'clients') {
            setHintProjectMirror([]);
            return;
        }
        if (!dateFrom || !dateTo || dateFrom > dateTo || partnerConfirmedList.length === 0) {
            setHintProjectMirror([]);
            return;
        }
        const filtersBase = withPartnerReportScope({
            dateFrom,
            dateTo,
            user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
            include_fixed_fee: includeFixed,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
        });
        void fetchAllTimeReportProjectRows(filtersBase)
            .then((rows) => {
            if (!cancelled)
                setHintProjectMirror(rows);
        })
            .catch(() => {
            if (!cancelled)
                setHintProjectMirror([]);
        });
        return () => {
            cancelled = true;
        };
    }, [reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, reportPageSizeMax, partnerConfirmedList.length, withPartnerReportScope]);
    useEffect(() => {
        writeReportsPrefsToStorage({
            v: 1,
            reportType,
            groupBy,
            periodGranularity,
            periodAnchorIso: isoDateLocal(periodDate),
            selectedUserIds,
            includeFixed,
            onlyMyProjects,
            customRange: customRangeActive,
            rangeDateFrom: customRangeActive ? dateFrom : undefined,
            rangeDateTo: customRangeActive ? dateTo : undefined,
            reportsSection: normalizeReportsSection(reportsSection),
            partnerConfirmedSubview,
        });
    }, [
        reportType,
        groupBy,
        periodGranularity,
        periodDate,
        selectedUserIds,
        includeFixed,
        onlyMyProjects,
        customRangeActive,
        dateFrom,
        dateTo,
        reportsSection,
        partnerConfirmedSubview,
    ]);
    useEffect(() => {
        const viewKey = `${reportType}|${groupBy}`;
        const fetchGen = ++reportFetchGenRef.current;
        setLoading(true);
        setError(null);
        if (!dateFrom || !dateTo) {
            if (fetchGen !== reportFetchGenRef.current)
                return;
            setError(t('timeTrackingPage.reports.errors.datesRequired'));
            setResults([]);
            setResultsViewKey(null);
            setServerTotals(null);
            setPagination(null);
            setLoading(false);
            setInitialLoading(false);
            return;
        }
        if (dateFrom > dateTo) {
            if (fetchGen !== reportFetchGenRef.current)
                return;
            setError(t('timeTrackingPage.reports.errors.dateFromAfterTo'));
            setResults([]);
            setResultsViewKey(null);
            setServerTotals(null);
            setPagination(null);
            setLoading(false);
            setInitialLoading(false);
            return;
        }
        const range = clampReportsDateRange(dateFrom, dateTo);
        const filters = withPartnerReportScope({
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
            include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
            page,
            per_page: effectivePerPage,
        });
        let promise;
        if (reportType === 'time') {
            promise = fetchTimeReport(groupBy, filters);
        }
        else if (isExpenseLikeReportType(reportType)) {
            promise = fetchExpenseReport(groupBy, filters);
        }
        else if (reportType === 'uninvoiced') {
            promise = fetchUninvoicedReport(filters);
        }
        else {
            promise = fetchBudgetReport(filters);
        }
        promise
            .then((data) => {
            if (fetchGen !== reportFetchGenRef.current)
                return;
            setResults(data.results);
            setResultsViewKey(viewKey);
            setPagination(data.pagination);
            setExpandedRows(new Set());
            const respAny = data;
            const st = respAny.meta?.totals_all_groups ?? respAny.summary ?? respAny.totals ?? null;
            setServerTotals(st && typeof st === 'object' ? st : null);
        })
            .catch((e) => {
            if (fetchGen !== reportFetchGenRef.current)
                return;
            setError(isTimeTrackingHttpError(e, 502) || isTimeTrackingHttpError(e, 503)
                ? t('timeTrackingPage.page.serviceUnavailable')
                : e instanceof Error ? e.message : t('timeTrackingPage.reports.errors.loadFailed'));
            setResults([]);
            setResultsViewKey(null);
            setServerTotals(null);
            setPagination(null);
        })
            .finally(() => {
            if (fetchGen !== reportFetchGenRef.current)
                return;
            setLoading(false);
            setInitialLoading(false);
        });
    }, [reportType, groupBy, dateFrom, dateTo, selectedUserIds, includeFixed, page, reportPageSizeMax, effectivePerPage, t, withPartnerReportScope]);
    const activeViewKey = `${reportType}|${groupBy}`;
    const viewResultsReady = resultsViewKey === activeViewKey;
    const scopedResults = useMemo(() => {
        if (!viewResultsReady)
            return [];
        if (!partnerProjectsScopeActive)
            return results;
        if (partnerAllowedProjectIds === null)
            return [];
        return filterReportRowsByPartnerProjects(results, partnerAllowedProjectIds, partnerAllowedClientIds, reportType, groupBy);
    }, [results, viewResultsReady, partnerProjectsScopeActive, partnerAllowedProjectIds, partnerAllowedClientIds, reportType, groupBy]);
    const tableSearchQ = debouncedTableSearch.trim().toLowerCase();
    const filteredTableRows = useMemo(() => {
        if (!tableSearchQ)
            return scopedResults;
        let src = searchFullRows ?? [];
        if (partnerProjectsScopeActive && partnerAllowedProjectIds != null) {
            src = filterReportRowsByPartnerProjects(src, partnerAllowedProjectIds, partnerAllowedClientIds, reportType, groupBy);
        }
        if (!src.length)
            return [];
        return src.filter((r) => buildReportRowHaystack(r).includes(tableSearchQ));
    }, [tableSearchQ, scopedResults, searchFullRows, partnerProjectsScopeActive, partnerAllowedProjectIds, partnerAllowedClientIds, reportType, groupBy]);
    const sortedTimeTableRows = useMemo(() => {
        if (reportType !== 'time')
            return null;
        return sortTimeReportRowsForDisplay(groupBy, filteredTableRows);
    }, [reportType, groupBy, filteredTableRows]);
    const partnerConfSlices = useMemo(() => partnerConfirmedList.map((c) => ({
        projectId: c.projectId,
        dateFrom: c.dateFrom,
        dateTo: c.dateTo,
        snapshotId: c.snapshotId,
        ...(c.invoiceId ? { invoiceId: c.invoiceId } : {}),
    })), [partnerConfirmedList]);
    const partnerProjectBadgeMap = useMemo(() => {
        if (reportType !== 'time' || groupBy !== 'projects' || !dateFrom || !dateTo || dateFrom > dateTo)
            return null;
        const rows = sortedTimeTableRows;
        if (!rows?.length)
            return null;
        const out = new Map();
        for (const row of rows) {
            const pid = String(row.project_id ?? '').trim();
            if (!pid)
                continue;
            const b = badgeForProjectInReportWindow({
                projectId: pid,
                windowFrom: dateFrom,
                windowTo: dateTo,
                confirmations: partnerConfSlices,
                invoices: invoicesForPartnerHints,
            });
            if (b !== 'none')
                out.set(pid, b);
        }
        return out.size ? out : null;
    }, [reportType, groupBy, sortedTimeTableRows, dateFrom, dateTo, partnerConfSlices, invoicesForPartnerHints]);
    const partnerClientBadgeMap = useMemo(() => {
        if (reportType !== 'time' || groupBy !== 'clients' || !dateFrom || !dateTo || dateFrom > dateTo)
            return null;
        if (!hintProjectMirror.length)
            return null;
        const m = buildClientPartnerBadgeMap({
            projectRows: hintProjectMirror,
            windowFrom: dateFrom,
            windowTo: dateTo,
            confirmations: partnerConfSlices,
            invoices: invoicesForPartnerHints,
        });
        return m.size > 0 ? m : null;
    }, [reportType, groupBy, hintProjectMirror, dateFrom, dateTo, partnerConfSlices, invoicesForPartnerHints]);
    const partnerProjectBadgeFn = useCallback((projectId) => partnerProjectBadgeMap?.get(String(projectId ?? '').trim()) ?? 'none', [partnerProjectBadgeMap]);
    const partnerClientBadgeFn = useCallback((clientId) => partnerClientBadgeMap?.get(String(clientId ?? '').trim()) ?? 'none', [partnerClientBadgeMap]);
    const tableDataLoading = loading
        || (!viewResultsReady && !error)
        || (Boolean(tableSearchQ) && searchFullLoading);
    const tableSearchPlaceholder = useMemo(() => {
        if (reportType === 'time') {
            if (groupBy === 'projects')
                return t('timeTrackingPage.reports.searchPlaceholders.projectClientCode');
            if (groupBy === 'clients')
                return t('timeTrackingPage.reports.searchPlaceholders.clientCurrency');
            if (groupBy === 'tasks')
                return t('timeTrackingPage.reports.searchPlaceholders.taskProject');
            if (groupBy === 'team')
                return t('timeTrackingPage.reports.searchPlaceholders.employee');
        }
        if (isExpenseLikeReportType(reportType)) {
            if (groupBy === 'projects')
                return t('timeTrackingPage.reports.searchPlaceholders.projectClient');
            if (groupBy === 'clients')
                return t('timeTrackingPage.reports.searchPlaceholders.client');
            if (groupBy === 'categories')
                return t('timeTrackingPage.reports.searchPlaceholders.category');
            if (groupBy === 'team')
                return t('timeTrackingPage.reports.searchPlaceholders.employee');
        }
        if (reportType === 'uninvoiced')
            return t('timeTrackingPage.reports.searchPlaceholders.default');
        return t('timeTrackingPage.reports.searchPlaceholders.default');
    }, [reportType, groupBy, t]);
    function toggleRow(id) {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }
    const kpi = useMemo(() => {
        const useServerTotals = !tableSearchQ && serverTotals != null && !partnerProjectsScopeActive;
        if (reportType === 'time') {
            if (useServerTotals) {
                const st = serverTotals;
                const totalHours = st.total_hours ?? 0;
                const billableHours = st.billable_hours ?? 0;
                let billableByCurrency;
                if (Array.isArray(st.by_currency) && st.by_currency.length > 0) {
                    billableByCurrency = sortCurrencyBuckets(st.by_currency.map((b) => ({
                        currency: String(b.currency ?? 'USD').trim().toUpperCase() || 'USD',
                        amount: Number(b.billable_amount ?? b.amount ?? 0),
                    })));
                }
                else {
                    const amt = st.billable_amount ?? 0;
                    billableByCurrency = amt !== 0
                        ? [{ currency: (String(st.currency ?? '').trim().toUpperCase() || 'USD'), amount: amt }]
                        : [];
                }
                return { kind: 'time', totalHours, billableHours, billableByCurrency };
            }
            const rows = (tableSearchQ ? filteredTableRows : scopedResults);
            const totalHours = rows.reduce((s, r) => s + (r.total_hours ?? 0), 0);
            const billableHours = rows.reduce((s, r) => s + (r.billable_hours ?? 0), 0);
            const billMap = new Map();
            for (const r of rows) {
                const cur = (String(r.currency ?? '').trim().toUpperCase() || 'USD');
                billMap.set(cur, (billMap.get(cur) ?? 0) + (r.billable_amount ?? 0));
            }
            const billableByCurrency = sortCurrencyBuckets([...billMap.entries()].map(([currency, amount]) => ({ currency, amount })));
            return { kind: 'time', totalHours, billableHours, billableByCurrency };
        }
        if (isExpenseLikeReportType(reportType)) {
            if (useServerTotals) {
                const st = serverTotals;
                let expensesByCurrency;
                if (Array.isArray(st.by_currency) && st.by_currency.length > 0) {
                    expensesByCurrency = sortCurrencyBuckets(st.by_currency.map((b) => ({
                        currency: String(b.currency ?? 'USD').trim().toUpperCase() || 'USD',
                        totalAmount: Number(b.total_amount ?? b.totalAmount ?? 0),
                        billableAmount: Number(b.billable_amount ?? b.billableAmount ?? 0),
                    })));
                }
                else {
                    const cur = (String(st.currency ?? '').trim().toUpperCase() || 'USD');
                    expensesByCurrency = [{ currency: cur, totalAmount: st.total_amount ?? 0, billableAmount: st.billable_amount ?? st.reimbursable_amount ?? 0 }];
                }
                return { kind: 'expenses', expensesByCurrency };
            }
            const rows = (tableSearchQ ? filteredTableRows : scopedResults);
            const expMap = new Map();
            for (const r of rows) {
                const cur = (String(r.currency ?? '').trim().toUpperCase() || 'USD');
                const prev = expMap.get(cur) ?? { totalAmount: 0, billableAmount: 0 };
                prev.totalAmount += r.total_amount ?? 0;
                prev.billableAmount += r.billable_amount ?? 0;
                expMap.set(cur, prev);
            }
            const expensesByCurrency = sortCurrencyBuckets([...expMap.entries()].map(([currency, v]) => ({
                currency,
                totalAmount: v.totalAmount,
                billableAmount: v.billableAmount,
            })));
            return { kind: 'expenses', expensesByCurrency };
        }
        if (reportType === 'uninvoiced') {
            if (useServerTotals) {
                const st = serverTotals;
                const uninvoicedHours = st.uninvoiced_hours ?? 0;
                let uninvoicedByCurrency;
                if (Array.isArray(st.by_currency) && st.by_currency.length > 0) {
                    uninvoicedByCurrency = sortCurrencyBuckets(st.by_currency.map((b) => ({
                        currency: String(b.currency ?? 'USD').trim().toUpperCase() || 'USD',
                        uninvoicedAmount: Number(b.uninvoiced_amount ?? b.uninvoicedAmount ?? 0),
                        uninvoicedExpenses: Number(b.uninvoiced_expenses ?? b.uninvoicedExpenses ?? 0),
                    })));
                }
                else {
                    const cur = (String(st.currency ?? '').trim().toUpperCase() || 'USD');
                    uninvoicedByCurrency = [{ currency: cur, uninvoicedAmount: st.uninvoiced_amount ?? 0, uninvoicedExpenses: st.uninvoiced_expenses ?? 0 }];
                }
                return { kind: 'uninvoiced', uninvoicedHours, uninvoicedByCurrency };
            }
            const rows = (tableSearchQ ? filteredTableRows : scopedResults);
            const uninvoicedHours = rows.reduce((s, r) => s + (r.uninvoiced_hours ?? 0), 0);
            const uMap = new Map();
            for (const r of rows) {
                const cur = (String(r.currency ?? '').trim().toUpperCase() || 'USD');
                const prev = uMap.get(cur) ?? { uninvoicedAmount: 0, uninvoicedExpenses: 0 };
                prev.uninvoicedAmount += r.uninvoiced_amount ?? 0;
                prev.uninvoicedExpenses += r.uninvoiced_expenses ?? 0;
                uMap.set(cur, prev);
            }
            const uninvoicedByCurrency = sortCurrencyBuckets([...uMap.entries()].map(([currency, v]) => ({
                currency,
                uninvoicedAmount: v.uninvoicedAmount,
                uninvoicedExpenses: v.uninvoicedExpenses,
            })));
            return { kind: 'uninvoiced', uninvoicedHours, uninvoicedByCurrency };
        }
        const rows = (tableSearchQ ? filteredTableRows : scopedResults);
        const projectCount = rows.length;
        let totalHoursBudget = 0;
        let spentHours = 0;
        const moneyByCurMap = new Map();
        for (const r of rows) {
            if (r.budget_by === 'none' || r.has_budget === false)
                continue;
            if (r.budget_by === 'hours' || r.budget_by === 'hours_and_money') {
                const h = budgetReportHoursMetrics(r);
                totalHoursBudget += h.budget;
                spentHours += h.spent;
            }
            if (r.budget_by === 'money' || r.budget_by === 'hours_and_money') {
                const m = budgetReportMoneyMetrics(r);
                const c = (r.currency ?? '').trim().toUpperCase() || 'USD';
                const prev = moneyByCurMap.get(c) ?? { totalBudget: 0, spent: 0 };
                prev.totalBudget += m.budget;
                prev.spent += m.spent;
                moneyByCurMap.set(c, prev);
            }
        }
        const moneyBudgetByCurrency = [...moneyByCurMap.entries()]
            .map(([currency, v]) => ({ currency, totalBudget: v.totalBudget, spent: v.spent }))
            .sort((a, b) => {
            const rank = (x) => (x === 'USD' ? 0 : x === 'UZS' ? 1 : 2);
            const d = rank(a.currency) - rank(b.currency);
            return d !== 0 ? d : a.currency.localeCompare(b.currency, 'en');
        });
        return {
            kind: 'budget',
            projectCount,
            totalHoursBudget,
            spentHours,
            moneyBudgetByCurrency,
        };
    }, [filteredTableRows, scopedResults, tableSearchQ, reportType, serverTotals, partnerProjectsScopeActive]);
    const singleProjectIdForSubmit = useMemo(() => {
        if (reportType !== 'time' || groupBy !== 'projects')
            return null;
        if (filteredTableRows.length !== 1)
            return null;
        const row = filteredTableRows[0];
        const pid = String(row.project_id ?? '').trim();
        return pid || null;
    }, [reportType, groupBy, filteredTableRows]);
    const submitBlockedForProject = useMemo(() => {
        if (!singleProjectIdForSubmit || !dateFrom || !dateTo)
            return false;
        const pid = singleProjectIdForSubmit;
        const df = dateFrom.slice(0, 10);
        const dt = dateTo.slice(0, 10);
        const inFlight = (r) => {
            if (String(r.projectId ?? '').trim() !== pid)
                return false;
            if (r.dateFrom.slice(0, 10) !== df || r.dateTo.slice(0, 10) !== dt)
                return false;
            return String(r.status || '').trim().toLowerCase() !== 'fully_confirmed';
        };
        return partnerPendingList.some(inFlight) || partnerConfirmedList.some(inFlight);
    }, [singleProjectIdForSubmit, dateFrom, dateTo, partnerPendingList, partnerConfirmedList]);
    const showSubmitForPartnerReview = hasFullTimeTrackingTabs(user) && Boolean(singleProjectIdForSubmit) && !tableDataLoading;
    const canSubmitForPartnerReview = showSubmitForPartnerReview && !submitBlockedForProject;
    async function handleSubmitForPartnerReview() {
        if (!canSubmitForPartnerReview || !singleProjectIdForSubmit || submitForReviewBusy)
            return;
        const confirmed = await showConfirm({
            title: t('timeTrackingPage.reports.submitForReview.confirmTitle'),
            message: t('timeTrackingPage.reports.submitForReview.confirmMessage'),
            confirmLabel: t('timeTrackingPage.reports.submitForReview.confirmLabel'),
        });
        if (!confirmed)
            return;
        setSubmitForReviewBusy(true);
        try {
            await submitPartnerReportConfirmationFromPreview({
                projectId: singleProjectIdForSubmit,
                dateFrom,
                dateTo,
            });
            notifyPartnerConfirmedReportsListInvalidate();
            await showAlert({ message: t('timeTrackingPage.reports.submitForReview.done') });
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.submitForReview.failed'),
            });
        }
        finally {
            setSubmitForReviewBusy(false);
        }
    }
    function buildPreviewTransferPeriod() {
        return {
            periodGranularity: activePeriodGranularity,
            periodAnchorIso: isoDateLocal(periodDate),
            customRangeActive,
        };
    }
    function openReportPreview() {
        if (tableDataLoading || filteredTableRows.length === 0)
            return;
        const period = buildPreviewTransferPeriod();
        const range = clampReportsDateRange(dateFrom, dateTo);
        const filters = withPartnerReportScope({
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
            include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
            page: 1,
            per_page: effectivePerPage,
        });
        let payload;
        if (reportType === 'time') {
            payload = { v: 2, reportType: 'time', groupBy: groupBy, filters, period };
        }
        else if (reportType === 'expenses') {
            const g = groupBy;
            payload = { v: 2, reportType: 'expenses', groupBy: g, filters, period };
        }
        else if (reportType === 'uninvoiced') {
            payload = { v: 2, reportType: 'uninvoiced', filters, period };
        }
        else {
            payload = { v: 2, reportType: 'project-budget', filters, period };
        }
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }
    function buildTimeProjectPreviewPayload(projectId) {
        if (tableDataLoading)
            return null;
        const trimmed = String(projectId ?? '').trim();
        if (!trimmed)
            return null;
        const period = buildPreviewTransferPeriod();
        const range = clampReportsDateRange(dateFrom, dateTo);
        const filters = withPartnerReportScope({
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
            include_fixed_fee: includeFixed,
            project_id: trimmed,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
            page: 1,
            per_page: effectivePerPage,
        });
        return {
            v: 2,
            reportType: 'time',
            groupBy: 'projects',
            filters,
            period,
        };
    }
    function buildTimeClientPreviewPayload(clientId) {
        if (tableDataLoading)
            return null;
        const trimmed = String(clientId ?? '').trim();
        if (!trimmed)
            return null;
        const period = buildPreviewTransferPeriod();
        const range = clampReportsDateRange(dateFrom, dateTo);
        const filters = withPartnerReportScope({
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
            include_fixed_fee: includeFixed,
            client_id: trimmed,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
            page: 1,
            per_page: effectivePerPage,
        });
        return {
            v: 2,
            reportType: 'time',
            groupBy: 'clients',
            filters,
            period,
        };
    }
    function openTimeProjectPreview(projectId) {
        const payload = buildTimeProjectPreviewPayload(projectId);
        if (!payload)
            return;
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }
    function openTimeProjectPreviewInNewTab(projectId) {
        const payload = buildTimeProjectPreviewPayload(projectId);
        if (!payload)
            return;
        const url = buildReportPreviewTransferUrl(payload, routes.timeTrackingReportPreview);
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    function openTimeClientPreview(clientId) {
        const payload = buildTimeClientPreviewPayload(clientId);
        if (!payload)
            return;
        writeReportPreviewTransfer(payload);
        navigate(routes.timeTrackingReportPreview);
    }
    function openTimeClientPreviewInNewTab(clientId) {
        const payload = buildTimeClientPreviewPayload(clientId);
        if (!payload)
            return;
        const url = buildReportPreviewTransferUrl(payload, routes.timeTrackingReportPreview);
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    const handleRowContextMenu = useCallback((kind, clientX, clientY, id) => {
        if (tableDataLoading)
            return;
        const trimmed = String(id ?? '').trim();
        if (!trimmed)
            return;
        setRowContextMenu({ x: clientX, y: clientY, kind, id: trimmed });
    }, [tableDataLoading]);
    async function handleExport(format) {
        if (exportBusy)
            return;
        setExportBusy(true);
        try {
            const baseFilters = withPartnerReportScope({
                dateFrom,
                dateTo,
                user_id: selectedUserIds.length ? selectedUserIds.join(',') : undefined,
                include_fixed_fee: reportType === 'time' ? includeFixed : undefined,
            });
            const gb = groups ? groupBy : null;
            if (reportType === 'time')
                await exportReportV2(reportType, gb, baseFilters, format, { timeExport: format === 'xlsx' ? 'summary' : 'detail' });
            else
                await exportReportV2(reportType, gb, baseFilters, format);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.reports.errors.exportFailed') });
        }
        finally {
            setExportBusy(false);
        }
    }
    const breakdownHint = useMemo(() => {
        if (reportType === 'time') {
            const g = ttReportGroupLabel(groupBy, t);
            const base = t('timeTrackingPage.reports.hints.timeByGroup').replace('{group}', g);
            if (groupBy === 'clients') {
                return `${base}. ${t('timeTrackingPage.reports.hints.timeClientsMultiCurrency')}`;
            }
            return base;
        }
        if (reportType === 'expenses') {
            const g = ttReportGroupLabel(groupBy, t);
            return t('timeTrackingPage.reports.hints.expensesByGroup').replace('{group}', g);
        }
        if (reportType === 'uninvoiced')
            return t('timeTrackingPage.reports.hints.uninvoiced');
        return t('timeTrackingPage.reports.hints.projectBudget');
    }, [reportType, groupBy, t]);
    const reportsSectionSwitcher = (_jsxs("div", { className: "tt-reports__type-block tt-reports__section-switch", children: [_jsx("p", { className: "tt-reports__type-block-title", id: "tt-reports-section-heading", children: t('timeTrackingPage.reports.section.title') }), _jsxs("nav", { className: "tt-reports__type-nav", role: "tablist", "aria-labelledby": "tt-reports-section-heading", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": reportsSection === 'build', className: `tt-reports__type-tab${reportsSection === 'build' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectReportsSection('build'), children: t('timeTrackingPage.reports.section.build') }), _jsx("button", { type: "button", role: "tab", "aria-selected": reportsSection === 'weekly', className: `tt-reports__type-tab${reportsSection === 'weekly' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectReportsSection('weekly'), children: t('timeTrackingPage.reports.section.weekly') }), _jsx("button", { type: "button", role: "tab", "aria-selected": reportsSection === 'monthly', className: `tt-reports__type-tab${reportsSection === 'monthly' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectReportsSection('monthly'), children: t('timeTrackingPage.reports.section.monthly') }), _jsx("button", { type: "button", role: "tab", "aria-selected": reportsSection === 'partner-confirmed', className: `tt-reports__type-tab${reportsSection === 'partner-confirmed' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectReportsSection('partner-confirmed'), children: t('timeTrackingPage.reports.section.partnerConfirmed') }), _jsx("button", { type: "button", role: "tab", "aria-selected": reportsSection === 'for-review', className: `tt-reports__type-tab${reportsSection === 'for-review' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => selectReportsSection('for-review'), children: _jsxs("span", { className: "tt-reports__type-tab-inner", children: [t('timeTrackingPage.reports.section.forReview'), forReviewBadge ? (_jsx("span", { className: "tt-reports__type-tab-badge", "aria-hidden": true, children: forReviewBadge })) : null] }) })] })] }));
    const forReviewAttention = forReviewCount > 0 && reportsSection !== 'for-review' ? (_jsx(AttentionBanner, { className: "tt-reports__attention", text: t('attentionBanner.reportsForReview').replace('{count}', String(forReviewCount)), actionLabel: t('attentionBanner.reportsGo'), onAction: () => selectReportsSection('for-review') })) : null;
    if (reportsSection === 'for-review') {
        return (_jsxs("div", { className: "tt-reports tt-reports--fluid", children: [reportsSectionSwitcher, _jsx(ForReviewReportsPanel, {})] }));
    }
    if (reportsSection === 'partner-confirmed') {
        return (_jsxs("div", { className: "tt-reports tt-reports--fluid", children: [reportsSectionSwitcher, forReviewAttention, _jsx(ConfirmedPartnerReportsPanel, { subView: partnerConfirmedSubview, onSubViewChange: selectPartnerConfirmedSubview })] }));
    }
    if (initialLoading) {
        return (_jsxs("div", { className: "tt-reports", children: [reportsSectionSwitcher, forReviewAttention, _jsx(ReportsSkeleton, {})] }));
    }
    return (_jsxs("div", { className: "tt-reports", children: [reportsSectionSwitcher, forReviewAttention, partnerScopeSectionActive ? (_jsxs("div", { className: "tt-reports__type-block tt-reports__partner-scope", role: "group", "aria-label": t('timeTrackingPage.reports.partnerScope.aria'), children: [_jsx("p", { className: "tt-reports__type-block-title", children: t('timeTrackingPage.reports.partnerScope.aria') }), _jsxs("nav", { className: "tt-reports__type-nav", children: [_jsx("button", { type: "button", className: `tt-reports__type-tab${partnerReportScope === 'all' ? ' tt-reports__type-tab--active' : ''}`, "aria-pressed": partnerReportScope === 'all', onClick: () => { setPartnerReportScope('all'); setPage(1); }, children: t('timeTrackingPage.reports.partnerScope.all') }), _jsx("button", { type: "button", className: `tt-reports__type-tab${partnerReportScope === 'confirmed' ? ' tt-reports__type-tab--active' : ''}`, "aria-pressed": partnerReportScope === 'confirmed', onClick: () => { setPartnerReportScope('confirmed'); setPage(1); }, children: t('timeTrackingPage.reports.partnerScope.confirmedOnly') })] })] })) : null, _jsxs("div", { className: "tt-reports__type-block", children: [_jsx("p", { className: "tt-reports__type-block-title", id: "tt-reports-type-heading", children: t('timeTrackingPage.reports.reportType.title') }), _jsx("nav", { className: "tt-reports__type-nav", role: "tablist", "aria-labelledby": "tt-reports-type-heading", children: REPORT_TYPES.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": reportType === tab.id, className: `tt-reports__type-tab${reportType === tab.id ? ' tt-reports__type-tab--active' : ''}`, onClick: () => changeReportType(tab.id), children: ttReportTypeLabel(tab.id, t) }, tab.id))) })] }), _jsxs("div", { className: "tt-reports__header", children: [_jsxs("div", { className: "tt-reports__header-left", children: [_jsx("button", { type: "button", className: "tt-reports__nav-btn", onClick: goPrev, disabled: activePeriodGranularity === 'all', "aria-label": t('timeTrackingPage.reports.header.prevPeriod'), children: _jsx(IcoChevLeft, {}) }), _jsx("h2", { className: "tt-reports__period-title", children: periodTitle }), _jsx("button", { type: "button", className: "tt-reports__nav-btn", onClick: goNext, disabled: activePeriodGranularity === 'all', "aria-label": t('timeTrackingPage.reports.header.nextPeriod'), children: _jsx(IcoChevRight, {}) })] }), _jsxs("div", { className: "tt-reports__header-right", children: [usersForFilterError ? (_jsx("p", { className: "tt-reports__users-filter-err", role: "status", children: usersForFilterError })) : null, _jsx(ReportsUserFilterDropdown, { users: usersForFilter, selected: selectedUserIds, onChange: (ids) => { setSelectedUserIds(ids); setPage(1); } }), periodGranularityLocked ? (_jsx("span", { className: "tt-reports__btn tt-reports__btn--outline tt-reports__period-locked", "aria-current": "true", children: ttReportPeriodLabel(activePeriodGranularity, t) })) : (_jsxs("div", { className: "tt-reports__period-dropdown-wrap", ref: periodDropdownRef, children: [_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown", onClick: () => setPeriodDropdown((v) => !v), "aria-expanded": periodDropdown, children: [ttReportPeriodLabel(periodGranularity, t), " ", _jsx(IcoChevDown, {})] }), periodDropdown && (_jsx("div", { className: "tt-reports__period-dropdown", role: "listbox", children: PERIOD_OPTIONS.map((opt) => (_jsx("button", { type: "button", role: "option", "aria-selected": periodGranularity === opt.id, className: `tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`, onClick: () => {
                                                setCustomRangeActive(false);
                                                setPeriodGranularity(opt.id);
                                                setPeriodDropdown(false);
                                            }, children: ttReportPeriodLabel(opt.id, t) }, opt.id))) }))] }))] })] }), _jsxs("div", { className: "tt-reports__date-range", "aria-label": t('timeTrackingPage.reports.dateRange.aria'), children: [_jsx("span", { className: "tt-reports__date-range-title", children: t('timeTrackingPage.reports.dateRange.title') }), _jsxs("div", { className: "tt-reports__date-field", children: [_jsx("span", { className: "tt-reports__date-field-label", id: `${reportsDateRangeId}-from`, children: t('timeTrackingPage.reports.dateRange.from') }), _jsx(DatePicker, { value: dateFrom, max: dateTo, onChange: (iso) => {
                                    if (periodGranularityLocked) {
                                        const d = parseIsoDateLocal(iso);
                                        if (d) {
                                            setPeriodDate(d);
                                            setCustomRangeActive(false);
                                        }
                                        setPage(1);
                                        return;
                                    }
                                    setDateFrom(iso);
                                    if (iso > dateTo)
                                        setDateTo(iso);
                                    setCustomRangeActive(true);
                                    setPage(1);
                                }, "aria-labelledby": `${reportsDateRangeId}-from`, portal: true, buttonClassName: "tt-reports__date-picker-btn" })] }), _jsxs("div", { className: "tt-reports__date-field", children: [_jsx("span", { className: "tt-reports__date-field-label", id: `${reportsDateRangeId}-to`, children: t('timeTrackingPage.reports.dateRange.to') }), _jsx(DatePicker, { value: dateTo, min: dateFrom, onChange: (iso) => {
                                    if (periodGranularityLocked) {
                                        const d = parseIsoDateLocal(iso);
                                        if (d) {
                                            setPeriodDate(d);
                                            setCustomRangeActive(false);
                                        }
                                        setPage(1);
                                        return;
                                    }
                                    setDateTo(iso);
                                    if (iso < dateFrom)
                                        setDateFrom(iso);
                                    setCustomRangeActive(true);
                                    setPage(1);
                                }, "aria-labelledby": `${reportsDateRangeId}-to`, portal: true, buttonClassName: "tt-reports__date-picker-btn" })] }), customRangeActive && !periodGranularityLocked ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => {
                            setCustomRangeActive(false);
                            setPage(1);
                        }, children: t('timeTrackingPage.reports.dateRange.backToPeriod').replace('{period}', ttReportPeriodLabel(activePeriodGranularity, t).toLowerCase()) })) : null] }), _jsxs("div", { className: "tt-reports__summary", children: [kpi.kind === 'time' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.totalHours') }), _jsx("span", { className: "tt-reports__summary-value", children: fmtH(kpi.totalHours) })] }), _jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-chart", children: [_jsx("div", { className: "tt-reports__pie-wrap", children: (() => {
                                            const billPct = kpi.totalHours > 0 ? (kpi.billableHours / kpi.totalHours) * 100 : 0;
                                            const nonBillPct = 100 - billPct;
                                            return (_jsxs("svg", { viewBox: "0 0 36 36", className: "tt-reports__pie", children: [_jsx("circle", { cx: "18", cy: "18", r: "15.9", fill: "none", stroke: "var(--app-accent,#4f46e5)", strokeWidth: "3", strokeDasharray: `${billPct} ${100 - billPct}`, strokeDashoffset: "0", transform: "rotate(-90 18 18)" }), _jsx("circle", { cx: "18", cy: "18", r: "15.9", fill: "none", stroke: "#d6d9f3", strokeWidth: "3", strokeDasharray: `${nonBillPct} ${100 - nonBillPct}`, strokeDashoffset: -billPct, transform: "rotate(-90 18 18)" }), _jsxs("text", { x: "18", y: "21.5", textAnchor: "middle", fontSize: "8", fill: "currentColor", children: [Math.round(billPct), "%"] })] }));
                                        })() }), _jsxs("div", { className: "tt-reports__pie-legend", children: [_jsxs("span", { className: "tt-reports__legend-item", children: [_jsxs("span", { className: "tt-reports__legend-item-top", children: [_jsx("span", { className: "tt-reports__legend-dot tt-reports__legend-dot--billable", "aria-hidden": true }), _jsx("span", { children: t('timeTrackingPage.reports.kpi.billable') })] }), _jsx("span", { className: "tt-reports__legend-item-value", children: fmtH(kpi.billableHours) })] }), _jsxs("span", { className: "tt-reports__legend-item", children: [_jsxs("span", { className: "tt-reports__legend-item-top", children: [_jsx("span", { className: "tt-reports__legend-dot tt-reports__legend-dot--nonbillable", "aria-hidden": true }), _jsx("span", { children: t('timeTrackingPage.reports.kpi.nonBillable') })] }), _jsx("span", { className: "tt-reports__legend-item-value", children: fmtH(kpi.totalHours - kpi.billableHours) })] })] })] }), kpi.billableByCurrency.length === 0 ? (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.billableAmount') }), _jsx("span", { className: "tt-reports__summary-value", children: "\u2014" })] })) : kpi.billableByCurrency.length === 1 ? (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsxs("span", { className: "tt-reports__summary-label tt-reports__summary-label--inline", children: [_jsx("span", { className: "tt-reports__summary-label-primary", children: t('timeTrackingPage.reports.kpi.billableAmount') }), _jsx("span", { className: "tt-reports__summary-label-accent", children: kpi.billableByCurrency[0].currency })] }), _jsx("span", { className: "tt-reports__summary-value", children: fmtAmtWithIso(kpi.billableByCurrency[0].amount, kpi.billableByCurrency[0].currency) })] })) : (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount tt-reports__summary-amount--multi", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.billableAmount') }), _jsx("ul", { className: "tt-reports__summary-currencies", children: kpi.billableByCurrency.map((bc) => (_jsxs("li", { className: "tt-reports__summary-currency-row", children: [_jsx("span", { className: "tt-reports__summary-label-accent", children: bc.currency }), _jsx("span", { className: "tt-reports__summary-currency-amt", children: fmtAmtWithIso(bc.amount, bc.currency) })] }, bc.currency))) }), reportType === 'time' ? (_jsx("p", { className: "tt-reports__summary-footnote tt-reports__summary-footnote--in-card", children: t('timeTrackingPage.reports.kpi.multiCurrencyFootnote') })) : null] })), reportType === 'time' && (_jsx("div", { className: "tt-reports__summary-options", role: "group", "aria-label": t('timeTrackingPage.reports.kpi.timeOptionsAria'), children: _jsxs("label", { className: "tt-reports__summary-check", children: [_jsx("input", { type: "checkbox", checked: includeFixed, onChange: (e) => { setIncludeFixed(e.target.checked); setPage(1); } }), _jsx("span", { children: t('timeTrackingPage.reports.kpi.includeFixedFee') })] }) }))] })), kpi.kind === 'expenses' && kpi.expensesByCurrency.length === 1 && (() => {
                        const x = kpi.expensesByCurrency[0];
                        const billPct = x.totalAmount > 0 ? (x.billableAmount / x.totalAmount) * 100 : 0;
                        return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.totalExpenses') }), _jsx("span", { className: "tt-reports__summary-value", children: fmtAmt(x.totalAmount, x.currency) })] }), _jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-chart", children: [_jsx("div", { className: "tt-reports__pie-wrap", children: _jsxs("svg", { viewBox: "0 0 36 36", className: "tt-reports__pie", children: [_jsx("circle", { cx: "18", cy: "18", r: "15.9", fill: "none", stroke: "var(--app-accent,#4f46e5)", strokeWidth: "3", strokeDasharray: `${billPct} ${100 - billPct}`, strokeDashoffset: "0", transform: "rotate(-90 18 18)" }), _jsx("circle", { cx: "18", cy: "18", r: "15.9", fill: "none", stroke: "#d6d9f3", strokeWidth: "3", strokeDasharray: `${100 - billPct} ${billPct}`, strokeDashoffset: -billPct, transform: "rotate(-90 18 18)" }), _jsxs("text", { x: "18", y: "21.5", textAnchor: "middle", fontSize: "8", fill: "currentColor", children: [Math.round(billPct), "%"] })] }) }), _jsxs("div", { className: "tt-reports__pie-legend", children: [_jsxs("span", { className: "tt-reports__legend-item", children: [_jsxs("span", { className: "tt-reports__legend-item-top", children: [_jsx("span", { className: "tt-reports__legend-dot tt-reports__legend-dot--billable", "aria-hidden": true }), _jsx("span", { children: t('timeTrackingPage.reports.kpi.reimbursable') })] }), _jsx("span", { className: "tt-reports__legend-item-value", children: fmtAmt(x.billableAmount, x.currency) })] }), _jsxs("span", { className: "tt-reports__legend-item", children: [_jsxs("span", { className: "tt-reports__legend-item-top", children: [_jsx("span", { className: "tt-reports__legend-dot tt-reports__legend-dot--nonbillable", "aria-hidden": true }), _jsx("span", { children: t('timeTrackingPage.reports.kpi.otherExpenses') })] }), _jsx("span", { className: "tt-reports__legend-item-value", children: fmtAmt(x.totalAmount - x.billableAmount, x.currency) })] })] })] }), _jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.reimbursable') }), _jsx("span", { className: "tt-reports__summary-value", children: fmtAmt(x.billableAmount, x.currency) })] }), _jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.reimbursablePct') }), _jsx("span", { className: "tt-reports__summary-value", children: pct(x.billableAmount, x.totalAmount) })] })] }));
                    })(), kpi.kind === 'expenses' && kpi.expensesByCurrency.length > 1 && (_jsxs(_Fragment, { children: [kpi.expensesByCurrency.map((x) => (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsxs("span", { className: "tt-reports__summary-label tt-reports__summary-label--stack", children: [_jsx("span", { className: "tt-reports__summary-label-primary", children: t('timeTrackingPage.reports.kpi.expensesLabel') }), _jsx("span", { className: "tt-reports__summary-label-accent", children: x.currency })] }), _jsx("span", { className: "tt-reports__summary-value", children: fmtAmt(x.totalAmount, x.currency) }), _jsx("span", { className: "tt-reports__summary-sub", children: t('timeTrackingPage.reports.kpi.reimbursableLine')
                                            .replace('{billable}', fmtAmt(x.billableAmount, x.currency))
                                            .replace('{pct}', pct(x.billableAmount, x.totalAmount)) })] }, x.currency))), _jsx("div", { className: "tt-reports__summary-card tt-reports__summary-chart", children: _jsxs("div", { className: "tt-reports__pie-legend tt-reports__pie-legend--stack", children: [_jsx("span", { className: "tt-reports__summary-label tt-reports__summary-label--block-head", children: t('timeTrackingPage.reports.kpi.reimbursableShareByCurrency') }), kpi.expensesByCurrency.map((x) => {
                                            const billPct = x.totalAmount > 0 ? (x.billableAmount / x.totalAmount) * 100 : 0;
                                            return (_jsxs("span", { className: "tt-reports__legend-item tt-reports__legend-item--wide", children: [_jsxs("span", { className: "tt-reports__legend-item-top", children: [_jsx("span", { className: "tt-reports__legend-dot tt-reports__legend-dot--billable", "aria-hidden": true }), _jsxs("span", { children: [x.currency, " \u00B7 ", Math.round(billPct), "%"] })] }), _jsxs("span", { className: "tt-reports__legend-item-value", children: [fmtAmt(x.billableAmount, x.currency), " / ", fmtAmt(x.totalAmount, x.currency)] })] }, x.currency));
                                        })] }) }), _jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.reimbursablePct') }), _jsx("span", { className: "tt-reports__summary-value", children: "\u2014" }), _jsx("span", { className: "tt-reports__summary-sub", children: t('timeTrackingPage.reports.kpi.reimbursablePerCurrencyNote') })] })] })), kpi.kind === 'expenses' && kpi.expensesByCurrency.length === 0 && (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.expensesLabel') }), _jsx("span", { className: "tt-reports__summary-value", children: "\u2014" })] })), kpi.kind === 'uninvoiced' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.uninvoicedHours') }), _jsx("span", { className: "tt-reports__summary-value", children: fmtH(kpi.uninvoicedHours) })] }), kpi.uninvoicedByCurrency.length === 0 ? (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsx("span", { className: "tt-reports__summary-label tt-reports__summary-label--stack", children: _jsx("span", { className: "tt-reports__summary-label-primary", children: t('timeTrackingPage.reports.kpi.uninvoicedAmounts') }) }), _jsx("span", { className: "tt-reports__summary-value", children: "\u2014" })] })) : (kpi.uninvoicedByCurrency.map((u) => (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsxs("span", { className: "tt-reports__summary-label tt-reports__summary-label--stack", children: [_jsx("span", { className: "tt-reports__summary-label-primary", children: t('timeTrackingPage.reports.kpi.uninvoicedShort') }), _jsx("span", { className: "tt-reports__summary-label-accent", children: u.currency })] }), _jsx("span", { className: "tt-reports__summary-value", children: fmtAmt(u.uninvoicedAmount, u.currency) }), _jsx("span", { className: "tt-reports__summary-sub", children: t('timeTrackingPage.reports.kpi.uninvoicedExpensesLine').replace('{amount}', fmtAmt(u.uninvoicedExpenses, u.currency)) })] }, u.currency)))), _jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.projectsInList') }), _jsx("span", { className: "tt-reports__summary-value", children: tableSearchQ ? filteredTableRows.length : (partnerProjectsScopeActive ? scopedResults.length : (pagination?.total_entries ?? results.length)) })] })] })), kpi.kind === 'budget' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.projectsWithBudget') }), _jsx("span", { className: "tt-reports__summary-value", children: kpi.projectCount })] }), _jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.budgetHoursSpent') }), _jsxs("span", { className: "tt-reports__summary-value", children: [fmtH(kpi.spentHours), " / ", fmtH(kpi.totalHoursBudget)] })] }), kpi.moneyBudgetByCurrency.length === 0 ? (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.budgetMoneySpent') }), _jsx("span", { className: "tt-reports__summary-value", children: "\u2014" })] })) : (kpi.moneyBudgetByCurrency.map((m) => {
                                const hasBudget = m.totalBudget > 0;
                                const line = !hasBudget && m.spent <= 0
                                    ? '—'
                                    : hasBudget
                                        ? `${fmtAmt(m.spent, m.currency)} / ${fmtAmt(m.totalBudget, m.currency)}`
                                        : fmtAmt(m.spent, m.currency);
                                return (_jsxs("div", { className: "tt-reports__summary-card tt-reports__summary-amount", children: [_jsxs("span", { className: "tt-reports__summary-label tt-reports__summary-label--stack", children: [_jsx("span", { className: "tt-reports__summary-label-primary", children: t('timeTrackingPage.reports.kpi.budgetMoney') }), _jsx("span", { className: "tt-reports__summary-label-accent", children: m.currency })] }), _jsx("span", { className: "tt-reports__summary-value", children: line })] }, m.currency));
                            })), _jsxs("div", { className: "tt-reports__summary-card", children: [_jsx("span", { className: "tt-reports__summary-label", children: t('timeTrackingPage.reports.kpi.utilizationHours') }), _jsxs("span", { className: "tt-reports__summary-value", children: [_jsx(IcoBudget, {}), kpi.totalHoursBudget > 0 ? ` ${Math.round((kpi.spentHours / kpi.totalHoursBudget) * 100)}%` : '—'] })] })] }))] }), groups && (_jsx("nav", { className: "tt-reports__group-nav", role: "tablist", children: groups.map((g) => (_jsx("button", { type: "button", role: "tab", "aria-selected": groupBy === g.id, className: `tt-reports__group-tab${groupBy === g.id ? ' tt-reports__group-tab--active' : ''}`, onClick: () => changeGroupBy(g.id), children: ttReportGroupLabel(g.id, t) }, g.id))) })), _jsxs("div", { className: "tt-reports__content", children: [_jsxs("div", { className: "tt-reports__content-header", children: [_jsxs("div", { className: "tt-reports__breakdown-label", role: "status", children: [_jsx("span", { className: "tt-reports__breakdown-hint", children: breakdownHint }), reportType === 'time' && partnerConfirmedList.length > 0 && !partnerHintsLoadFailed ? (_jsxs("span", { className: "tt-reports__partner-legend", role: "note", children: [_jsx("span", { className: "rp-partner-chip rp-partner-chip--confirmed", "aria-hidden": true, children: t('timeTrackingPage.reports.partnerChip.confirmed') }), _jsx("span", { className: "rp-partner-chip rp-partner-chip--invoiced", "aria-hidden": true, children: t('timeTrackingPage.reports.partnerChip.invoiced') }), _jsx("span", { className: "tt-reports__partner-legend-note", children: t('timeTrackingPage.reports.content.partnerLegendNote') })] })) : null, tableDataLoading && _jsx("span", { className: "tt-reports__loading-pulse tt-reports__breakdown-status", children: t('timeTrackingPage.reports.content.updating') })] }), _jsxs("div", { className: "tt-reports__content-header-right", children: [_jsxs("div", { className: "tt-reports__toolbar", children: [_jsxs("label", { className: "tt-reports__toolbar-check", title: t('timeTrackingPage.reports.partnerScope.onlyMyProjectsHint'), children: [_jsx("input", { type: "checkbox", checked: onlyMyProjects, onChange: (e) => { setOnlyMyProjects(e.target.checked); setPage(1); } }), _jsx("span", { children: t('timeTrackingPage.reports.partnerScope.onlyMyProjects') })] }), _jsx("div", { className: "tt-reports__toolbar-search", children: _jsx("input", { type: "search", className: "tt-reports__table-search-input", value: tableSearch, onChange: (e) => setTableSearch(e.target.value), placeholder: tableSearchPlaceholder, "aria-label": t('timeTrackingPage.reports.table.searchPlaceholder') }) }), _jsx("div", { className: "tt-reports__toolbar-meta", "aria-live": "polite", children: tableSearchQ ? (_jsx("span", { className: "tt-reports__row-count tt-reports__breakdown-status", children: searchFullLoading ? t('timeTrackingPage.reports.table.searchLoading') : t('timeTrackingPage.reports.table.searchResult').replace('{count}', String(filteredTableRows.length)) })) : (!loading && pagination ? (_jsx("span", { className: "tt-reports__row-count tt-reports__breakdown-status", children: pagination.total_entries > effectivePerPage
                                                        ? t('timeTrackingPage.reports.content.rowCountPaged')
                                                            .replace('{total}', String(pagination.total_entries))
                                                            .replace('{page}', String(page))
                                                            .replace('{pages}', String(pagination.total_pages))
                                                        : t('timeTrackingPage.reports.content.rowCount').replace('{count}', String(pagination.total_entries)) })) : !loading ? (_jsx("span", { className: "tt-reports__row-count tt-reports__breakdown-status", children: t('timeTrackingPage.reports.content.rowCount').replace('{count}', String(partnerProjectsScopeActive ? scopedResults.length : results.length)) })) : null) })] }), _jsxs("div", { className: "tt-reports__content-actions", children: [showSubmitForPartnerReview ? (_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => void handleSubmitForPartnerReview(), disabled: submitForReviewBusy || submitBlockedForProject, title: submitBlockedForProject ? t('timeTrackingPage.reports.submitForReview.sent') : submitForReviewBusy ? t('timeTrackingPage.reports.submitForReview.busy') : t('timeTrackingPage.reports.submitForReview.action'), children: submitBlockedForProject
                                                    ? t('timeTrackingPage.reports.submitForReview.sentShort')
                                                    : submitForReviewBusy
                                                        ? t('timeTrackingPage.reports.submitForReview.busy')
                                                        : t('timeTrackingPage.reports.submitForReview.action') })) : null, _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", onClick: openReportPreview, disabled: tableDataLoading || filteredTableRows.length === 0, title: t('timeTrackingPage.reports.table.previewTitle'), children: t('timeTrackingPage.reports.content.preview') }), _jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", onClick: () => void handleExport('xlsx'), disabled: exportBusy || tableDataLoading, title: reportType === 'time' ? t('timeTrackingPage.reports.table.exportXlsxTime') : t('timeTrackingPage.reports.table.exportXlsxDefault'), children: [_jsx(IcoDownload, {}), " Excel"] }), _jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon", onClick: () => void handleExport('csv'), disabled: exportBusy || tableDataLoading, title: reportType === 'time' ? t('timeTrackingPage.reports.table.exportCsvTime') : t('timeTrackingPage.reports.table.exportCsvDefault'), children: [_jsx(IcoDownload, {}), " CSV"] })] })] })] }), error && (_jsx("div", { className: "tt-reports__table-err", role: "alert", children: error })), _jsx("div", { className: `tt-reports__table-wrap${tableDataLoading ? ' tt-reports__table-wrap--loading' : ''}${reportType === 'time' || isExpenseLikeReportType(reportType) || reportType === 'uninvoiced' || reportType === 'project-budget' ? ' tt-reports__table-wrap--scroll-x' : ''}`, children: filteredTableRows.length === 0 && !tableDataLoading ? (_jsx("div", { className: "tt-reports__empty", children: tableSearchQ ? (_jsx("p", { children: t('timeTrackingPage.reports.content.noSearchMatch') })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-reports__empty-period", children: formatIsoRangeTitle(dateFrom, dateTo) }), onlyMyProjects && partnerProjectsScopeActive && partnerAllowedProjectIds != null && partnerAllowedProjectIds.size === 0 ? (_jsx("p", { children: t('timeTrackingPage.reports.partnerScope.noMyProjects') })) : (_jsx("p", { children: selectedUserIds.length > 0
                                            ? t('timeTrackingPage.reports.table.emptyFiltered')
                                            : t('timeTrackingPage.reports.table.empty') })), isExpenseLikeReportType(reportType) && !tableSearchQ ? (_jsx("p", { className: "tt-reports__empty-hint", style: { marginTop: '0.75rem', fontSize: '0.9rem', opacity: 0.85 }, children: t('timeTrackingPage.reports.content.expensesEmptyHint') })) : null] })) })) : reportType === 'time' ? (_jsx(TimeTable, { groupBy: groupBy, rows: sortedTimeTableRows ?? [], expanded: expandedRows, onToggle: toggleRow, onProjectRowPreview: groupBy === 'projects' ? openTimeProjectPreview : undefined, projectRowPreviewDisabled: groupBy === 'projects' ? tableDataLoading : undefined, onClientRowPreview: groupBy === 'clients' ? openTimeClientPreview : undefined, clientRowPreviewDisabled: groupBy === 'clients' ? tableDataLoading : undefined, onProjectRowContextMenu: groupBy === 'projects' && !tableDataLoading ? (x, y, id) => handleRowContextMenu('project', x, y, id) : undefined, onClientRowContextMenu: groupBy === 'clients' && !tableDataLoading ? (x, y, id) => handleRowContextMenu('client', x, y, id) : undefined, partnerProjectBadge: partnerProjectBadgeMap ? partnerProjectBadgeFn : undefined, partnerClientBadge: partnerClientBadgeMap ? partnerClientBadgeFn : undefined })) : isExpenseLikeReportType(reportType) ? (_jsx(ExpenseTable, { groupBy: groupBy, rows: filteredTableRows, expanded: expandedRows, onToggle: toggleRow })) : reportType === 'uninvoiced' ? (_jsx(UninvoicedTable, { rows: filteredTableRows, expanded: expandedRows, onToggle: toggleRow })) : (_jsx(BudgetTable, { rows: filteredTableRows, expanded: expandedRows, onToggle: toggleRow })) }), _jsx(ReportsRowContextMenu, { menu: rowContextMenu, onClose: () => setRowContextMenu(null), onOpen: (kind, id) => {
                            if (kind === 'project')
                                openTimeProjectPreview(id);
                            else
                                openTimeClientPreview(id);
                        }, onOpenNewTab: (kind, id) => {
                            if (kind === 'project')
                                openTimeProjectPreviewInNewTab(id);
                            else
                                openTimeClientPreviewInNewTab(id);
                        }, openLabel: t('timeTrackingPage.reports.table.contextOpen'), openNewTabLabel: t('timeTrackingPage.reports.table.contextOpenNewTab') }), pagination && pagination.total_pages > 1 && !tableSearchQ && (_jsxs("div", { className: "tt-reports__pagination", children: [_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: !pagination.previous_page, onClick: () => setPage((p) => p - 1), children: [_jsx(IcoChevLeft, {}), " ", t('timeTrackingPage.reports.pagination.back')] }), _jsx("span", { className: "tt-reports__pagination-info", children: t('timeTrackingPage.reports.pagination.info')
                                    .replace('{page}', String(pagination.page))
                                    .replace('{pages}', String(pagination.total_pages))
                                    .replace('{total}', String(pagination.total_entries)) }), _jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", disabled: !pagination.next_page, onClick: () => setPage((p) => p + 1), children: [t('timeTrackingPage.reports.pagination.forward'), " ", _jsx(IcoChevRight, {})] })] }))] })] }));
}
