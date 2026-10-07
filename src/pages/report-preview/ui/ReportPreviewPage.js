import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { ReportPreviewMockSkeleton } from './ReportPreviewMockSkeleton';
import { ReportPreviewManagerSubmitBar, ReportPreviewPartnerSignFooter, ReportPreviewPartnerBar } from './ReportPreviewPartnerConfirm';
import { ReportPreviewEmployeeExcelFilter } from './ReportPreviewEmployeeExcelFilter';
import { ReportPreviewFiltersBar } from './ReportPreviewFiltersBar';
import { BudgetExcelPreviewTable, ExpenseExcelPreviewTable, TimeExcelPreviewTable, UninvoicedExcelPreviewTable, } from './ReportPreviewExcelTables';
import { sortRowsByUserName, uniqueSortedEmployeeNames, mergeUniqueSortedEmployeeNames, } from '../lib/sortReportPreviewRows';
import { buildReportPreviewPartnerExcel, downloadBlob } from '../lib/reportPreviewPartnerExcel';
import { applyAuthUserExportProfilesToTimePreviewRows, buildAuthUserExportProfileLookup, mergeAuthUserExportProfileMaps, mergeAuthUserExportProfiles, } from '../lib/reportPreviewEmployeeInitials';
import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
import { resolveReportEmployeePosition } from '@entities/time-tracking/lib/reportEmployeePosition';
import { getUsers } from '@entities/user';
import { Link } from 'react-router-dom';
import { isHiddenSystemUser } from '@shared/lib';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { fetchReportsMeta, fetchReportsUsersForFilter, fetchAllTimeReportClientRows, fetchAllTimeReportProjectRows, fetchAllTimeReportTaskRows, fetchAllTimeReportTeamRows, fetchAllExpenseReportRows, fetchAllUninvoicedReportRows, fetchAllBudgetReportRows, isTimeTrackingHttpError, isClosedReportingWeekEditingBlockedForSubject, patchTimeEntry, createTimeEntry, deleteTimeEntry, canOverrideReportPreviewWeeklyLock, listPartnerUsersWithProjectAccessToProject, listUsersWithProjectAccessToProjectForPick, listTimeTrackingUsers, listTimeTrackingTeams, invalidateReportApiCache, getReportSnapshot, patchReportSnapshotRow, listProjectScopeDefinitions, upsertProjectScopeDefinition, } from '@entities/time-tracking';
import { buildArchivedAuthUserIds, buildArchivedEmployeeNames, filterActiveEmployeeNames, isActiveReportPreviewEmployee, } from '../lib/reportPreviewActiveEmployees';
import { readReportPreviewTransfer, normalizeReportPreviewTransfer, resolveReportPreviewPeriodState, } from '@entities/time-tracking/model/reportPreviewTransfer';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { notifyPartnerConfirmedReportsListInvalidate } from '@entities/time-tracking/model/partnerConfirmedReports';
import { coerceGroupByForType, } from '@entities/time-tracking/model/reportsPanelConfig';
import { formatIsoRangeTitle, formatPeriodLabel, periodToDates, clampReportsDateRange, REPORTS_ALL_TIME_DATE_FROM, } from '@entities/time-tracking/lib/reportsPeriodRange';
import { useI18n } from '@shared/i18n';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { showToast } from '@shared/ui/app-toast';
import { loadTimesheetProjectOptionsForMove, } from '@pages/time-tracking/ui/timesheetProjectLoader';
import { sortTimeReportRowsForDisplay } from '@entities/time-tracking/lib/timeReportRows';
import { deduplicateTimeExcelPreviewRows } from '../lib/reportPreviewDuplicateRows';
import { pickDefaultTeamId, resolveEffectiveReportPreviewUserIds, resolveTeamMemberUserIds, mergeNamedUsersForPartnerTeam, mergeProjectMembersWithPartnerTeam, } from '../lib/reportPreviewTeamFilter';
import { flattenTimeReportToExcelRows, flattenExpenseReportToExcelRows, flattenUninvoicedToExcelRows, flattenBudgetToExcelRows, } from '../lib/reportPreviewApiToExcelRows';
import { mergeTimeEntryResponseIntoRow, persistTimeExcelPreviewRow, previewRowAfterCreate, registerTimeEntryServerOwner, resolveTaskForTargetProject, serverAuthUserIdForTimeEntry, syncTimeEntryServerOwnersFromRows, taskIdForApi, timeExcelPreviewRowToCreateBody, } from '../lib/reportPreviewTimeEntrySave';
import { applyTimePreviewRowPatch, fetchBillableRateForPreviewRow, previewRowNeedsAsyncBillableRateFetch, } from '../lib/reportPreviewRowPatch';
import { recomputeTimePreviewRowAmountToPay } from '../lib/reportPreviewPartnerExcel';
import { isDateTimeOnlyPreviewPatch, localYmdAndHmToIso, } from '../lib/briefRecordDateTimeEdit';
import { canUndo as editHistoryCanUndo, clearEditHistory, createReportPreviewEditHistory, popUndo, pushCreateUndo, pushDeleteUndo, pushPatchUndo, } from '../lib/reportPreviewEditHistory';
import { resolveReportPreviewHotkey, } from '../lib/reportPreviewHotkeys';
import { REPORT_PREVIEW_SCOPE_DEFAULT } from '../lib/reportPreviewScopePalette';
import { useCurrentUser } from '@shared/hooks';
import { useAppDialog } from '@shared/ui';
import '@pages/time-tracking/ui/TimePageShell.css';
import './ReportPreviewPage.css';
import { ReportPreviewNavBar, REPORTS_TAB_URL } from './ReportPreviewNavBar';
import { stripReportPagination, previewProjectOptionLabel, projectNameFromExcelRows, buildMissingProjectOption, pickDefaultWorkDateInRange, pad2p, buildTemplateForNewPreviewRow, buildApiFilters, parseUserIdsFromFilter, buildPreviewPeriodState, buildReportPreviewSyncedFilters, reportPreviewXferFiltersInSync, previewLiveTitle, reportPreviewConfirmationProjectId, persistXferFilters, } from '../lib/reportPreviewPageFilters';
import { getSnapshotRowDisplayData } from '@entities/time-tracking/lib/reportSnapshotOverrides';
import { ReportPreviewScopeDescriptionModal, ReportPreviewScopeLegend } from './ReportPreviewScopeDefinitions';
function reportPreviewEmptyBlock(rangeFrom, rangeTo) {
    return (_jsxs("div", { className: "tt-rp-preview__no-table-wrap", children: [_jsx("p", { className: "tt-rp-preview__period-line", children: formatIsoRangeTitle(rangeFrom, rangeTo) }), _jsx("p", { className: "tt-rp-preview__muted tt-rp-preview__no-table-msg", children: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u0438 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u044B." })] }));
}
function normalizeScopeHexColor(value) {
    const raw = String(value).trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(raw))
        return REPORT_PREVIEW_SCOPE_DEFAULT;
    return raw.toUpperCase();
}
function parseStoredScopeHexColor(value) {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!/^#([0-9A-F]{6})$/.test(raw))
        return null;
    return raw;
}
export function ReportPreviewPage() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const [reportPageSizeMax, setReportPageSizeMax] = useState(null);
    const listPerPage = useMemo(() => {
        const cap = reportPageSizeMax != null && reportPageSizeMax > 0 ? Math.min(reportPageSizeMax, 5000) : 500;
        return Math.min(500, cap);
    }, [reportPageSizeMax]);
    const [loading, setLoading] = useState(true);
    const [xferHydrated, setXferHydrated] = useState(false);
    const [xferSnapshot, setXferSnapshot] = useState(null);
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [teamFilterEnabled, setTeamFilterEnabled] = useState(false);
    const [teamFilterPartnerId, setTeamFilterPartnerId] = useState(0);
    const [teamFilterTeamId, setTeamFilterTeamId] = useState('');
    const [teamsCatalog, setTeamsCatalog] = useState([]);
    const [teamsCatalogLoading, setTeamsCatalogLoading] = useState(false);
    const [teamsCatalogError, setTeamsCatalogError] = useState(null);
    const [usersForFilter, setUsersForFilter] = useState([]);
    const [usersForFilterError, setUsersForFilterError] = useState(null);
    const [catalogUserExportProfilesById, setCatalogUserExportProfilesById] = useState(() => new Map());
    const [ttUsersCatalog, setTtUsersCatalog] = useState([]);
    const [periodDate, setPeriodDate] = useState(() => new Date());
    const [periodGranularity, setPeriodGranularity] = useState('month');
    const [customRangeActive, setCustomRangeActive] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [projectOptions, setProjectOptions] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState(null);
    const [projectMembersForEmployeePick, setProjectMembersForEmployeePick] = useState([]);
    const [projectPartnersWithAccess, setProjectPartnersWithAccess] = useState([]);
    const [projectMembersPickLoading, setProjectMembersPickLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState(null);
    const [timeExcelRows, setTimeExcelRows] = useState([]);
    const [expenseExcelRows, setExpenseExcelRows] = useState([]);
    const [uninvoicedExcelRows, setUninvoicedExcelRows] = useState([]);
    const [budgetExcelRows, setBudgetExcelRows] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState(() => new Set());
    const [scopeColorValue, setScopeColorValue] = useState(REPORT_PREVIEW_SCOPE_DEFAULT);
    const [scopeColorBusy, setScopeColorBusy] = useState(false);
    const [scopeDefinitions, setScopeDefinitions] = useState([]);
    const [scopeDefinitionsLoading, setScopeDefinitionsLoading] = useState(false);
    const [scopeDescriptionEditor, setScopeDescriptionEditor] = useState(null);
    const [scopeDescriptionSaving, setScopeDescriptionSaving] = useState(false);
    const [rowScopeColorsByKey, setRowScopeColorsByKey] = useState({});
    const [snapshotRowIdByPreviewKey, setSnapshotRowIdByPreviewKey] = useState({});
    const [employeeExcluded, setEmployeeExcluded] = useState(() => new Set());
    const [employeeSortAsc, setEmployeeSortAsc] = useState(true);
    const [timeBriefEmployeeSearch, setTimeBriefEmployeeSearch] = useState('');
    const [serverDataRefreshNonce, setServerDataRefreshNonce] = useState(0);
    const [timeReportViewMode, setTimeReportViewMode] = useState('brief');
    const timeExcelRowsRef = useRef([]);
    const timeEntrySaveTimers = useRef(new Map());
    const timeEntryServerOwnerByEntryIdRef = useRef(new Map());
    const deletedTimeEntryIdsRef = useRef(new Set());
    const timeEntryPersistSkipRowKeysRef = useRef(new Set());
    const editHistoryRef = useRef(createReportPreviewEditHistory());
    const activeTimeRowKeyRef = useRef(null);
    const undoBusyRef = useRef(false);
    const [editHistoryVersion, setEditHistoryVersion] = useState(0);
    const [hotkeyDuplicateRowKey, setHotkeyDuplicateRowKey] = useState(null);
    const [flashRestoredRowKey, setFlashRestoredRowKey] = useState(null);
    const flashRestoredTimerRef = useRef(null);
    const [timeEntrySaveUI, setTimeEntrySaveUI] = useState(() => 'idle');
    const [timeEntrySaveMessage, setTimeEntrySaveMessage] = useState(null);
    const [timeEntryActionPendingRowKey, setTimeEntryActionPendingRowKey] = useState(null);
    const [timeExcelDownloadBusy, setTimeExcelDownloadBusy] = useState(false);
    const [partnerConfirmedEditing, setPartnerConfirmedEditing] = useState(false);
    useLayoutEffect(() => {
        timeExcelRowsRef.current = timeExcelRows;
    }, [timeExcelRows]);
    useEffect(() => {
        const saveTimers = timeEntrySaveTimers.current;
        return () => {
            for (const t of saveTimers.values())
                clearTimeout(t);
            saveTimers.clear();
            if (flashRestoredTimerRef.current)
                clearTimeout(flashRestoredTimerRef.current);
        };
    }, []);
    useEffect(() => {
        if (timeEntrySaveUI !== 'err' || !timeEntrySaveMessage)
            return;
        showToast({ message: timeEntrySaveMessage, variant: 'error' });
    }, [timeEntrySaveUI, timeEntrySaveMessage]);
    useEffect(() => {
        if (!reportError)
            return;
        showToast({ message: reportError, variant: 'error' });
    }, [reportError]);
    const bumpEditHistory = useCallback(() => {
        setEditHistoryVersion((v) => v + 1);
    }, []);
    const flashRestoredRow = useCallback((rowKey) => {
        if (flashRestoredTimerRef.current)
            clearTimeout(flashRestoredTimerRef.current);
        setFlashRestoredRowKey(rowKey);
        flashRestoredTimerRef.current = setTimeout(() => {
            setFlashRestoredRowKey((cur) => (cur === rowKey ? null : cur));
            flashRestoredTimerRef.current = null;
        }, 2600);
    }, []);
    const clearPendingSaveTimer = useCallback((rowKey) => {
        const prevT = timeEntrySaveTimers.current.get(rowKey);
        if (prevT)
            clearTimeout(prevT);
        timeEntrySaveTimers.current.delete(rowKey);
    }, []);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setUsersForFilterError(null);
        void fetchReportsUsersForFilter(controller.signal)
            .then((list) => {
            if (cancelled)
                return;
            const filtered = list.filter((u) => !isHiddenSystemUser({ email: u.email, display_name: u.displayName }));
            setUsersForFilter(filtered);
            setUsersForFilterError(null);
            setCatalogUserExportProfilesById((prev) => mergeAuthUserExportProfiles(prev, filtered.map((u) => ({
                authUserId: u.id,
                initials: u.initials,
            }))));
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
    }, [t]);
    useEffect(() => {
        let cancelled = false;
        setTeamsCatalogLoading(true);
        setTeamsCatalogError(null);
        void listTimeTrackingTeams()
            .then((list) => {
            if (cancelled)
                return;
            setTeamsCatalog(Array.isArray(list) ? list : []);
            setTeamsCatalogError(null);
        })
            .catch(() => {
            if (cancelled)
                return;
            setTeamsCatalog([]);
            setTeamsCatalogError('Не удалось загрузить команды');
        })
            .finally(() => {
            if (!cancelled)
                setTeamsCatalogLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        void listTimeTrackingUsers(controller.signal)
            .then((list) => {
            if (cancelled)
                return;
            setTtUsersCatalog(Array.isArray(list) ? list : []);
            setCatalogUserExportProfilesById((prev) => mergeAuthUserExportProfileMaps(prev, buildAuthUserExportProfileLookup(list)));
        })
            .catch(() => {
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);
    useEffect(() => {
        let cancelled = false;
        void getUsers(true)
            .then((list) => {
            if (cancelled)
                return;
            setCatalogUserExportProfilesById((prev) => mergeAuthUserExportProfileMaps(prev, buildAuthUserExportProfileLookup(list)));
        })
            .catch(() => {
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const authUserExportProfilesById = useMemo(() => {
        let merged = new Map(catalogUserExportProfilesById);
        if (projectMembersForEmployeePick.length > 0) {
            merged = mergeAuthUserExportProfiles(merged, projectMembersForEmployeePick.map((m) => ({
                authUserId: m.authUserId,
                position: m.position,
            })));
        }
        return merged;
    }, [catalogUserExportProfilesById, projectMembersForEmployeePick]);
    useEffect(() => {
        if (authUserExportProfilesById.size === 0)
            return;
        setTimeExcelRows((prev) => {
            if (prev.length === 0)
                return prev;
            const next = applyAuthUserExportProfilesToTimePreviewRows(prev, authUserExportProfilesById);
            if (next === prev)
                return prev;
            timeExcelRowsRef.current = next;
            return next;
        });
    }, [authUserExportProfilesById]);
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
    useEffect(() => {
        const raw = readReportPreviewTransfer();
        if (!raw) {
            setXferSnapshot(null);
            setRangeFrom('');
            setRangeTo('');
            setSelectedProjectId('');
            setSelectedClientId('');
            setXferHydrated(true);
            setLoading(false);
            return;
        }
        const xfer = normalizeReportPreviewTransfer(raw);
        const base = stripReportPagination(xfer.filters);
        const clamped = clampReportsDateRange(base.dateFrom, base.dateTo);
        setXferSnapshot(xfer);
        setRangeFrom(clamped.dateFrom);
        setRangeTo(clamped.dateTo);
        const resolvedPeriod = resolveReportPreviewPeriodState(clamped.dateFrom, clamped.dateTo, xfer.period);
        // Oversized legacy "all time" (2000-01-01) must not stay as a custom range — use clamped preset.
        if (xfer.period?.customRangeActive
            && (base.dateFrom.slice(0, 10) !== clamped.dateFrom || base.dateTo.slice(0, 10) !== clamped.dateTo)
            && base.dateFrom.slice(0, 10) === REPORTS_ALL_TIME_DATE_FROM) {
            const end = resolvedPeriod.periodDate;
            setPeriodDate(end);
            setPeriodGranularity('all');
            setCustomRangeActive(false);
        }
        else {
            setPeriodDate(resolvedPeriod.periodDate);
            setPeriodGranularity(resolvedPeriod.periodGranularity);
            setCustomRangeActive(resolvedPeriod.customRangeActive);
        }
        setSelectedUserIds(parseUserIdsFromFilter(base.user_id));
        setTeamFilterEnabled(base.team_filter_enabled === true);
        const storedPartnerId = Number(base.team_filter_partner_auth_user_id);
        setTeamFilterPartnerId(Number.isFinite(storedPartnerId) && storedPartnerId > 0 ? Math.round(storedPartnerId) : 0);
        setTeamFilterTeamId(typeof base.team_id === 'string' ? base.team_id.trim() : '');
        const pid = typeof base.project_id === 'string' && base.project_id.trim() ? base.project_id.trim() : '';
        setSelectedProjectId(pid);
        const clid = typeof base.client_id === 'string' && base.client_id.trim() ? base.client_id.trim() : '';
        setSelectedClientId(clid);
        setXferHydrated(true);
        setLoading(false);
    }, []);
    useEffect(() => {
        if (!user || !xferSnapshot || xferSnapshot.reportType !== 'time') {
            setProjectOptions([]);
            setProjectsError(null);
            setProjectsLoading(false);
            return;
        }
        let cancelled = false;
        setProjectsLoading(true);
        setProjectsError(null);
        void loadTimesheetProjectOptionsForMove(user).then(({ items, error }) => {
            if (cancelled)
                return;
            setProjectOptions(items);
            setProjectsError(error);
            setProjectsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user, xferSnapshot]);
    useEffect(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || xferSnapshot.groupBy !== 'projects') {
            setProjectMembersForEmployeePick([]);
            setProjectPartnersWithAccess([]);
            setProjectMembersPickLoading(false);
            return;
        }
        const pid = selectedProjectId.trim();
        if (!pid) {
            setProjectMembersForEmployeePick([]);
            setProjectPartnersWithAccess([]);
            setProjectMembersPickLoading(false);
            return;
        }
        let cancelled = false;
        setProjectMembersPickLoading(true);
        void listUsersWithProjectAccessToProjectForPick(pid)
            .then(async (members) => {
            const partners = await listPartnerUsersWithProjectAccessToProject(pid);
            if (!cancelled) {
                setProjectMembersForEmployeePick(members);
                setProjectPartnersWithAccess(partners);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setProjectMembersForEmployeePick([]);
                setProjectPartnersWithAccess([]);
            }
        })
            .finally(() => {
            if (!cancelled)
                setProjectMembersPickLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [xferSnapshot, selectedProjectId]);
    useEffect(() => {
        const projectId = selectedProjectId.trim();
        if (xferSnapshot?.reportType !== 'time' || !projectId) {
            setScopeDefinitions([]);
            setScopeDefinitionsLoading(false);
            setScopeDescriptionEditor(null);
            return;
        }
        let cancelled = false;
        setScopeDefinitions([]);
        setScopeDefinitionsLoading(true);
        setScopeDescriptionEditor(null);
        void listProjectScopeDefinitions(projectId)
            .then((definitions) => {
            if (!cancelled)
                setScopeDefinitions(definitions);
        })
            .catch((error) => {
            if (!cancelled) {
                setScopeDefinitions([]);
                showToast({
                    message: error instanceof Error ? error.message : 'Не удалось загрузить описания Scope',
                    variant: 'error',
                });
            }
        })
            .finally(() => {
            if (!cancelled)
                setScopeDefinitionsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedProjectId, xferSnapshot?.reportType]);
    const viewerIsPartner = useMemo(() => Boolean(user && isPartnerOrgRole(user.role, user.position)), [user]);
    const canPickTeamFilterPartner = Boolean(user && hasFullTimeTrackingTabs(user));
    const effectiveSelectedUserIds = useMemo(() => resolveEffectiveReportPreviewUserIds({
        teamFilterEnabled,
        teamFilterPartnerId,
        teamFilterTeamId,
        teams: teamsCatalog,
        selectedUserIds,
    }), [teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teamsCatalog, selectedUserIds]);
    const usersForEmployeeFilter = useMemo(() => mergeNamedUsersForPartnerTeam({
        teamFilterEnabled,
        partnerAuthUserId: teamFilterPartnerId,
        teamId: teamFilterTeamId,
        teams: teamsCatalog,
        users: usersForFilter,
        catalog: ttUsersCatalog,
    }), [usersForFilter, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teamsCatalog, ttUsersCatalog]);
    const handleTeamFilterEnabledChange = useCallback((enabled) => {
        setTeamFilterEnabled(enabled);
        if (!enabled) {
            setSelectedUserIds([]);
            return;
        }
        if (viewerIsPartner && user?.id && teamFilterPartnerId <= 0)
            setTeamFilterPartnerId(user.id);
    }, [viewerIsPartner, user?.id, teamFilterPartnerId]);
    const handleTeamFilterPartnerChange = useCallback((partnerId) => {
        setTeamFilterPartnerId(partnerId);
        setTeamFilterTeamId(pickDefaultTeamId(teamsCatalog, partnerId));
        if (teamFilterEnabled) {
            const ids = resolveTeamMemberUserIds(teamsCatalog, partnerId, pickDefaultTeamId(teamsCatalog, partnerId) || undefined);
            if (ids.length > 0)
                setSelectedUserIds(ids);
        }
    }, [teamsCatalog, teamFilterEnabled]);
    const handleTeamFilterTeamChange = useCallback((nextTeamId) => {
        setTeamFilterTeamId(nextTeamId);
        if (teamFilterEnabled && teamFilterPartnerId > 0) {
            const ids = resolveTeamMemberUserIds(teamsCatalog, teamFilterPartnerId, nextTeamId.trim() || undefined);
            if (ids.length > 0)
                setSelectedUserIds(ids);
        }
    }, [teamFilterEnabled, teamFilterPartnerId, teamsCatalog]);
    useEffect(() => {
        if (!user || !viewerIsPartner || teamFilterPartnerId > 0)
            return;
        setTeamFilterPartnerId(user.id);
    }, [user, viewerIsPartner, teamFilterPartnerId]);
    useEffect(() => {
        if (!teamFilterEnabled || teamFilterPartnerId <= 0)
            return;
        const ids = resolveTeamMemberUserIds(teamsCatalog, teamFilterPartnerId, teamFilterTeamId.trim() || undefined);
        if (ids.length === 0)
            return;
        setSelectedUserIds((prev) => {
            const prevKey = [...prev].sort((a, b) => a - b).join(',');
            const nextKey = ids.join(',');
            return prevKey === nextKey ? prev : ids;
        });
    }, [teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teamsCatalog]);
    useEffect(() => {
        if (!rangeFrom || !rangeTo)
            return;
        setXferSnapshot((prev) => {
            if (!prev)
                return prev;
            const filters = buildReportPreviewSyncedFilters(prev, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, reportPageSizeMax);
            const period = buildPreviewPeriodState(periodGranularity, periodDate, customRangeActive);
            if (reportPreviewXferFiltersInSync(prev, filters, listPerPage, period))
                return prev;
            persistXferFilters(prev, filters, listPerPage, period);
            return { ...prev, filters: { ...filters, page: 1, per_page: listPerPage }, period };
        });
    }, [rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, listPerPage, reportPageSizeMax, periodGranularity, periodDate, customRangeActive]);
    const presetRange = useMemo(() => periodToDates(periodDate, periodGranularity), [periodDate, periodGranularity]);
    useEffect(() => {
        if (!xferHydrated || customRangeActive)
            return;
        setRangeFrom(presetRange.dateFrom);
        setRangeTo(presetRange.dateTo);
    }, [xferHydrated, presetRange.dateFrom, presetRange.dateTo, customRangeActive]);
    // Legacy / custom ranges may still hold 2000-01-01 → far dateTo; clamp to API max (~10y).
    useEffect(() => {
        if (!xferHydrated || !rangeFrom || !rangeTo)
            return;
        const clamped = clampReportsDateRange(rangeFrom, rangeTo);
        if (clamped.dateFrom !== rangeFrom || clamped.dateTo !== rangeTo) {
            setRangeFrom(clamped.dateFrom);
            setRangeTo(clamped.dateTo);
        }
    }, [xferHydrated, rangeFrom, rangeTo]);
    const periodTitle = useMemo(() => {
        if (customRangeActive)
            return formatIsoRangeTitle(rangeFrom, rangeTo);
        if (periodGranularity === 'all')
            return t('timeTrackingPage.reports.periods.all');
        return formatPeriodLabel(periodDate, periodGranularity);
    }, [customRangeActive, rangeFrom, rangeTo, periodDate, periodGranularity, t]);
    const previewDataResetKey = useMemo(() => {
        if (!xferSnapshot)
            return '';
        const usersKey = [...effectiveSelectedUserIds].sort((a, b) => a - b).join(',');
        const teamKey = teamFilterEnabled
            ? `${teamFilterPartnerId}|${teamFilterTeamId.trim()}`
            : '';
        if (xferSnapshot.reportType === 'time')
            return `time|${rangeFrom}|${rangeTo}|p:${selectedProjectId}|c:${selectedClientId}|u:${usersKey}|tf:${teamKey}|${xferSnapshot.groupBy}`;
        return `${xferSnapshot.reportType}|${rangeFrom}|${rangeTo}|u:${usersKey}|tf:${teamKey}`;
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId]);
    useEffect(() => {
        setSelectedRowKeys(new Set());
        setRowScopeColorsByKey({});
        setSnapshotRowIdByPreviewKey({});
        setEmployeeExcluded(new Set());
        setEmployeeSortAsc(true);
    }, [previewDataResetKey]);
    const onPreviewFrom = useCallback((iso) => {
        setCustomRangeActive(true);
        setRangeFrom(iso);
        setRangeTo((to) => (iso > to ? iso : to));
    }, []);
    const onPreviewTo = useCallback((iso) => {
        setCustomRangeActive(true);
        setRangeTo(iso);
        setRangeFrom((from) => (iso < from ? iso : from));
    }, []);
    const onPreviewPrevPeriod = useCallback(() => {
        if (periodGranularity === 'all')
            return;
        setCustomRangeActive(false);
        setPeriodDate((d) => {
            const next = new Date(d);
            if (periodGranularity === 'week')
                next.setDate(next.getDate() - 7);
            else if (periodGranularity === 'month')
                next.setMonth(next.getMonth() - 1);
            else if (periodGranularity === 'quarter')
                next.setMonth(next.getMonth() - 3);
            else
                next.setFullYear(next.getFullYear() - 1);
            return next;
        });
    }, [periodGranularity]);
    const onPreviewNextPeriod = useCallback(() => {
        if (periodGranularity === 'all')
            return;
        setCustomRangeActive(false);
        setPeriodDate((d) => {
            const next = new Date(d);
            if (periodGranularity === 'week')
                next.setDate(next.getDate() + 7);
            else if (periodGranularity === 'month')
                next.setMonth(next.getMonth() + 1);
            else if (periodGranularity === 'quarter')
                next.setMonth(next.getMonth() + 3);
            else
                next.setFullYear(next.getFullYear() + 1);
            return next;
        });
    }, [periodGranularity]);
    const onPreviewPeriodGranularityChange = useCallback((g) => {
        setPeriodGranularity(g);
        setCustomRangeActive(false);
    }, []);
    const onPreviewResetCustomRange = useCallback(() => {
        setCustomRangeActive(false);
    }, []);
    const onProjectPick = useCallback((id) => {
        setSelectedProjectId(id);
    }, []);
    const projectItemsForSelect = useMemo(() => {
        const list = projectOptions;
        if (!selectedProjectId || list.some((p) => p.id === selectedProjectId))
            return list;
        return [buildMissingProjectOption(selectedProjectId, timeExcelRows), ...list];
    }, [projectOptions, selectedProjectId, timeExcelRows]);
    const timeProjectTitle = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || !rangeFrom || !rangeTo)
            return '';
        const sel = projectItemsForSelect.find((p) => p.id === selectedProjectId);
        if (sel)
            return previewProjectOptionLabel(sel);
        const nameFromRows = projectNameFromExcelRows(selectedProjectId, timeExcelRows);
        if (nameFromRows)
            return nameFromRows;
        return selectedProjectId
            ? 'Проект'
            : 'Все проекты (по фильтрам)';
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, projectItemsForSelect, timeExcelRows]);
    const timePreviewTableTitle = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || !rangeFrom || !rangeTo)
            return '';
        if (xferSnapshot.groupBy === 'clients') {
            if (!selectedClientId)
                return 'Все клиенты (по фильтрам)';
            const name = timeExcelRows.find((r) => String(r.clientId ?? '').trim() === selectedClientId)?.clientName?.trim();
            return name ? `Клиент: ${name}` : `Клиент ${selectedClientId}`;
        }
        return timeProjectTitle;
    }, [xferSnapshot, rangeFrom, rangeTo, selectedClientId, timeExcelRows, timeProjectTitle]);
    const addEntryProjectOption = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || !rangeFrom || !rangeTo)
            return null;
        if (xferSnapshot.groupBy === 'projects') {
            const id = selectedProjectId.trim();
            if (!id)
                return null;
            return projectItemsForSelect.find((p) => p.id === id) ?? null;
        }
        const cid = selectedClientId.trim();
        if (!cid)
            return null;
        const rowWithProject = timeExcelRows.find((r) => String(r.clientId ?? '').trim() === cid && String(r.projectId ?? '').trim());
        if (!rowWithProject)
            return null;
        const opt = projectItemsForSelect.find((p) => p.id === rowWithProject.projectId);
        if (opt)
            return opt;
        return {
            id: rowWithProject.projectId,
            name: (rowWithProject.projectName || rowWithProject.projectId).trim() || rowWithProject.projectId,
            client: rowWithProject.clientName,
            clientId: rowWithProject.clientId,
            color: 'hsl(220 14% 46%)',
            currency: rowWithProject.currency || 'USD',
            recordsLanguage: 'ENG',
        };
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, projectItemsForSelect, timeExcelRows]);
    useEffect(() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo) {
            setTimeExcelRows([]);
            setExpenseExcelRows([]);
            setUninvoicedExcelRows([]);
            setBudgetExcelRows([]);
            setReportError(null);
            setReportLoading(false);
            timeEntryServerOwnerByEntryIdRef.current.clear();
            deletedTimeEntryIdsRef.current.clear();
            return;
        }
        let cancelled = false;
        setReportLoading(true);
        setReportError(null);
        timeEntryServerOwnerByEntryIdRef.current.clear();
        deletedTimeEntryIdsRef.current.clear();
        const apiFilters = {
            ...buildApiFilters(xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds),
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
        };
        void (async () => {
            try {
                if (xferSnapshot.reportType === 'time') {
                    const gb = xferSnapshot.groupBy;
                    const raw = gb === 'clients'
                        ? await fetchAllTimeReportClientRows(apiFilters)
                        : gb === 'projects'
                            ? await fetchAllTimeReportProjectRows(apiFilters)
                            : gb === 'tasks'
                                ? await fetchAllTimeReportTaskRows(apiFilters)
                                : await fetchAllTimeReportTeamRows(apiFilters);
                    const sorted = sortTimeReportRowsForDisplay(gb, raw);
                    if (!cancelled) {
                        const rows = applyAuthUserExportProfilesToTimePreviewRows(deduplicateTimeExcelPreviewRows(flattenTimeReportToExcelRows(gb, sorted)), authUserExportProfilesById);
                        syncTimeEntryServerOwnersFromRows(timeEntryServerOwnerByEntryIdRef.current, rows);
                        setTimeExcelRows(rows);
                        const colorsFromApi = {};
                        for (const r of rows) {
                            const c = parseStoredScopeHexColor(r.scopeColor);
                            if (c)
                                colorsFromApi[r.rowKey] = c;
                        }
                        setRowScopeColorsByKey(colorsFromApi);
                    }
                    return;
                }
                if (xferSnapshot.reportType === 'expenses') {
                    const gb = coerceGroupByForType('expenses', xferSnapshot.groupBy);
                    const raw = await fetchAllExpenseReportRows(gb, apiFilters);
                    if (!cancelled)
                        setExpenseExcelRows(flattenExpenseReportToExcelRows(gb, raw));
                    return;
                }
                if (xferSnapshot.reportType === 'uninvoiced') {
                    const raw = await fetchAllUninvoicedReportRows(apiFilters);
                    if (!cancelled)
                        setUninvoicedExcelRows(flattenUninvoicedToExcelRows(raw));
                    return;
                }
                const raw = await fetchAllBudgetReportRows(apiFilters);
                if (!cancelled)
                    setBudgetExcelRows(flattenBudgetToExcelRows(raw));
            }
            catch (e) {
                if (!cancelled) {
                    const msg = isTimeTrackingHttpError(e)
                        ? e.message
                        : e instanceof Error
                            ? e.message
                            : 'Не удалось загрузить отчёт';
                    setReportError(msg);
                }
            }
            finally {
                if (!cancelled)
                    setReportLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds, serverDataRefreshNonce, reportPageSizeMax, authUserExportProfilesById]);
    const requestServerDataReload = useCallback(() => {
        clearEditHistory(editHistoryRef.current);
        bumpEditHistory();
        invalidateReportApiCache();
        setServerDataRefreshNonce((n) => n + 1);
    }, [bumpEditHistory]);
    useEffect(() => {
        const snapshotId = xferSnapshot?.partnerConfirmationSnapshotId?.trim() ?? '';
        if (!snapshotId || timeExcelRows.length === 0) {
            setSnapshotRowIdByPreviewKey({});
            return;
        }
        let cancelled = false;
        void getReportSnapshot(snapshotId)
            .then((snapshot) => {
            if (cancelled)
                return;
            const byEntryId = new Map();
            for (const sr of snapshot.rows ?? []) {
                const display = getSnapshotRowDisplayData(sr);
                const entryId = String(display.timeEntryId ?? display.time_entry_id ?? '').trim();
                if (!entryId)
                    continue;
                const scopeColor = parseStoredScopeHexColor(String(display.scopeColor ?? display.scope_color ?? '').trim());
                byEntryId.set(entryId, {
                    rowId: sr.id,
                    scopeColor: scopeColor ?? '',
                });
            }
            const nextKeyMap = {};
            const nextColors = {};
            for (const row of timeExcelRows) {
                const entryId = row.timeEntryId.trim();
                if (!entryId)
                    continue;
                const hit = byEntryId.get(entryId);
                if (!hit)
                    continue;
                nextKeyMap[row.rowKey] = hit.rowId;
                if (hit.scopeColor)
                    nextColors[row.rowKey] = hit.scopeColor;
            }
            setSnapshotRowIdByPreviewKey(nextKeyMap);
            setRowScopeColorsByKey((prev) => {
                // Prefer colors already loaded from live report / local edits; fill gaps from snapshot.
                const merged = { ...nextColors, ...prev };
                return merged;
            });
        })
            .catch(() => {
            if (!cancelled)
                setSnapshotRowIdByPreviewKey({});
        });
        return () => {
            cancelled = true;
        };
    }, [xferSnapshot?.partnerConfirmationSnapshotId, timeExcelRows]);
    useEffect(() => {
        setPartnerConfirmedEditing(false);
    }, [xferSnapshot?.partnerConfirmationSnapshotId]);
    const isProjectPartnerForPreview = useMemo(() => {
        if (!user?.id)
            return false;
        const uid = user.id;
        return projectPartnersWithAccess.some((p) => p.authUserId === uid);
    }, [user?.id, projectPartnersWithAccess]);
    const canOverrideWeeklyLock = canOverrideReportPreviewWeeklyLock(user) || isProjectPartnerForPreview;
    const flushPersistTimeEntry = useCallback(async (rowKey) => {
        if (timeEntryPersistSkipRowKeysRef.current.has(rowKey))
            return;
        const row = timeExcelRowsRef.current.find((r) => r.rowKey === rowKey);
        if (!row || row.rowKind !== 'entry' || !row.timeEntryId?.trim()) {
            return;
        }
        if (row.isVoided)
            return;
        const entryId = row.timeEntryId.trim();
        if (deletedTimeEntryIdsRef.current.has(entryId))
            return;
        setTimeEntrySaveUI('saving');
        setTimeEntrySaveMessage(null);
        try {
            const serverOwner = serverAuthUserIdForTimeEntry(timeEntryServerOwnerByEntryIdRef.current, entryId, row.authUserId);
            const { row: savedRow, serverAuthUserId } = await persistTimeExcelPreviewRow(row, serverOwner);
            if (timeEntryPersistSkipRowKeysRef.current.has(rowKey))
                return;
            if (!timeExcelRowsRef.current.some((r) => r.rowKey === rowKey))
                return;
            if (serverAuthUserId !== serverOwner) {
                timeEntryServerOwnerByEntryIdRef.current.delete(entryId);
                registerTimeEntryServerOwner(timeEntryServerOwnerByEntryIdRef.current, savedRow.timeEntryId, serverAuthUserId);
            }
            setTimeExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? savedRow : r)));
            const snapshotId = xferSnapshot?.partnerConfirmationSnapshotId?.trim() ?? '';
            const snapRowId = snapshotRowIdByPreviewKey[rowKey];
            if (snapshotId && snapRowId) {
                try {
                    await patchReportSnapshotRow(snapshotId, snapRowId, {
                        workDate: savedRow.workDate,
                        recordedAt: savedRow.recordedAt,
                        clientName: savedRow.clientName,
                        projectName: savedRow.projectName,
                        taskName: savedRow.taskName,
                        note: savedRow.note,
                        description: savedRow.description,
                        hours: savedRow.hours,
                        isBillable: savedRow.isBillable,
                        taskBillableByDefault: savedRow.taskBillableByDefault,
                        employeeName: savedRow.employeeName,
                        employeeInitials: savedRow.employeeInitials,
                        employeePosition: savedRow.employeePosition,
                        billableRate: savedRow.billableRate,
                        amountToPay: savedRow.amountToPay,
                        costRate: savedRow.costRate,
                        costAmount: savedRow.costAmount,
                        currency: savedRow.currency,
                        externalReferenceUrl: savedRow.externalReferenceUrl,
                    });
                }
                catch {
                    /* live entry already saved — snapshot stub may lack this row */
                }
            }
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage(serverAuthUserId !== serverOwner ? 'Запись перенесена другому сотруднику' : 'Запись сохранена');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись сохранена' || m === 'Запись перенесена другому сотруднику' ? null : m));
            }, 3200);
        }
        catch (e) {
            if (timeEntryPersistSkipRowKeysRef.current.has(rowKey))
                return;
            if (deletedTimeEntryIdsRef.current.has(entryId))
                return;
            if (!timeExcelRowsRef.current.some((r) => r.rowKey === rowKey))
                return;
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось сохранить запись';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
        }
    }, [snapshotRowIdByPreviewKey, xferSnapshot?.partnerConfirmationSnapshotId]);
    const schedulePersistTimeEntry = useCallback((rowKey) => {
        clearPendingSaveTimer(rowKey);
        timeEntrySaveTimers.current.set(rowKey, setTimeout(() => {
            timeEntrySaveTimers.current.delete(rowKey);
            void flushPersistTimeEntry(rowKey);
        }, 750));
    }, [clearPendingSaveTimer, flushPersistTimeEntry]);
    const flushAllPendingTimeEntrySaves = useCallback(async () => {
        const keys = [...timeEntrySaveTimers.current.keys()];
        for (const key of keys)
            clearPendingSaveTimer(key);
        if (keys.length === 0) {
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage('Все изменения уже сохранены');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Все изменения уже сохранены' ? null : m));
            }, 2200);
            return;
        }
        for (const key of keys)
            await flushPersistTimeEntry(key);
    }, [clearPendingSaveTimer, flushPersistTimeEntry]);
    const patchTimeExcel = useCallback((rowKey, patch) => {
        let asyncRateFetch = null;
        activeTimeRowKeyRef.current = rowKey;
        setTimeExcelRows((prev) => {
            const idx = prev.findIndex((r) => r.rowKey === rowKey);
            if (idx < 0)
                return prev;
            const row = prev[idx];
            pushPatchUndo(editHistoryRef.current, rowKey, row);
            bumpEditHistory();
            const merged = applyTimePreviewRowPatch(row, patch, prev);
            if (patch.authUserId != null && patch.authUserId > 0) {
                const profile = authUserExportProfilesById.get(patch.authUserId);
                merged.employeeInitials = resolveReportEmployeeInitials({
                    stored: profile?.initials,
                    displayName: merged.employeeName || merged.userName,
                });
                merged.employeePosition = resolveReportEmployeePosition({
                    entryPosition: merged.employeePosition,
                    userPosition: profile?.position,
                    userRole: profile?.role,
                });
            }
            if (previewRowNeedsAsyncBillableRateFetch(row, patch, merged)) {
                asyncRateFetch = {
                    authUserId: merged.authUserId,
                    projectId: merged.projectId,
                    currency: merged.currency,
                };
            }
            const next = prev.map((r, i) => (i === idx ? merged : r));
            timeExcelRowsRef.current = next;
            if (merged.rowKind === 'entry' && merged.timeEntryId?.trim() && !merged.isVoided) {
                const nextWd = (merged.workDate || '').trim().slice(0, 10);
                const blocked = Boolean(nextWd && isClosedReportingWeekEditingBlockedForSubject(merged.authUserId, nextWd, canOverrideWeeklyLock));
                if (!blocked || isDateTimeOnlyPreviewPatch(patch))
                    schedulePersistTimeEntry(rowKey);
            }
            return next;
        });
        if (asyncRateFetch) {
            const { authUserId, projectId, currency } = asyncRateFetch;
            void fetchBillableRateForPreviewRow(authUserId, projectId, currency).then((rate) => {
                if (rate == null || rate <= 0)
                    return;
                setTimeExcelRows((prev) => {
                    if (timeEntryPersistSkipRowKeysRef.current.has(rowKey))
                        return prev;
                    const row = prev.find((r) => r.rowKey === rowKey);
                    if (!row || row.authUserId !== authUserId)
                        return prev;
                    if (row.billableRate === rate)
                        return prev;
                    const nextRow = {
                        ...row,
                        billableRate: rate,
                        amountToPay: recomputeTimePreviewRowAmountToPay({ ...row, billableRate: rate }),
                    };
                    const next = prev.map((r) => (r.rowKey === rowKey ? nextRow : r));
                    timeExcelRowsRef.current = next;
                    schedulePersistTimeEntry(rowKey);
                    return next;
                });
            });
        }
    }, [schedulePersistTimeEntry, canOverrideWeeklyLock, authUserExportProfilesById, bumpEditHistory]);
    const handleDeleteTimeEntry = useCallback(async (rowKey) => {
        const fromConfirmedReport = Boolean(xferSnapshot?.partnerConfirmationSnapshotId?.trim());
        const confirmed = await showConfirm({
            title: fromConfirmedReport
                ? 'Удалить запись из подтверждённого отчёта?'
                : 'Удалить запись времени?',
            message: fromConfirmedReport
                ? 'Запись будет удалена из отчёта. Подтверждение партнёров не сбрасывается. Отмена после обновления с сервера недоступна.'
                : 'Сразу после удаления можно вернуть запись через «Отмена» или Ctrl/⌘+Z. После обновления с сервера отмена недоступна.',
            variant: 'danger',
            confirmLabel: 'Удалить',
        });
        if (!confirmed)
            return;
        const row = timeExcelRowsRef.current.find((r) => r.rowKey === rowKey);
        if (!row || row.rowKind !== 'entry' || !row.timeEntryId?.trim())
            return;
        if (row.isVoided) {
            await showAlert({
                message: 'Запись уже снята с учёта менеджером — удаление из таблицы недоступно.',
            });
            return;
        }
        const snapshot = structuredClone(row);
        timeEntryPersistSkipRowKeysRef.current.add(rowKey);
        const prevT = timeEntrySaveTimers.current.get(rowKey);
        if (prevT)
            clearTimeout(prevT);
        timeEntrySaveTimers.current.delete(rowKey);
        setTimeEntryActionPendingRowKey(rowKey);
        setTimeEntrySaveUI('saving');
        setTimeEntrySaveMessage(null);
        try {
            const entryId = row.timeEntryId.trim();
            const serverOwner = serverAuthUserIdForTimeEntry(timeEntryServerOwnerByEntryIdRef.current, entryId, row.authUserId);
            const afterDelete = await deleteTimeEntry(serverOwner, entryId);
            deletedTimeEntryIdsRef.current.add(entryId);
            timeEntryServerOwnerByEntryIdRef.current.delete(entryId);
            if (!fromConfirmedReport) {
                pushDeleteUndo(editHistoryRef.current, rowKey, snapshot);
                bumpEditHistory();
            }
            setTimeExcelRows((prev) => {
                const next = prev.filter((r) => r.rowKey !== rowKey);
                timeExcelRowsRef.current = next;
                return next;
            });
            if (fromConfirmedReport)
                notifyPartnerConfirmedReportsListInvalidate();
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage(afterDelete == null ? 'Запись удалена' : 'Запись снята с учёта');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись удалена' || m === 'Запись снята с учёта' ? null : m));
            }, 2800);
        }
        catch (e) {
            timeEntryPersistSkipRowKeysRef.current.delete(rowKey);
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось удалить запись';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
        }
        finally {
            timeEntryPersistSkipRowKeysRef.current.delete(rowKey);
            setTimeEntryActionPendingRowKey(null);
        }
    }, [bumpEditHistory, showAlert, showConfirm, xferSnapshot?.partnerConfirmationSnapshotId]);
    const handleMoveTimeEntryToProject = useCallback(async (rowKey, newProjectId) => {
        const row = timeExcelRowsRef.current.find((r) => r.rowKey === rowKey);
        if (!row || row.rowKind !== 'entry' || !row.timeEntryId?.trim())
            return;
        if (row.isVoided) {
            await showAlert({
                message: 'Запись снята с учёта — перенос на другой проект недоступен.',
            });
            return;
        }
        if (String(newProjectId).trim() === String(row.projectId ?? '').trim())
            return;
        const wd = (row.workDate || '').trim().slice(0, 10);
        if (wd && isClosedReportingWeekEditingBlockedForSubject(row.authUserId, wd, canOverrideWeeklyLock)) {
            await showAlert({
                message: 'Неделя по дате записи закрыта — перенос на другой проект недоступен.',
            });
            return;
        }
        const opt = projectItemsForSelect.find((p) => p.id === newProjectId);
        if (!opt) {
            await showAlert({
                message: 'Проект не найден в списке доступных. Обновите список проектов (шапка предпросмотра).',
            });
            return;
        }
        const prevT = timeEntrySaveTimers.current.get(rowKey);
        if (prevT)
            clearTimeout(prevT);
        timeEntrySaveTimers.current.delete(rowKey);
        setTimeEntryActionPendingRowKey(rowKey);
        setTimeEntrySaveUI('saving');
        setTimeEntrySaveMessage(null);
        try {
            const entryId = row.timeEntryId.trim();
            const serverOwner = serverAuthUserIdForTimeEntry(timeEntryServerOwnerByEntryIdRef.current, entryId, row.authUserId);
            let resolvedTask = null;
            if (opt.clientId && opt.id) {
                try {
                    resolvedTask = await resolveTaskForTargetProject({
                        clientId: opt.clientId,
                        projectId: opt.id,
                        sourceTaskId: String(row.taskId ?? ''),
                        sourceTaskName: String(row.taskName ?? ''),
                    });
                }
                catch {
                }
            }
            const updated = await patchTimeEntry(serverOwner, entryId, {
                projectId: newProjectId,
                taskId: resolvedTask ? taskIdForApi(resolvedTask.taskId) : taskIdForApi(String(row.taskId ?? '')),
            });
            const base = mergeTimeEntryResponseIntoRow(updated, {
                taskName: resolvedTask?.taskName ?? row.taskName,
            });
            const taskId = String(resolvedTask?.taskId ?? base.taskId ?? row.taskId ?? '').trim();
            const taskName = resolvedTask?.taskName ?? row.taskName;
            setTimeExcelRows((prev) => {
                const next = prev.map((r) => {
                    if (r.rowKey !== rowKey)
                        return r;
                    return {
                        ...r,
                        ...base,
                        projectId: opt.id,
                        projectName: opt.name,
                        clientId: opt.clientId,
                        clientName: opt.client,
                        taskId: taskId || r.taskId,
                        taskName: taskName || r.taskName,
                        currency: opt.currency || r.currency,
                    };
                });
                timeExcelRowsRef.current = next;
                return next;
            });
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage('Запись перенесена на другой проект');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись перенесена на другой проект' ? null : m));
            }, 3200);
        }
        catch (e) {
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось перенести запись';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
            throw e;
        }
        finally {
            setTimeEntryActionPendingRowKey(null);
        }
    }, [canOverrideWeeklyLock, projectItemsForSelect, showAlert]);
    const handleAddTimeEntry = useCallback(async () => {
        if (!user)
            return;
        const opt = addEntryProjectOption;
        if (!opt?.id.trim()) {
            await showAlert({
                message: 'Чтобы добавить запись, выберите конкретный проект или клиента, по которому в отчёте уже есть строка с проектом.',
            });
            return;
        }
        const wd = pickDefaultWorkDateInRange(rangeFrom, rangeTo);
        const now = new Date();
        const hm = `${pad2p(now.getHours())}:${pad2p(now.getMinutes())}`;
        const recordedAt = localYmdAndHmToIso(wd, hm);
        if (wd && isClosedReportingWeekEditingBlockedForSubject(user.id, wd, canOverrideWeeklyLock)) {
            await showAlert({
                message: 'Дата по умолчанию попадает в закрытый отчётный период. Смените период предпросмотра или обратитесь к администратору.',
            });
            return;
        }
        setTimeEntrySaveUI('saving');
        setTimeEntrySaveMessage(null);
        try {
            const template = buildTemplateForNewPreviewRow({
                user,
                opt,
                workDate: wd,
                recordedAt,
            });
            const body = timeExcelPreviewRowToCreateBody(template, {
                workDate: wd,
                recordedAt,
                durationSecondsOverride: 3600,
            });
            const tr = await createTimeEntry(user.id, body);
            const newRow = previewRowAfterCreate(template, tr, { recordedAt });
            registerTimeEntryServerOwner(timeEntryServerOwnerByEntryIdRef.current, tr.id, tr.auth_user_id);
            pushCreateUndo(editHistoryRef.current, newRow.rowKey, tr.id, tr.auth_user_id);
            bumpEditHistory();
            activeTimeRowKeyRef.current = newRow.rowKey;
            setTimeExcelRows((prev) => {
                const next = [...prev, newRow];
                timeExcelRowsRef.current = next;
                return next;
            });
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage('Запись создана');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись создана' ? null : m));
            }, 3200);
        }
        catch (e) {
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось создать запись';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
        }
    }, [user, addEntryProjectOption, rangeFrom, rangeTo, canOverrideWeeklyLock, showAlert, bumpEditHistory]);
    const handleDuplicateTimeEntry = useCallback(async (rowKey, workDateYmd, recordedAtIso) => {
        const row = timeExcelRowsRef.current.find((r) => r.rowKey === rowKey);
        if (!row || row.rowKind !== 'entry' || !row.timeEntryId?.trim())
            return;
        if (row.isVoided) {
            await showAlert({
                message: 'Нельзя дублировать запись, снятую с учёта.',
            });
            return;
        }
        const wd = workDateYmd.slice(0, 10);
        const min = rangeFrom.slice(0, 10);
        const max = rangeTo.slice(0, 10);
        if (wd < min || wd > max) {
            await showAlert({
                message: `Дата работы должна быть в пределах периода предпросмотра (${min} — ${max}).`,
            });
            return;
        }
        if (wd && isClosedReportingWeekEditingBlockedForSubject(row.authUserId, wd, canOverrideWeeklyLock)) {
            await showAlert({
                message: 'Неделя по выбранной дате закрыта — выберите дату в открытом периоде.',
            });
            return;
        }
        setTimeEntryActionPendingRowKey(rowKey);
        setTimeEntrySaveUI('saving');
        setTimeEntrySaveMessage(null);
        try {
            const body = timeExcelPreviewRowToCreateBody(row, { workDate: wd, recordedAt: recordedAtIso });
            const tr = await createTimeEntry(row.authUserId, body);
            registerTimeEntryServerOwner(timeEntryServerOwnerByEntryIdRef.current, tr.id, tr.auth_user_id);
            const newRow = previewRowAfterCreate(row, tr, { recordedAt: recordedAtIso });
            pushCreateUndo(editHistoryRef.current, newRow.rowKey, tr.id, tr.auth_user_id);
            bumpEditHistory();
            activeTimeRowKeyRef.current = newRow.rowKey;
            setTimeExcelRows((prev) => {
                const next = [...prev, { ...newRow, isSessionCopy: true }];
                timeExcelRowsRef.current = next;
                return next;
            });
            flashRestoredRow(newRow.rowKey);
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage('Запись продублирована');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись продублирована' ? null : m));
            }, 3200);
        }
        catch (e) {
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось создать копию записи';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
        }
        finally {
            setTimeEntryActionPendingRowKey(null);
        }
    }, [canOverrideWeeklyLock, flashRestoredRow, rangeFrom, rangeTo, showAlert, bumpEditHistory]);
    const undoLastTimeEdit = useCallback(async () => {
        if (undoBusyRef.current)
            return;
        const entry = popUndo(editHistoryRef.current);
        bumpEditHistory();
        if (!entry)
            return;
        undoBusyRef.current = true;
        try {
            if (entry.kind === 'patch') {
                clearPendingSaveTimer(entry.rowKey);
                const restored = structuredClone(entry.before);
                setTimeExcelRows((prev) => {
                    const next = prev.map((r) => (r.rowKey === entry.rowKey ? restored : r));
                    timeExcelRowsRef.current = next;
                    return next;
                });
                activeTimeRowKeyRef.current = entry.rowKey;
                flashRestoredRow(entry.rowKey);
                if (restored.rowKind === 'entry' && restored.timeEntryId?.trim() && !restored.isVoided)
                    schedulePersistTimeEntry(entry.rowKey);
                setTimeEntrySaveUI('saved');
                setTimeEntrySaveMessage('Изменение отменено');
                setTimeout(() => {
                    setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                    setTimeEntrySaveMessage((m) => (m === 'Изменение отменено' ? null : m));
                }, 2200);
                return;
            }
            if (entry.kind === 'delete') {
                const snapshot = structuredClone(entry.snapshot);
                const wd = (snapshot.workDate || '').trim().slice(0, 10);
                if (!wd) {
                    pushDeleteUndo(editHistoryRef.current, entry.rowKey, snapshot);
                    bumpEditHistory();
                    setTimeEntrySaveUI('err');
                    setTimeEntrySaveMessage('Не удалось вернуть запись: нет даты работы');
                    return;
                }
                if (isClosedReportingWeekEditingBlockedForSubject(snapshot.authUserId, wd, canOverrideWeeklyLock)) {
                    pushDeleteUndo(editHistoryRef.current, entry.rowKey, snapshot);
                    bumpEditHistory();
                    setTimeEntrySaveUI('err');
                    setTimeEntrySaveMessage('Нельзя вернуть запись: дата в закрытом отчётном периоде');
                    return;
                }
                setTimeEntrySaveUI('saving');
                setTimeEntrySaveMessage(null);
                try {
                    const body = timeExcelPreviewRowToCreateBody(snapshot, {
                        workDate: wd,
                        recordedAt: snapshot.recordedAt?.trim() || null,
                    });
                    const tr = await createTimeEntry(snapshot.authUserId, body);
                    const newRow = previewRowAfterCreate(snapshot, tr, {
                        recordedAt: snapshot.recordedAt?.trim() || null,
                    });
                    registerTimeEntryServerOwner(timeEntryServerOwnerByEntryIdRef.current, tr.id, tr.auth_user_id);
                    pushCreateUndo(editHistoryRef.current, newRow.rowKey, tr.id, tr.auth_user_id);
                    bumpEditHistory();
                    activeTimeRowKeyRef.current = newRow.rowKey;
                    setTimeExcelRows((prev) => {
                        const next = [...prev, newRow];
                        timeExcelRowsRef.current = next;
                        return next;
                    });
                    flashRestoredRow(newRow.rowKey);
                    setTimeEntrySaveUI('saved');
                    setTimeEntrySaveMessage('Удаление отменено — запись возвращена');
                    setTimeout(() => {
                        setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                        setTimeEntrySaveMessage((m) => (m === 'Удаление отменено — запись возвращена' ? null : m));
                    }, 2800);
                }
                catch (e) {
                    pushDeleteUndo(editHistoryRef.current, entry.rowKey, snapshot);
                    bumpEditHistory();
                    const msg = isTimeTrackingHttpError(e)
                        ? e.message
                        : e instanceof Error
                            ? e.message
                            : 'Не удалось вернуть удалённую запись';
                    setTimeEntrySaveUI('err');
                    setTimeEntrySaveMessage(msg);
                }
                return;
            }
            clearPendingSaveTimer(entry.rowKey);
            timeEntryPersistSkipRowKeysRef.current.add(entry.rowKey);
            setTimeEntrySaveUI('saving');
            setTimeEntrySaveMessage(null);
            try {
                await deleteTimeEntry(entry.authUserId, entry.timeEntryId);
                deletedTimeEntryIdsRef.current.add(entry.timeEntryId);
                timeEntryServerOwnerByEntryIdRef.current.delete(entry.timeEntryId);
                setTimeExcelRows((prev) => {
                    const next = prev.filter((r) => r.rowKey !== entry.rowKey);
                    timeExcelRowsRef.current = next;
                    return next;
                });
                setTimeEntrySaveUI('saved');
                setTimeEntrySaveMessage('Создание записи отменено');
                setTimeout(() => {
                    setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                    setTimeEntrySaveMessage((m) => (m === 'Создание записи отменено' ? null : m));
                }, 2200);
            }
            catch (e) {
                pushCreateUndo(editHistoryRef.current, entry.rowKey, entry.timeEntryId, entry.authUserId);
                bumpEditHistory();
                const msg = isTimeTrackingHttpError(e)
                    ? e.message
                    : e instanceof Error
                        ? e.message
                        : 'Не удалось отменить создание записи';
                setTimeEntrySaveUI('err');
                setTimeEntrySaveMessage(msg);
            }
            finally {
                timeEntryPersistSkipRowKeysRef.current.delete(entry.rowKey);
            }
        }
        finally {
            undoBusyRef.current = false;
        }
    }, [bumpEditHistory, canOverrideWeeklyLock, clearPendingSaveTimer, flashRestoredRow, schedulePersistTimeEntry]);
    const requestHotkeyDuplicate = useCallback(() => {
        const key = activeTimeRowKeyRef.current;
        if (!key)
            return;
        const row = timeExcelRowsRef.current.find((r) => r.rowKey === key);
        if (!row || row.rowKind !== 'entry' || !row.timeEntryId?.trim() || row.isVoided)
            return;
        setHotkeyDuplicateRowKey(key);
    }, []);
    useEffect(() => {
        const onKeyDown = (e) => {
            const readOnlyPreview = Boolean(xferSnapshot?.partnerConfirmationSnapshotId?.trim());
            if (readOnlyPreview)
                return;
            if (xferSnapshot?.reportType !== 'time')
                return;
            const action = resolveReportPreviewHotkey(e);
            if (!action)
                return;
            e.preventDefault();
            e.stopPropagation();
            if (action === 'undo') {
                void undoLastTimeEdit();
                return;
            }
            if (action === 'save') {
                void flushAllPendingTimeEntrySaves();
                return;
            }
            if (action === 'duplicate')
                requestHotkeyDuplicate();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [
        flushAllPendingTimeEntrySaves,
        requestHotkeyDuplicate,
        undoLastTimeEdit,
        xferSnapshot?.partnerConfirmationSnapshotId,
        xferSnapshot?.reportType,
    ]);
    void editHistoryVersion;
    const canUndoTimeEdit = editHistoryCanUndo(editHistoryRef.current);
    const setActiveTimeRowKey = useCallback((rowKey) => {
        activeTimeRowKeyRef.current = rowKey;
    }, []);
    const clearHotkeyDuplicateRowKey = useCallback(() => {
        setHotkeyDuplicateRowKey(null);
    }, []);
    const patchExpenseExcel = useCallback((rowKey, patch) => {
        setExpenseExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
    }, []);
    const patchUninvoicedExcel = useCallback((rowKey, patch) => {
        setUninvoicedExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
    }, []);
    const patchBudgetExcel = useCallback((rowKey, patch) => {
        setBudgetExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
    }, []);
    const persistScopeColorToSelection = useCallback(async (rowKeys, color) => {
        const picked = normalizeScopeHexColor(color);
        const keys = [...rowKeys];
        if (keys.length === 0)
            return;
        setScopeColorValue(picked);
        setRowScopeColorsByKey((prev) => {
            const next = { ...prev };
            for (const key of keys)
                next[key] = picked;
            return next;
        });
        setTimeExcelRows((prev) => prev.map((r) => (keys.includes(r.rowKey) ? { ...r, scopeColor: picked } : r)));
        const targets = keys
            .map((rowKey) => timeExcelRowsRef.current.find((r) => r.rowKey === rowKey))
            .filter((r) => Boolean(r?.timeEntryId?.trim() && r.rowKind === 'entry' && !r.isVoided));
        if (targets.length === 0) {
            showToast({ message: 'Цвет применён локально (нет id записи для сохранения)', variant: 'error' });
            return;
        }
        setScopeColorBusy(true);
        try {
            await Promise.all(targets.map(async (row) => {
                const entryId = row.timeEntryId.trim();
                const owner = serverAuthUserIdForTimeEntry(timeEntryServerOwnerByEntryIdRef.current, entryId, row.authUserId);
                await patchTimeEntry(owner, entryId, { scopeColor: picked });
                const snapshotId = xferSnapshot?.partnerConfirmationSnapshotId?.trim() ?? '';
                const rowId = snapshotRowIdByPreviewKey[row.rowKey];
                if (snapshotId && rowId) {
                    try {
                        await patchReportSnapshotRow(snapshotId, rowId, { scopeColor: picked });
                    }
                    catch {
                        /* snapshot stub may lack entry rows — time entry is source of truth */
                    }
                }
            }));
            showToast({ message: 'Цвет строк сохранён', variant: 'success' });
        }
        catch (e) {
            showToast({ message: e instanceof Error ? e.message : 'Не удалось сохранить цвет строк', variant: 'error' });
        }
        finally {
            setScopeColorBusy(false);
        }
    }, [xferSnapshot?.partnerConfirmationSnapshotId, snapshotRowIdByPreviewKey]);
    const requestApplyScopeColorToSelection = useCallback(async (rowKeys, color) => {
        const projectId = selectedProjectId.trim();
        if (!projectId) {
            showToast({ message: 'Выберите проект, чтобы использовать Scope', variant: 'error' });
            return;
        }
        if (scopeDefinitionsLoading) {
            showToast({ message: 'Описания Scope ещё загружаются', variant: 'error' });
            return;
        }
        const picked = normalizeScopeHexColor(color);
        const existingDefinition = scopeDefinitions.find((definition) => definition.color === picked);
        if (existingDefinition) {
            await persistScopeColorToSelection(rowKeys, picked);
            return;
        }
        setScopeColorValue(picked);
        setScopeDescriptionEditor({
            color: picked,
            description: '',
            pendingRowKeys: new Set(rowKeys),
            firstUse: true,
        });
    }, [persistScopeColorToSelection, scopeDefinitions, scopeDefinitionsLoading, selectedProjectId]);
    const editScopeDefinition = useCallback((definition) => {
        setScopeDescriptionEditor({
            color: definition.color,
            description: definition.description,
            pendingRowKeys: null,
            firstUse: false,
        });
    }, []);
    const closeScopeDescriptionEditor = useCallback(() => {
        if (!scopeDescriptionSaving)
            setScopeDescriptionEditor(null);
    }, [scopeDescriptionSaving]);
    const saveScopeDescription = useCallback(async (description) => {
        const editor = scopeDescriptionEditor;
        const projectId = selectedProjectId.trim();
        if (!editor || !projectId)
            return;
        setScopeDescriptionSaving(true);
        try {
            const saved = await upsertProjectScopeDefinition(projectId, editor.color, description);
            setScopeDefinitions((previous) => {
                const next = previous.filter((definition) => definition.color !== saved.color);
                next.push(saved);
                return next.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
            });
            if (editor.pendingRowKeys)
                await persistScopeColorToSelection(editor.pendingRowKeys, editor.color);
            setScopeDescriptionEditor(null);
            showToast({
                message: editor.firstUse ? 'Описание Scope сохранено' : 'Описание Scope обновлено',
                variant: 'success',
            });
        }
        catch (error) {
            showToast({
                message: error instanceof Error ? error.message : 'Не удалось сохранить описание Scope',
                variant: 'error',
            });
        }
        finally {
            setScopeDescriptionSaving(false);
        }
    }, [persistScopeColorToSelection, scopeDescriptionEditor, selectedProjectId]);
    const clearScopeColorFromSelection = useCallback(async (rowKeys) => {
        const keys = [...rowKeys];
        if (keys.length === 0)
            return;
        setRowScopeColorsByKey((prev) => {
            const next = { ...prev };
            for (const key of keys)
                delete next[key];
            return next;
        });
        setTimeExcelRows((prev) => prev.map((r) => (keys.includes(r.rowKey) ? { ...r, scopeColor: '' } : r)));
        const targets = keys
            .map((rowKey) => timeExcelRowsRef.current.find((r) => r.rowKey === rowKey))
            .filter((r) => Boolean(r?.timeEntryId?.trim() && r.rowKind === 'entry' && !r.isVoided));
        if (targets.length === 0)
            return;
        setScopeColorBusy(true);
        try {
            await Promise.all(targets.map(async (row) => {
                const entryId = row.timeEntryId.trim();
                const owner = serverAuthUserIdForTimeEntry(timeEntryServerOwnerByEntryIdRef.current, entryId, row.authUserId);
                await patchTimeEntry(owner, entryId, { scopeColor: null });
                const snapshotId = xferSnapshot?.partnerConfirmationSnapshotId?.trim() ?? '';
                const rowId = snapshotRowIdByPreviewKey[row.rowKey];
                if (snapshotId && rowId) {
                    try {
                        await patchReportSnapshotRow(snapshotId, rowId, { scopeColor: null });
                    }
                    catch {
                        /* ignore stub snapshot */
                    }
                }
            }));
            showToast({ message: 'Цвет строк очищен', variant: 'success' });
        }
        catch (e) {
            showToast({ message: e instanceof Error ? e.message : 'Не удалось очистить цвет строк', variant: 'error' });
        }
        finally {
            setScopeColorBusy(false);
        }
    }, [xferSnapshot?.partnerConfirmationSnapshotId, snapshotRowIdByPreviewKey]);
    const archivedAuthUserIds = useMemo(() => buildArchivedAuthUserIds(ttUsersCatalog), [ttUsersCatalog]);
    const archivedEmployeeNames = useMemo(() => buildArchivedEmployeeNames(ttUsersCatalog), [ttUsersCatalog]);
    const timeUniqueNames = useMemo(() => {
        const rowNames = uniqueSortedEmployeeNames(timeExcelRows.filter((r) => isActiveReportPreviewEmployee(r.authUserId, archivedAuthUserIds)));
        const memberNames = projectMembersForEmployeePick.map((m) => m.displayName);
        return mergeUniqueSortedEmployeeNames(rowNames, memberNames);
    }, [timeExcelRows, projectMembersForEmployeePick, archivedAuthUserIds]);
    const expenseUniqueNames = useMemo(() => filterActiveEmployeeNames(uniqueSortedEmployeeNames(expenseExcelRows), archivedEmployeeNames), [expenseExcelRows, archivedEmployeeNames]);
    const uninvoicedUniqueNames = useMemo(() => filterActiveEmployeeNames(uniqueSortedEmployeeNames(uninvoicedExcelRows), archivedEmployeeNames), [uninvoicedExcelRows, archivedEmployeeNames]);
    const budgetUniqueNames = useMemo(() => filterActiveEmployeeNames(uniqueSortedEmployeeNames(budgetExcelRows), archivedEmployeeNames), [budgetExcelRows, archivedEmployeeNames]);
    const timeDisplayRows = useMemo(() => {
        return timeExcelRows
            .filter((r) => !employeeExcluded.has(r.userName))
            .map((r) => ({
            ...r,
            scopeColor: rowScopeColorsByKey[r.rowKey] ?? r.scopeColor ?? '',
        }));
    }, [timeExcelRows, employeeExcluded, rowScopeColorsByKey]);
    const timeEmployeePartnerPick = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || xferSnapshot.groupBy !== 'projects')
            return null;
        if (!selectedProjectId.trim())
            return null;
        return {
            loading: projectMembersPickLoading,
            members: mergeProjectMembersWithPartnerTeam({
                members: projectMembersForEmployeePick,
                teamFilterEnabled,
                partnerAuthUserId: teamFilterPartnerId,
                teamId: teamFilterTeamId,
                teams: teamsCatalog,
                catalog: ttUsersCatalog,
            }),
        };
    }, [xferSnapshot, selectedProjectId, projectMembersPickLoading, projectMembersForEmployeePick, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teamsCatalog, ttUsersCatalog]);
    const expenseDisplayRows = useMemo(() => {
        const base = expenseExcelRows.filter((r) => !employeeExcluded.has(r.userName));
        return sortRowsByUserName(base, employeeSortAsc);
    }, [expenseExcelRows, employeeExcluded, employeeSortAsc]);
    const uninvoicedDisplayRows = useMemo(() => {
        const base = uninvoicedExcelRows.filter((r) => !employeeExcluded.has(r.userName));
        return sortRowsByUserName(base, employeeSortAsc);
    }, [uninvoicedExcelRows, employeeExcluded, employeeSortAsc]);
    const budgetDisplayRows = useMemo(() => {
        const base = budgetExcelRows.filter((r) => !employeeExcluded.has(r.userName));
        return sortRowsByUserName(base, employeeSortAsc);
    }, [budgetExcelRows, employeeExcluded, employeeSortAsc]);
    const timeExcelFilterSlot = useMemo(() => (_jsx(ReportPreviewEmployeeExcelFilter, { uniqueNames: timeUniqueNames, excludedNames: employeeExcluded, onExcludedChange: setEmployeeExcluded, sortAsc: employeeSortAsc, onSortAscChange: setEmployeeSortAsc, tableNameSearch: { value: timeBriefEmployeeSearch, onChange: setTimeBriefEmployeeSearch } })), [timeUniqueNames, employeeExcluded, employeeSortAsc, timeBriefEmployeeSearch]);
    const expenseExcelFilterSlot = useMemo(() => (_jsx(ReportPreviewEmployeeExcelFilter, { uniqueNames: expenseUniqueNames, excludedNames: employeeExcluded, onExcludedChange: setEmployeeExcluded, sortAsc: employeeSortAsc, onSortAscChange: setEmployeeSortAsc })), [expenseUniqueNames, employeeExcluded, employeeSortAsc]);
    const uninvoicedExcelFilterSlot = useMemo(() => (_jsx(ReportPreviewEmployeeExcelFilter, { uniqueNames: uninvoicedUniqueNames, excludedNames: employeeExcluded, onExcludedChange: setEmployeeExcluded, sortAsc: employeeSortAsc, onSortAscChange: setEmployeeSortAsc })), [uninvoicedUniqueNames, employeeExcluded, employeeSortAsc]);
    const budgetExcelFilterSlot = useMemo(() => (_jsx(ReportPreviewEmployeeExcelFilter, { uniqueNames: budgetUniqueNames, excludedNames: employeeExcluded, onExcludedChange: setEmployeeExcluded, sortAsc: employeeSortAsc, onSortAscChange: setEmployeeSortAsc })), [budgetUniqueNames, employeeExcluded, employeeSortAsc]);
    const handleDownloadTimeExcel = useCallback(async (visiblePageRows) => {
        if (timeExcelDownloadBusy)
            return;
        setTimeExcelDownloadBusy(true);
        try {
            const rowsForExport = applyAuthUserExportProfilesToTimePreviewRows(visiblePageRows, authUserExportProfilesById);
            const exportCurrency = rowsForExport.find((r) => r.currency.trim())?.currency.trim() || 'USD';
            const timeGroupBy = xferSnapshot?.reportType === 'time' ? xferSnapshot.groupBy : undefined;
            const selectedProject = projectItemsForSelect.find((p) => p.id === selectedProjectId);
            const { blob, filename } = await buildReportPreviewPartnerExcel(timePreviewTableTitle, rowsForExport, {
                projectId: selectedProjectId,
                currency: exportCurrency,
                profilesByAuthUserId: authUserExportProfilesById,
                projectMembers: projectMembersForEmployeePick,
                clientName: selectedProject?.client
                    || rowsForExport.find((r) => r.clientName.trim())?.clientName
                    || (timeGroupBy === 'clients' ? timePreviewTableTitle.replace(/^Клиент:\s*/, '') : ''),
                projectName: selectedProject?.name
                    || rowsForExport.find((r) => r.projectName.trim())?.projectName
                    || (timeGroupBy === 'projects' ? timePreviewTableTitle : 'Все проекты'),
                dateFrom: rangeFrom,
                dateTo: rangeTo,
            });
            downloadBlob(blob, filename);
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось сформировать Excel.',
            });
        }
        finally {
            setTimeExcelDownloadBusy(false);
        }
    }, [timePreviewTableTitle, timeExcelDownloadBusy, showAlert, authUserExportProfilesById, selectedProjectId, projectMembersForEmployeePick, projectItemsForSelect, rangeFrom, rangeTo, xferSnapshot]);
    const requestTogglePartnerConfirmedEdit = useCallback(async () => {
        if (partnerConfirmedEditing) {
            await flushAllPendingTimeEntrySaves();
            setPartnerConfirmedEditing(false);
            return;
        }
        const ok = await showConfirm({
            title: 'Редактировать подтверждённый отчёт?',
            message: 'Отчёт уже подписан партнёрами. Правки сохранятся в записях времени и в снимке этого отчёта.',
            confirmLabel: 'Редактировать',
        });
        if (ok)
            setPartnerConfirmedEditing(true);
    }, [flushAllPendingTimeEntrySaves, partnerConfirmedEditing, showConfirm]);
    const liveTitle = xferSnapshot ? previewLiveTitle(xferSnapshot) : '';
    const partnerConfirmedLocked = Boolean(xferSnapshot?.partnerConfirmationSnapshotId?.trim());
    const partnerConfirmedReadOnly = partnerConfirmedLocked && !partnerConfirmedEditing;
    const forReviewPreviewLocked = Boolean(xferSnapshot?.forReviewPreview) || Boolean(xferSnapshot?.returnTo?.includes('reportsSection=for-review'));
    const hidePeriodControls = partnerConfirmedLocked || forReviewPreviewLocked;
    const confirmationProjectId = useMemo(() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo)
            return '';
        return reportPreviewConfirmationProjectId(xferSnapshot, selectedProjectId);
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId]);
    const partnerBarSharedPartners = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || xferSnapshot.groupBy !== 'projects')
            return undefined;
        const pid = confirmationProjectId.trim();
        if (!pid || pid !== selectedProjectId.trim())
            return undefined;
        return projectPartnersWithAccess;
    }, [xferSnapshot, confirmationProjectId, selectedProjectId, projectPartnersWithAccess]);
    const partnerConfirmNavbarSlot = confirmationProjectId && !partnerConfirmedLocked
        ? (_jsx(ReportPreviewPartnerBar, { projectId: confirmationProjectId, dateFrom: rangeFrom, dateTo: rangeTo, userId: user?.id ?? null, sharedPartners: partnerBarSharedPartners, sharedPartnersLoading: partnerBarSharedPartners != null ? projectMembersPickLoading : undefined, returnTo: xferSnapshot?.returnTo }))
        : null;
    const userCanSignPartnerReport = Boolean(user
        && confirmationProjectId
        && !partnerConfirmedLocked
        && (viewerIsPartner
            || projectPartnersWithAccess.some((p) => p.authUserId === user.id)));
    const partnerSignFooterExtras = userCanSignPartnerReport
        ? (_jsx(ReportPreviewPartnerSignFooter, { projectId: confirmationProjectId, dateFrom: rangeFrom, dateTo: rangeTo, userId: user?.id ?? null, returnTo: xferSnapshot?.returnTo }))
        : null;
    const managerSubmitNavbarSlot = confirmationProjectId && !partnerConfirmedLocked && hasFullTimeTrackingTabs(user)
        ? (_jsx(ReportPreviewManagerSubmitBar, { projectId: confirmationProjectId, dateFrom: rangeFrom, dateTo: rangeTo }))
        : null;
    const partnerConfirmedEditSlot = partnerConfirmedLocked
        ? (_jsx("button", { type: "button", className: `tt-reports__btn ${partnerConfirmedEditing ? 'tt-reports__btn--outline' : 'tt-reports__btn--accent'}`, onClick: () => void requestTogglePartnerConfirmedEdit(), title: partnerConfirmedEditing ? 'Вернуться к просмотру без редактирования ячеек' : 'Разрешить правку строк подтверждённого отчёта', "aria-pressed": partnerConfirmedEditing, children: partnerConfirmedEditing ? 'Готово' : 'Редактировать' }))
        : null;
    const navbarExtrasSlot = managerSubmitNavbarSlot || partnerConfirmNavbarSlot || partnerConfirmedEditSlot
        ? (_jsxs("div", { className: "tt-rp-preview__navbar-actions", children: [partnerConfirmedEditSlot, managerSubmitNavbarSlot, partnerConfirmNavbarSlot] }))
        : undefined;
    const reportHasTableData = Boolean(xferSnapshot && (xferSnapshot.reportType === 'time'
        ? timeExcelRows.length > 0
        : xferSnapshot.reportType === 'expenses'
            ? expenseExcelRows.length > 0
            : xferSnapshot.reportType === 'uninvoiced'
                ? uninvoicedExcelRows.length > 0
                : budgetExcelRows.length > 0));
    if (loading) {
        return (_jsxs("div", { className: "tt-rp-preview tt-rp-preview--fill", role: "status", "aria-live": "polite", children: [_jsx(ReportPreviewNavBar, {}), _jsx("div", { className: "tt-rp-preview__main tt-rp-preview__main--fill tt-rp-preview__body-pad", children: _jsx(ReportPreviewMockSkeleton, { variant: "generic", label: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430\u2026" }) })] }));
    }
    if (xferHydrated && !xferSnapshot) {
        return (_jsxs("div", { className: "tt-rp-preview", children: [_jsx(ReportPreviewNavBar, {}), _jsx("div", { className: "tt-rp-preview__main", children: _jsxs("div", { className: "tt-rp-preview__empty", children: [_jsx("p", { children: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B \u00AB\u041E\u0442\u0447\u0451\u0442\u044B\u00BB \u0432 \u0443\u0447\u0451\u0442\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u00BB, \u043B\u0438\u0431\u043E \u0441\u043F\u0438\u0441\u043E\u043A \u00AB\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u043C\u00BB \u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u00AB\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u00BB \u0443 \u0441\u0442\u0440\u043E\u043A\u0438 \u2014 \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F \u0432\u0438\u0434 \u043E\u0442\u0447\u0451\u0442\u0430, \u0440\u0430\u0437\u0440\u0435\u0437 \u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u044B." }), _jsx(Link, { className: "tt-rp-preview__btn tt-rp-preview__btn--accent", to: REPORTS_TAB_URL, children: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u043E\u0442\u0447\u0451\u0442\u0430\u043C" })] }) })] }));
    }
    const timeProjectSwitcherEnabled = xferSnapshot?.reportType === 'time' && Boolean(user) && xferSnapshot.groupBy === 'projects';
    const timeReportViewToggle = xferSnapshot?.reportType === 'time'
        ? (_jsxs("div", { className: "tt-rp-preview__view-toggle", role: "group", "aria-label": "\u0412\u0438\u0434 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0432\u0440\u0435\u043C\u0435\u043D\u0438", children: [_jsx("button", { type: "button", className: `tt-rp-preview__view-toggle-btn${timeReportViewMode === 'brief' ? ' tt-rp-preview__view-toggle-btn--active' : ''}`, "aria-pressed": timeReportViewMode === 'brief', onClick: () => setTimeReportViewMode('brief'), children: "\u041A\u0440\u0430\u0442\u043A\u0438\u0439" }), _jsx("button", { type: "button", className: `tt-rp-preview__view-toggle-btn${timeReportViewMode === 'full' ? ' tt-rp-preview__view-toggle-btn--active' : ''}`, "aria-pressed": timeReportViewMode === 'full', onClick: () => setTimeReportViewMode('full'), children: "\u041F\u043E\u043B\u043D\u044B\u0439" })] }))
        : null;
    const navProjectSlot = xferSnapshot?.reportType === 'time' && xferSnapshot.groupBy === 'clients' && Boolean(user)
        ? (_jsx("div", { className: "tt-rp-preview__navbar-project", title: "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0443 (\u043A\u0430\u043A \u043F\u0440\u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0438 \u0438\u0437 \u0441\u0442\u0440\u043E\u043A\u0438 \u043E\u0442\u0447\u0451\u0442\u0430).", children: _jsx("span", { className: "tt-rp-preview__navbar-hint tt-rp-preview__navbar-client-pill", "aria-live": "polite", children: timePreviewTableTitle }) }))
        : timeProjectSwitcherEnabled
            ? (projectsError
                ? (_jsx("span", { className: "tt-rp-preview__navbar-hint", title: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F", children: projectsError }))
                : (_jsx("div", { className: "tt-rp-preview__navbar-project", title: partnerConfirmedLocked ? 'Проект зафиксирован для этого просмотра' : 'Выбор проекта (фильтр сохраняется для возврата в отчёты).', children: _jsx(SearchableSelect, { portalDropdown: true, className: "tt-rp-preview__navbar-project-select", buttonClassName: "tt-rp-preview__navbar-project-btn", "aria-label": "\u041F\u0440\u043E\u0435\u043A\u0442", disabled: partnerConfirmedLocked || projectsLoading || projectItemsForSelect.length === 0, placeholder: projectsLoading ? 'Загрузка проектов…' : projectItemsForSelect.length === 0 ? 'Нет проектов' : 'Найдите или выберите проект…', emptyListText: projectsLoading ? 'Загрузка…' : 'Нет доступных проектов', noMatchText: "\u041F\u0440\u043E\u0435\u043A\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: selectedProjectId, items: projectItemsForSelect, getOptionValue: (p) => p.id, getOptionLabel: previewProjectOptionLabel, getSearchText: (p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim(), onSelect: (p) => onProjectPick(p.id) }) })))
            : undefined;
    const scopeDefinitionsSlot = selectedProjectId.trim()
        ? (_jsx(ReportPreviewScopeLegend, { definitions: scopeDefinitions, loading: scopeDefinitionsLoading, disabled: partnerConfirmedReadOnly || scopeDescriptionSaving, onEdit: editScopeDefinition }))
        : null;
    const mainBody = (() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo)
            return (_jsx("p", { className: "tt-rp-preview__muted tt-rp-preview__no-table-msg", children: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0435\u0440\u0438\u043E\u0434 (\u0434\u0430\u0442\u044B \u00AB\u0421\u00BB \u0438 \u00AB\u041F\u043E\u00BB)." }));
        if (reportLoading && !reportHasTableData)
            return (_jsx(ReportPreviewMockSkeleton, { variant: "generic", label: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0442\u0447\u0451\u0442\u0430\u2026" }));
        if (xferSnapshot.reportType === 'time') {
            if (timeExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            const showTimeLiveTitle = xferSnapshot.groupBy !== 'projects';
            return (_jsxs(_Fragment, { children: [showTimeLiveTitle ? (_jsx("p", { className: "tt-rp-preview__live-title tt-rp-preview__live-title--inline", children: liveTitle })) : null, _jsx(TimeExcelPreviewTable, { projectTitle: timePreviewTableTitle, viewMode: timeReportViewMode, readOnly: partnerConfirmedReadOnly, onUnlockEdit: partnerConfirmedLocked ? requestTogglePartnerConfirmedEdit : undefined, confirmedEditUnlocked: partnerConfirmedEditing, rows: timeDisplayRows, onPatch: patchTimeExcel, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: partnerConfirmedReadOnly ? undefined : setSelectedRowKeys, employeeColumnFilterSlot: partnerConfirmedReadOnly ? null : timeExcelFilterSlot, briefEmployeeQuery: timeBriefEmployeeSearch, onRequestServerReload: partnerConfirmedReadOnly ? undefined : requestServerDataReload, serverReloadBusy: reportLoading, timeSave: partnerConfirmedReadOnly ? undefined : { ui: timeEntrySaveUI, message: timeEntrySaveMessage }, canOverrideClosedWeek: canOverrideWeeklyLock, moveProjectOptions: partnerConfirmedReadOnly || !user ? undefined : projectItemsForSelect, onDeleteTimeEntry: user ? handleDeleteTimeEntry : undefined, onMoveTimeEntryToProject: partnerConfirmedReadOnly || !user ? undefined : handleMoveTimeEntryToProject, onDuplicateTimeEntry: partnerConfirmedReadOnly || !user ? undefined : handleDuplicateTimeEntry, onAddTimeEntry: partnerConfirmedReadOnly || !user ? undefined : handleAddTimeEntry, timeEntryWorkDateBounds: { min: rangeFrom.slice(0, 10), max: rangeTo.slice(0, 10) }, timeEntryActionPendingRowKey: timeEntryActionPendingRowKey, employeePartnerPick: partnerConfirmedReadOnly ? null : timeEmployeePartnerPick, onDownloadExcel: handleDownloadTimeExcel, downloadExcelBusy: timeExcelDownloadBusy, footerExtras: partnerSignFooterExtras, flashRowKey: partnerConfirmedReadOnly ? null : flashRestoredRowKey, hotkeyDuplicateRowKey: partnerConfirmedReadOnly ? null : hotkeyDuplicateRowKey, onHotkeyDuplicateConsumed: partnerConfirmedReadOnly ? undefined : clearHotkeyDuplicateRowKey, onActiveTimeRowKey: partnerConfirmedReadOnly ? undefined : setActiveTimeRowKey, canUndo: !partnerConfirmedReadOnly && canUndoTimeEdit, onUndo: partnerConfirmedReadOnly ? undefined : undoLastTimeEdit, onSaveNow: partnerConfirmedReadOnly ? undefined : flushAllPendingTimeEntrySaves, scopeDefinitionsSlot: scopeDefinitionsSlot, scopeColorValue: scopeColorValue, scopeColorBusy: scopeColorBusy || scopeDefinitionsLoading || scopeDescriptionSaving, onScopeColorValueChange: setScopeColorValue, onApplyScopeColorToSelection: requestApplyScopeColorToSelection, onClearScopeColorFromSelection: clearScopeColorFromSelection })] }));
        }
        if (xferSnapshot.reportType === 'expenses') {
            if (expenseExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-rp-preview__live-title tt-rp-preview__live-title--inline", children: liveTitle }), _jsx(ExpenseExcelPreviewTable, { rows: expenseDisplayRows, onPatch: patchExpenseExcel, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: setSelectedRowKeys, employeeColumnFilterSlot: expenseExcelFilterSlot, onRequestServerReload: requestServerDataReload, serverReloadBusy: reportLoading })] }));
        }
        if (xferSnapshot.reportType === 'uninvoiced') {
            if (uninvoicedExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-rp-preview__live-title tt-rp-preview__live-title--inline", children: liveTitle }), _jsx(UninvoicedExcelPreviewTable, { rows: uninvoicedDisplayRows, onPatch: patchUninvoicedExcel, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: setSelectedRowKeys, employeeColumnFilterSlot: uninvoicedExcelFilterSlot, onRequestServerReload: requestServerDataReload, serverReloadBusy: reportLoading })] }));
        }
        if (xferSnapshot.reportType === 'project-budget') {
            if (budgetExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (_jsxs(_Fragment, { children: [_jsx("p", { className: "tt-rp-preview__live-title tt-rp-preview__live-title--inline", children: liveTitle }), _jsx(BudgetExcelPreviewTable, { rows: budgetDisplayRows, onPatch: patchBudgetExcel, selectedRowKeys: selectedRowKeys, onSelectedRowKeysChange: setSelectedRowKeys, employeeColumnFilterSlot: budgetExcelFilterSlot, onRequestServerReload: requestServerDataReload, serverReloadBusy: reportLoading })] }));
        }
        return null;
    })();
    return (_jsxs("div", { className: "tt-rp-preview tt-rp-preview--fill", children: [_jsx(ReportPreviewNavBar, { projectSlot: navProjectSlot, timeReportViewSlot: timeReportViewToggle ?? undefined }), xferSnapshot && rangeFrom && rangeTo ? (_jsx(ReportPreviewFiltersBar, { periodTitle: periodTitle, periodGranularity: periodGranularity, onPeriodGranularityChange: onPreviewPeriodGranularityChange, onPrevPeriod: onPreviewPrevPeriod, onNextPeriod: onPreviewNextPeriod, users: usersForEmployeeFilter, usersError: usersForFilterError, selectedUserIds: selectedUserIds, onSelectedUserIdsChange: setSelectedUserIds, dateFrom: rangeFrom, dateTo: rangeTo, onDateFromChange: onPreviewFrom, onDateToChange: onPreviewTo, customRangeActive: customRangeActive, onResetCustomRange: onPreviewResetCustomRange, disabled: partnerConfirmedReadOnly, hidePeriodControls: hidePeriodControls, actionsSlot: navbarExtrasSlot, teamFilter: {
                    teams: teamsCatalog,
                    teamsLoading: teamsCatalogLoading,
                    teamsError: teamsCatalogError,
                    enabled: teamFilterEnabled,
                    onEnabledChange: handleTeamFilterEnabledChange,
                    partnerAuthUserId: teamFilterPartnerId,
                    onPartnerAuthUserIdChange: handleTeamFilterPartnerChange,
                    teamId: teamFilterTeamId,
                    onTeamIdChange: handleTeamFilterTeamChange,
                    canPickPartner: canPickTeamFilterPartner,
                } })) : null, _jsx("div", { className: "tt-rp-preview__main tt-rp-preview__main--fill tt-rp-preview__body-pad", children: _jsx("div", { className: `tt-rp-preview__live${xferSnapshot && (xferSnapshot.reportType === 'time' || xferSnapshot.reportType === 'expenses' || xferSnapshot.reportType === 'uninvoiced' || xferSnapshot.reportType === 'project-budget') ? ' tt-rp-preview__live--sheet' : ''}${reportLoading && reportHasTableData ? ' tt-rp-preview__live--busy' : ''}`, children: mainBody }) }), _jsx(ReportPreviewScopeDescriptionModal, { open: Boolean(scopeDescriptionEditor), color: scopeDescriptionEditor?.color ?? REPORT_PREVIEW_SCOPE_DEFAULT, initialDescription: scopeDescriptionEditor?.description ?? '', firstUse: scopeDescriptionEditor?.firstUse ?? false, saving: scopeDescriptionSaving, onCancel: closeScopeDescriptionEditor, onSave: saveScopeDescription })] }));
}
export default ReportPreviewPage;
