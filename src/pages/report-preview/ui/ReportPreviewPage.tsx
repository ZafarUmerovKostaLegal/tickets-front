import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, } from 'react';
import { createPortal } from 'react-dom';
import { ReportPreviewMockSkeleton } from './ReportPreviewMockSkeleton';
import { ReportPreviewEmployeeExcelFilter } from './ReportPreviewEmployeeExcelFilter';
import { ReportPreviewFiltersBar } from './ReportPreviewFiltersBar';
import {
    BudgetExcelPreviewTable,
    ExpenseExcelPreviewTable,
    TimeExcelPreviewTable,
    UninvoicedExcelPreviewTable,
} from './ReportPreviewExcelTables';
import { sortRowsByUserName, uniqueSortedEmployeeNames, mergeUniqueSortedEmployeeNames, } from '../lib/sortReportPreviewRows';
import { buildReportPreviewPartnerExcel, downloadBlob } from '../lib/reportPreviewPartnerExcel';
import { applyAuthUserExportProfilesToTimePreviewRows, buildAuthUserExportProfileLookup, mergeAuthUserExportProfileMaps, mergeAuthUserExportProfiles, type AuthUserExportProfile, } from '../lib/reportPreviewEmployeeInitials';
import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
import { resolveReportEmployeePosition } from '@entities/time-tracking/lib/reportEmployeePosition';
import { getUsers } from '@entities/user';
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import { routes } from '@shared/config';
import { isHiddenSystemUser } from '@shared/lib';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import {
    type ReportFiltersV2,
    fetchReportsMeta,
    fetchReportsUsersForFilter,
    type ReportsFilterUser,
    fetchAllTimeReportClientRows,
    fetchAllTimeReportProjectRows,
    fetchAllTimeReportTaskRows,
    fetchAllTimeReportTeamRows,
    fetchAllExpenseReportRows,
    fetchAllUninvoicedReportRows,
    fetchAllBudgetReportRows,
    isTimeTrackingHttpError,
    isClosedReportingWeekEditingBlockedForSubject,
    patchTimeEntry,
    createTimeEntry,
    deleteTimeEntry,
    canOverrideReportPreviewWeeklyLock,
    listPartnerUsersWithProjectAccessToProject,
    listUsersWithProjectAccessToProjectForPick,
    listTimeTrackingUsers,
    listPartnerReportConfirmationsPendingItems,
    listPartnerReportConfirmationsConfirmed,
    confirmPartnerReportConfirmation,
    submitPartnerReportConfirmationFromPreview,
    parsePartnerReportConfirmationRequest,
    type ProjectPartnerAccessRow,
    type PartnerReportConfirmationRequest,
    type TimeTrackingUserRow,
    type TimeTrackingTeamRow,
    listTimeTrackingTeams,
    notifyPartnerConfirmedReportsListInvalidate,
    invalidateReportApiCache,
} from '@entities/time-tracking';
import {
    buildArchivedAuthUserIds,
    buildArchivedEmployeeNames,
    filterActiveEmployeeNames,
    isActiveReportPreviewEmployee,
} from '../lib/reportPreviewActiveEmployees';
import { readReportPreviewTransfer, clearReportPreviewTransfer, normalizeReportPreviewTransfer, writeReportPreviewTransfer, resolveReportPreviewPeriodState, type ReportPreviewTransferV2, type ReportPreviewPeriodState, } from '@entities/time-tracking/model/reportPreviewTransfer';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '@entities/time-tracking/model/partnerConfirmedReports';
import { hasFullTimeTrackingTabs } from '@entities/time-tracking/model/timeTrackingAccess';
import { coerceGroupByForType, type ExpenseGroup, type TimeGroup, type PeriodGranularity, } from '@entities/time-tracking/model/reportsPanelConfig';
import { formatIsoRangeTitle, formatPeriodLabel, periodToDates, isoDateLocal, } from '@entities/time-tracking/lib/reportsPeriodRange';
import { useI18n } from '@shared/i18n';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { loadTimesheetProjectOptionsForMove, type ProjectOption, } from '@pages/time-tracking/ui/timesheetProjectLoader';
import { sortTimeReportRowsForDisplay } from '@entities/time-tracking/lib/timeReportRows';
import { deduplicateTimeExcelPreviewRows } from '../lib/reportPreviewDuplicateRows';
import {
    pickDefaultTeamId,
    resolveEffectiveReportPreviewUserIds,
    resolveTeamMemberUserIds,
} from '../lib/reportPreviewTeamFilter';
import {
    flattenTimeReportToExcelRows,
    flattenExpenseReportToExcelRows,
    flattenUninvoicedToExcelRows,
    flattenBudgetToExcelRows,
} from '../lib/reportPreviewApiToExcelRows';
import { mergeTimeEntryResponseIntoRow, persistTimeExcelPreviewRow, previewRowAfterCreate, registerTimeEntryServerOwner, resolveTaskForTargetProject, serverAuthUserIdForTimeEntry, syncTimeEntryServerOwnersFromRows, taskIdForApi, timeExcelPreviewRowToCreateBody, } from '../lib/reportPreviewTimeEntrySave';
import { applyTimePreviewRowPatch, fetchBillableRateForPreviewRow, previewRowNeedsAsyncBillableRateFetch, } from '../lib/reportPreviewRowPatch';
import { computeTimePreviewRowAmountToPay } from '../lib/reportPreviewPartnerExcel';
import { isDateTimeOnlyPreviewPatch, localYmdAndHmToIso, } from '../lib/briefRecordDateTimeEdit';
import {
    canUndo as editHistoryCanUndo,
    clearEditHistory,
    createReportPreviewEditHistory,
    popUndo,
    pushCreateUndo,
    pushDeleteUndo,
    pushPatchUndo,
} from '../lib/reportPreviewEditHistory';
import {
    resolveReportPreviewHotkey,
} from '../lib/reportPreviewHotkeys';
import type { TimeExcelPreviewRow, ExpenseExcelPreviewRow, UninvoicedExcelPreviewRow, BudgetExcelPreviewRow, } from '../lib/previewExcelTypes';
import { useCurrentUser } from '@shared/hooks';
import { AppPageSettings, useAppDialog } from '@shared/ui';
import '@pages/time-tracking/ui/TimePageShell.css';
import './ReportPreviewPage.css';
const REPORTS_TAB_URL = `${routes.timeTracking}?tab=reports`;

function leaveReportPreview(navigate: NavigateFunction, returnTo?: string | null): void {
    void clearReportPreviewTransfer();
    const target = (returnTo ?? '').trim() || REPORTS_TAB_URL;
    navigate(target, { replace: true });
}
function stripReportPagination(filters: ReportFiltersV2): ReportFiltersV2 {
    const { page: _pg, per_page: _pp, ...rest } = filters;
    return rest;
}
function previewProjectOptionLabel(p: ProjectOption): string {
    return p.client ? `${p.name} — ${p.client}` : p.name;
}
function projectNameFromExcelRows(projectId: string, rows: TimeExcelPreviewRow[]): string {
    const pid = projectId.trim();
    if (!pid)
        return '';
    const match = rows.find((r) => String(r.projectId ?? '').trim() === pid);
    return match?.projectName?.trim() || '';
}
function projectClientFromExcelRows(projectId: string, rows: TimeExcelPreviewRow[]): {
    clientName: string;
    clientId: string;
    currency: string;
} {
    const pid = projectId.trim();
    if (!pid)
        return { clientName: '', clientId: '', currency: 'USD' };
    const match = rows.find((r) => String(r.projectId ?? '').trim() === pid);
    return {
        clientName: match?.clientName?.trim() || '',
        clientId: String(match?.clientId ?? '').trim(),
        currency: match?.currency?.trim() || 'USD',
    };
}
function buildMissingProjectOption(projectId: string, rows: TimeExcelPreviewRow[]): ProjectOption {
    const fromRows = projectClientFromExcelRows(projectId, rows);
    const name = projectNameFromExcelRows(projectId, rows);
    return {
        id: projectId,
        name: name || 'Проект',
        client: fromRows.clientName,
        clientId: fromRows.clientId,
        color: 'hsl(220 14% 46%)',
        currency: fromRows.currency,
        recordsLanguage: 'ENG',
    };
}
function pad2p(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}
function pickDefaultWorkDateInRange(from: string, to: string): string {
    const f = from.slice(0, 10);
    const t = to.slice(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad2p(now.getMonth() + 1)}-${pad2p(now.getDate())}`;
    if (todayStr >= f && todayStr <= t)
        return todayStr;
    return t;
}
function buildTemplateForNewPreviewRow(params: {
    user: {
        id: number;
        display_name: string | null;
        email: string;
        position: string | null;
    };
    opt: ProjectOption;
    workDate: string;
    recordedAt: string;
}): TimeExcelPreviewRow {
    const name = params.user.display_name?.trim() || params.user.email;
    return {
        rowKey: 'new',
        timeEntryId: '',
        rowKind: 'entry',
        sourceEntryCount: 1,
        userName: name,
        employeeName: name,
        authUserId: params.user.id,
        employeeInitials: '',
        employeePosition: params.user.position ?? '',
        workDate: params.workDate,
        recordedAt: params.recordedAt,
        clientId: params.opt.clientId,
        clientName: params.opt.client,
        projectId: params.opt.id,
        projectName: params.opt.name,
        projectCode: '',
        taskId: '',
        taskName: '',
        note: '',
        description: '',
        hours: 1,
        billableHours: 1,
        isBillable: true,
        taskBillableByDefault: false,
        isInvoiced: false,
        isPaid: false,
        isWeekSubmitted: false,
        billableRate: 0,
        amountToPay: 0,
        costRate: 0,
        costAmount: 0,
        currency: params.opt.currency || 'USD',
        externalReferenceUrl: '',
        invoiceId: '',
        invoiceNumber: '',
        isVoided: false,
        voidKind: null,
    };
}
function buildApiFilters(xfer: ReportPreviewTransferV2, rangeFrom: string, rangeTo: string, selectedProjectId: string, selectedClientId: string, selectedUserIds: number[]): Omit<ReportFiltersV2, 'page' | 'per_page'> {
    const base = stripReportPagination(xfer.filters);
    const out: Omit<ReportFiltersV2, 'page' | 'per_page'> = { ...base, dateFrom: rangeFrom, dateTo: rangeTo };
    if (selectedUserIds.length > 0)
        out.user_id = selectedUserIds.join(',');
    else
        delete out.user_id;
    if (xfer.reportType === 'time') {
        if (xfer.groupBy === 'clients') {
            const cid = selectedClientId.trim();
            if (cid)
                out.client_id = cid;
            else
                delete out.client_id;
            delete out.project_id;
        }
        else {
            const pid = selectedProjectId.trim();
            if (pid)
                out.project_id = pid;
            else
                delete out.project_id;
            delete out.client_id;
        }
    }
    return out;
}
function parseUserIdsFromFilter(user_id: unknown): number[] {
    if (typeof user_id !== 'string' || !user_id.trim())
        return [];
    return user_id.split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}
function buildPreviewPeriodState(periodGranularity: PeriodGranularity, periodDate: Date, customRangeActive: boolean): ReportPreviewPeriodState {
    return {
        periodGranularity,
        periodAnchorIso: isoDateLocal(periodDate),
        customRangeActive,
    };
}
function periodStatesEqual(a?: ReportPreviewPeriodState | null, b?: ReportPreviewPeriodState | null): boolean {
    if (a == null && b == null)
        return true;
    if (a == null || b == null)
        return false;
    return a.periodGranularity === b.periodGranularity
        && a.periodAnchorIso === b.periodAnchorIso
        && a.customRangeActive === b.customRangeActive;
}
function buildReportPreviewSyncedFilters(
    xfer: ReportPreviewTransferV2,
    rangeFrom: string,
    rangeTo: string,
    selectedProjectId: string,
    selectedClientId: string,
    effectiveSelectedUserIds: number[],
    teamFilterEnabled: boolean,
    teamFilterPartnerId: number,
    teamFilterTeamId: string,
    reportPageSizeMax: number | null,
): ReportFiltersV2 {
    const filters: ReportFiltersV2 = {
        ...buildApiFilters(xfer, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds),
        pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
    };
    if (xfer.reportType !== 'time') {
        if (selectedProjectId)
            filters.project_id = selectedProjectId;
        else
            delete filters.project_id;
    }
    if (teamFilterEnabled) {
        filters.team_filter_enabled = true;
        if (teamFilterPartnerId > 0)
            filters.team_filter_partner_auth_user_id = teamFilterPartnerId;
        else
            delete filters.team_filter_partner_auth_user_id;
        if (teamFilterTeamId.trim())
            filters.team_id = teamFilterTeamId.trim();
        else
            delete filters.team_id;
    }
    else {
        delete filters.team_filter_enabled;
        delete filters.team_filter_partner_auth_user_id;
        delete filters.team_id;
    }
    return filters;
}
function reportPreviewXferFiltersInSync(
    prev: ReportPreviewTransferV2,
    nextFilters: ReportFiltersV2,
    listPerPage: number,
    nextPeriod: ReportPreviewPeriodState,
): boolean {
    const curStripped = stripReportPagination(prev.filters);
    const nextStripped = stripReportPagination(nextFilters);
    if (JSON.stringify(curStripped) !== JSON.stringify(nextStripped))
        return false;
    if ((prev.filters.page ?? 1) !== 1)
        return false;
    if ((prev.filters.per_page ?? listPerPage) !== listPerPage)
        return false;
    return periodStatesEqual(prev.period, nextPeriod);
}
function previewLiveTitle(xfer: ReportPreviewTransferV2): string {
    if (xfer.reportType === 'time') {
        const g = xfer.groupBy === 'clients' ? 'клиентам' : 'проектам';
        return `Время — по ${g}`;
    }
    if (xfer.reportType === 'expenses') {
        const gb = coerceGroupByForType('expenses', xfer.groupBy) as ExpenseGroup;
        const map: Record<ExpenseGroup, string> = {
            clients: 'клиентам',
            projects: 'проектам',
            categories: 'категориям',
            team: 'команде',
        };
        const base = xfer.filters.confirmed_payment_only === true ? 'Расходы (оплата подтверждена)' : 'Расходы';
        return `${base} — по ${map[gb]}`;
    }
    if (xfer.reportType === 'uninvoiced')
        return 'Не выставлено';
    return 'Бюджет проектов';
}
function reportPreviewEmptyBlock(rangeFrom: string, rangeTo: string) {
    return (<div className="tt-rp-preview__no-table-wrap">
        <p className="tt-rp-preview__period-line">{formatIsoRangeTitle(rangeFrom, rangeTo)}</p>
        <p className="tt-rp-preview__muted tt-rp-preview__no-table-msg">Нет данных за период и выбранные фильтры.</p>
    </div>);
}
function rpPartnerConfirmPeriodMatches(req: {
    dateFrom: string;
    dateTo: string;
}, from: string, to: string): boolean {
    return req.dateFrom === from.slice(0, 10) && req.dateTo === to.slice(0, 10);
}
function rpPartnerConfirmSessionKey(projectId: string, from: string, to: string): string {
    return `tt-partner-confirm:${projectId.trim()}:${from.slice(0, 10)}:${to.slice(0, 10)}`;
}
function rpLoadPartnerConfirmSession(projectId: string, from: string, to: string): PartnerReportConfirmationRequest | null {
    try {
        const raw = sessionStorage.getItem(rpPartnerConfirmSessionKey(projectId, from, to));
        if (!raw)
            return null;
        return parsePartnerReportConfirmationRequest(JSON.parse(raw));
    }
    catch {
        return null;
    }
}
function rpSavePartnerConfirmSession(projectId: string, from: string, to: string, req: PartnerReportConfirmationRequest): void {
    try {
        sessionStorage.setItem(rpPartnerConfirmSessionKey(projectId, from, to), JSON.stringify(req));
    }
    catch {

    }
}
function ReportPreviewManagerSubmitBar({ projectId, dateFrom, dateTo }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}) {
    const { showAlert, showConfirm } = useAppDialog();
    const { t } = useI18n();
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [submitBusy, setSubmitBusy] = useState(false);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const pid = projectId.trim();
    const reloadLists = useCallback(async () => {
        const [p, c] = await Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]);
        setPendingReqs(p);
        setConfirmedReqs(c);
    }, []);
    useEffect(() => {
        if (!pid || !df || !dt) {
            setListsLoad('idle');
            return;
        }
        let cancelled = false;
        setListsLoad('loading');
        void reloadLists().then(() => {
            if (!cancelled)
                setListsLoad('ok');
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
    }, [pid, df, dt, reloadLists]);
    useEffect(() => {
        const onInv = () => {
            void reloadLists().catch(() => undefined);
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
    }, [reloadLists]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [pendingReqs, pid, df, dt]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [confirmedReqs, pid, df, dt]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const alreadySent = Boolean(pendingForProject);
    const handleSubmit = async () => {
        if (submitBusy || alreadySent || fullyConfirmed || !pid)
            return;
        const confirmed = await showConfirm({
            title: t('timeTrackingPage.reports.submitForReview.confirmTitle'),
            message: t('timeTrackingPage.reports.submitForReview.confirmMessage'),
            confirmLabel: t('timeTrackingPage.reports.submitForReview.confirmLabel'),
        });
        if (!confirmed)
            return;
        setSubmitBusy(true);
        try {
            await submitPartnerReportConfirmationFromPreview({
                projectId: pid,
                dateFrom: df,
                dateTo: dt,
            });
            notifyPartnerConfirmedReportsListInvalidate();
            await reloadLists();
            await showAlert({ message: t('timeTrackingPage.reports.submitForReview.done') });
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : t('timeTrackingPage.reports.submitForReview.failed'),
            });
        }
        finally {
            setSubmitBusy(false);
        }
    };
    if (!pid)
        return null;
    const labelLong = fullyConfirmed
        ? t('timeTrackingPage.reports.submitForReview.confirmed')
        : alreadySent
            ? t('timeTrackingPage.reports.submitForReview.sent')
            : submitBusy
                ? t('timeTrackingPage.reports.submitForReview.busy')
                : t('timeTrackingPage.reports.submitForReview.action');
    const labelShort = fullyConfirmed
        ? t('timeTrackingPage.reports.submitForReview.confirmedShort')
        : alreadySent
            ? t('timeTrackingPage.reports.submitForReview.sentShort')
            : submitBusy
                ? t('timeTrackingPage.reports.submitForReview.busy')
                : t('timeTrackingPage.reports.submitForReview.actionShort');
    return (<button type="button" className="tt-rp-preview__manager-submit" disabled={submitBusy || listsLoad !== 'ok' || alreadySent || fullyConfirmed} onClick={() => void handleSubmit()} title={labelLong} aria-label={labelLong}>
        <span className="tt-rp-preview__manager-submit-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
        </span>
        <span className="tt-rp-preview__manager-submit-label tt-rp-preview__manager-submit-label--long">{labelLong}</span>
        <span className="tt-rp-preview__manager-submit-label tt-rp-preview__manager-submit-label--short">{labelShort}</span>
    </button>);
}
function reportPreviewConfirmationProjectId(xfer: ReportPreviewTransferV2, selectedProjectId: string): string {
    const pid = selectedProjectId.trim();
    if (!pid)
        return '';
    if (xfer.reportType === 'time' && xfer.groupBy === 'projects')
        return pid;
    if (xfer.reportType === 'expenses' && xfer.groupBy === 'projects')
        return pid;
    return '';
}
function ReportPreviewPartnerSignFooter({ projectId, dateFrom, dateTo, userId, returnTo, }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    userId: number | null;
    returnTo?: string | null;
}) {
    const { showAlert } = useAppDialog();
    const navigate = useNavigate();
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState<PartnerReportConfirmationRequest | null>(null);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const pid = projectId.trim();
    useEffect(() => {
        setSessionSnapshot(rpLoadPartnerConfirmSession(pid, df, dt));
    }, [pid, df, dt]);
    useEffect(() => {
        let cancelled = false;
        if (userId == null || !pid || !df || !dt) {
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
    }, [pid, df, dt, userId]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [pendingReqs, pid, df, dt]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [confirmedReqs, pid, df, dt]);
    const mySig = useMemo(() => {
        if (userId == null)
            return undefined;
        const hit = (req: PartnerReportConfirmationRequest | null | undefined) => req?.signatures.find((s) => s.partnerAuthUserId === userId);
        return hit(confirmedForProject) ?? hit(pendingForProject) ?? hit(sessionSnapshot);
    }, [userId, confirmedForProject, pendingForProject, sessionSnapshot]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const canPartnerSign = !fullyConfirmed && !mySig;
    const periodLabel = formatIsoRangeTitle(df, dt, { prefix: false });
    const handlePartnerConfirmSubmit = async () => {
        if (confirmBusy || userId == null || !canPartnerSign || listsLoad !== 'ok')
            return;
        setConfirmBusy(true);
        try {
            let requestId = pendingForProject?.id;
            if (!requestId) {
                const created = await submitPartnerReportConfirmationFromPreview({
                    projectId: pid,
                    dateFrom: df,
                    dateTo: dt,
                });
                requestId = created.id;
            }
            if (!requestId) {
                await showAlert({ message: 'Не удалось получить запрос подтверждения.' });
                return;
            }
            const out = await confirmPartnerReportConfirmation(requestId);
            rpSavePartnerConfirmSession(pid, df, dt, out);
            setSessionSnapshot(out);
            const [p, c] = await Promise.all([
                listPartnerReportConfirmationsPendingItems(),
                listPartnerReportConfirmationsConfirmed(),
            ]);
            setPendingReqs(p);
            setConfirmedReqs(c);
            if (out.status === 'fully_confirmed')
                notifyPartnerConfirmedReportsListInvalidate();
            leaveReportPreview(navigate, returnTo);
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
    if (userId == null || !pid || !canPartnerSign)
        return null;
    return (<div className="tt-rp-preview__partner-sign-strip" role="region" aria-label="Подпись отчёта">
        <div className="tt-rp-preview__partner-sign-strip-text">
            <span className="tt-rp-preview__partner-sign-strip-title">Нужна ваша подпись</span>
            <span className="tt-rp-preview__partner-sign-strip-hint">{periodLabel}</span>
        </div>
        <button type="button" className="tt-rp-preview__partner-sign-btn" onClick={() => void handlePartnerConfirmSubmit()} disabled={confirmBusy || listsLoad !== 'ok'}>
            {confirmBusy ? 'Отправка…' : listsLoad !== 'ok' ? 'Загрузка…' : 'Подписать'}
        </button>
    </div>);
}

function ReportPreviewPartnerBar({ projectId, dateFrom, dateTo, userId, sharedPartners, sharedPartnersLoading, returnTo, }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    userId: number | null;
    sharedPartners?: ProjectPartnerAccessRow[];
    sharedPartnersLoading?: boolean;
    returnTo?: string | null;
}) {
    const { showAlert } = useAppDialog();
    const navigate = useNavigate();
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);
    const partnerModalPanelRef = useRef<HTMLDivElement>(null);
    const [fetchedPartners, setFetchedPartners] = useState<ProjectPartnerAccessRow[]>([]);
    const [fetchedPartnersLoad, setFetchedPartnersLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const useSharedPartners = sharedPartners != null;
    const partners = useSharedPartners ? sharedPartners : fetchedPartners;
    const partnersLoad = useSharedPartners
        ? (sharedPartnersLoading ? 'loading' : 'ok')
        : fetchedPartnersLoad;
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState<PartnerReportConfirmationRequest | null>(null);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    const pid = projectId.trim();
    useEffect(() => {
        if (useSharedPartners)
            return;
        let cancelled = false;
        setFetchedPartnersLoad('loading');
        void listPartnerUsersWithProjectAccessToProject(projectId).then((rows) => {
            if (!cancelled) {
                setFetchedPartners(rows);
                setFetchedPartnersLoad('ok');
            }
        }).catch(() => {
            if (!cancelled) {
                setFetchedPartners([]);
                setFetchedPartnersLoad('ok');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, useSharedPartners]);
    useEffect(() => {
        setSessionSnapshot(rpLoadPartnerConfirmSession(pid, df, dt));
    }, [pid, df, dt]);
    useEffect(() => {
        let cancelled = false;
        if (userId == null) {
            setPendingReqs([]);
            setConfirmedReqs([]);
            setListsLoad('idle');
            return;
        }
        if (partnersLoad !== 'ok') {
            setListsLoad('idle');
            return;
        }
        if (!partners.some((p) => p.authUserId === userId)) {
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
    }, [projectId, df, dt, userId, partnersLoad, partners]);
    const pendingForProject = useMemo(() => pendingReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [pendingReqs, pid, df, dt]);
    const confirmedForProject = useMemo(() => confirmedReqs.find((r) => r.projectId === pid && rpPartnerConfirmPeriodMatches(r, df, dt)), [confirmedReqs, pid, df, dt]);
    const mySig = useMemo(() => {
        if (userId == null)
            return undefined;
        const hit = (req: PartnerReportConfirmationRequest | null | undefined) => req?.signatures.find((s) => s.partnerAuthUserId === userId);
        return hit(confirmedForProject) ?? hit(pendingForProject) ?? hit(sessionSnapshot);
    }, [userId, confirmedForProject, pendingForProject, sessionSnapshot]);
    const fullyConfirmed = confirmedForProject?.status === 'fully_confirmed';
    const refreshLists = async () => {
        const [p, c] = await Promise.all([
            listPartnerReportConfirmationsPendingItems(),
            listPartnerReportConfirmationsConfirmed(),
        ]);
        setPendingReqs(p);
        setConfirmedReqs(c);
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
    const periodLabel = formatIsoRangeTitle(df, dt);
    const showPartnerConfirmBtn = listsLoad === 'ok' && !fullyConfirmed && !mySig;
    const handlePartnerConfirmSubmit = async () => {
        if (confirmBusy || userId == null || !showPartnerConfirmBtn)
            return;
        setConfirmBusy(true);
        try {
            let requestId = pendingForProject?.id;
            if (!requestId) {
                const created = await submitPartnerReportConfirmationFromPreview({
                    projectId: pid,
                    dateFrom: df,
                    dateTo: dt,
                });
                requestId = created.id;
                await refreshLists();
            }
            if (!requestId) {
                await showAlert({ message: 'Не удалось получить запрос подтверждения.' });
                return;
            }
            const out = await confirmPartnerReportConfirmation(requestId);
            rpSavePartnerConfirmSession(pid, df, dt, out);
            setSessionSnapshot(out);
            await refreshLists();
            if (out.status === 'fully_confirmed')
                notifyPartnerConfirmedReportsListInvalidate();
            setPartnerModalOpen(false);
            leaveReportPreview(navigate, returnTo);
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
    const partnerModalTitleId = useId();
    useEffect(() => {
        if (!partnerModalOpen)
            return;
        const focusFirst = () => {
            const root = partnerModalPanelRef.current;
            const closeBtn = root?.querySelector<HTMLButtonElement>('.tt-rp-preview__partner-modal-close');
            closeBtn?.focus();
        };
        const t = window.requestAnimationFrame(focusFirst);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setPartnerModalOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.cancelAnimationFrame(t);
            window.removeEventListener('keydown', onKey);
        };
    }, [partnerModalOpen]);
    if (userId == null)
        return null;
    if (partnersLoad === 'idle' || partnersLoad === 'loading')
        return null;
    if (partnersLoad === 'error')
        return null;
    if (!partners.some((p) => p.authUserId === userId))
        return null;
    const triggerBadge = listsLoad !== 'ok'
        ? null
        : showPartnerConfirmBtn
            ? (<span className="tt-rp-preview__partner-trigger-badge">Нужна подпись</span>)
            : fullyConfirmed && mySig
                ? (<span className="tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--success">Готово</span>)
                : fullyConfirmed && !mySig
                    ? (<span className="tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--neutral">Подтверждено</span>)
                    : listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig
                        ? (<span className="tt-rp-preview__partner-trigger-badge tt-rp-preview__partner-trigger-badge--wait">Ожидание партнёров</span>)
                        : null;
    const modal = partnerModalOpen
        ? createPortal(<div className="tt-rp-preview__partner-modal-overlay" role="presentation" onClick={() => setPartnerModalOpen(false)}>
            <div ref={partnerModalPanelRef} className="tt-rp-preview__partner-modal-panel" role="dialog" aria-modal="true" aria-labelledby={partnerModalTitleId} onClick={(e) => e.stopPropagation()}>
                <div className="tt-rp-preview__partner-modal-head">
                    <div className="tt-rp-preview__partner-modal-head-text">
                        <span className="tt-rp-preview__partner-modal-kicker">Партнёрский статус</span>
                        <h2 id={partnerModalTitleId} className="tt-rp-preview__partner-modal-title">
                            Подтверждение отчёта
                        </h2>
                    </div>
                    <button type="button" className="tt-rp-preview__partner-modal-close" onClick={() => setPartnerModalOpen(false)} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <p className="tt-rp-preview__partner-modal-period">
                    Период: <strong>{periodLabel}</strong>
                </p>
                <p className="tt-rp-preview__partner-modal-lead">
                    Вы фиксируете принятие отчётности по проекту как партнёр. После подписей всех партнёров запись попадает в список подтверждённых отчётов.
                </p>
                {partners.length > 0 ? (<div className="tt-rp-preview__partner-modal-partners-block">
                    <span className="tt-rp-preview__partner-modal-label">Партнёры проекта</span>
                    <ul className="tt-rp-preview__partner-modal-partners">
                        {partners.map((p) => (<li key={p.authUserId} className={`tt-rp-preview__partner-modal-partner${userId === p.authUserId ? ' tt-rp-preview__partner-modal-partner--you' : ''}`}>
                            <span className="tt-rp-preview__partner-modal-partner-name">{p.displayName.trim() || `ID ${p.authUserId}`}</span>
                            {p.position ? (<span className="tt-rp-preview__partner-modal-partner-pos">{p.position}</span>) : null}
                            {userId === p.authUserId ? (<span className="tt-rp-preview__partner-modal-you">Вы</span>) : null}
                        </li>))}
                    </ul>
                </div>) : null}
                <div className="tt-rp-preview__partner-modal-status">
                    {listsLoad === 'loading' ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--muted">Загрузка статуса подтверждений…</p>) : null}
                    {listsLoad === 'error' ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--err" role="alert">
                        Не удалось загрузить статус подтверждений.
                    </p>) : null}
                    {listsLoad === 'ok' && fullyConfirmed && mySig ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok">
                        Все партнёры подтвердили отчёт. Ваша подпись: {fmtConfirmed(mySig.confirmedAt)}.
                    </p>) : null}
                    {listsLoad === 'ok' && fullyConfirmed && !mySig ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok">
                        Отчёт за этот период полностью подтверждён партнёрами.
                    </p>) : null}
                    {listsLoad === 'ok' && !fullyConfirmed && !pendingForProject && mySig ? (<p className="tt-rp-preview__partner-modal-status-msg tt-rp-preview__partner-modal-status-msg--ok">
                        Вы подтвердили ({fmtConfirmed(mySig.confirmedAt)}). Ожидаются другие партнёры.
                    </p>) : null}
                </div>
                <div className="tt-rp-preview__partner-modal-footer">
                    <button type="button" className="tt-rp-preview__partner-modal-btn tt-rp-preview__partner-modal-btn--ghost" onClick={() => setPartnerModalOpen(false)}>
                        Закрыть
                    </button>
                    {showPartnerConfirmBtn ? (<button type="button" className="tt-rp-preview__partner-modal-btn tt-rp-preview__partner-modal-btn--primary" onClick={() => void handlePartnerConfirmSubmit()} disabled={confirmBusy}>
                        {confirmBusy ? 'Отправка…' : 'Подтвердить принятие отчёта'}
                    </button>) : null}
                </div>
            </div>
        </div>, document.body)
        : null;
    return (<>
        <div className="tt-rp-preview__partner-trigger-wrap">
            <button type="button" className="tt-rp-preview__partner-trigger" title="Статус партнёрского подтверждения отчёта по проекту и периоду" aria-label="Подтверждение отчёта — статус партнёрского согласования" onClick={() => setPartnerModalOpen(true)} aria-haspopup="dialog" aria-expanded={partnerModalOpen}>
                <span className="tt-rp-preview__partner-trigger-icon" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                </span>
                <span className="tt-rp-preview__partner-trigger-label">Подтверждение отчёта</span>
                {triggerBadge}
            </button>
        </div>
        {modal}
    </>);
}
export type ReportPreviewNavBarProps = {
    hint?: string | null;
    hintTitle?: string | null;
    projectSlot?: ReactNode;
    timeReportViewSlot?: ReactNode;
    extrasSlot?: ReactNode;
};
export function ReportPreviewNavBar({ hint, hintTitle, projectSlot, timeReportViewSlot, extrasSlot }: ReportPreviewNavBarProps) {
    const onLeave = () => {
        void clearReportPreviewTransfer();
    };
    return (<nav className="time-page__navbar tt-rp-preview__navbar" aria-label="Предпросмотр отчёта">
        <div className="tt-rp-preview__navbar-start">
            <AppBackButton to={REPORTS_TAB_URL} onClick={onLeave} hideLabelOnMobile />
            <AppHomeLogo withSeparator />
            <div className="time-page__navbar-sep" aria-hidden="true" />
            <span className="time-page__navbar-title">Отчёты</span>
        </div>
        <div className="tt-rp-preview__navbar-center">
            <div className="tt-rp-preview__navbar-center-leading">
                <div className="time-page__navbar-tabs" role="tablist" aria-label="Текущий раздел">
                    <span className="time-page__navbar-tab time-page__navbar-tab--active" role="tab" aria-selected="true" tabIndex={-1}>
                        Предпросмотр
                    </span>
                </div>
                {timeReportViewSlot ? (<div className="tt-rp-preview__navbar-view-slot">{timeReportViewSlot}</div>) : null}
            </div>
            {extrasSlot ? (<div className="tt-rp-preview__navbar-extras">{extrasSlot}</div>) : null}
        </div>
        <div className="tt-rp-preview__navbar-end">
            <div className="time-page__navbar-settings">
                <AppPageSettings />
            </div>
            {projectSlot !== undefined
                ? projectSlot
                : hint
                    ? (<span className="tt-rp-preview__navbar-hint" title={hintTitle ?? undefined}>{hint}</span>)
                    : null}
        </div>
    </nav>);
}
function persistXferFilters(xfer: ReportPreviewTransferV2, filters: ReportFiltersV2, listPerPage: number, period?: ReportPreviewPeriodState): void {
    const paged: ReportFiltersV2 = { ...filters, page: 1, per_page: listPerPage };
    const snapExtra = {
        ...(xfer.partnerConfirmationSnapshotId?.trim()
            ? { partnerConfirmationSnapshotId: xfer.partnerConfirmationSnapshotId.trim() }
            : {}),
        ...((period ?? xfer.period) ? { period: period ?? xfer.period } : {}),
        ...(xfer.returnTo?.trim() ? { returnTo: xfer.returnTo.trim() } : {}),
        ...(xfer.forReviewPreview ? { forReviewPreview: true } : {}),
    };
    if (xfer.reportType === 'time') {
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'time',
            groupBy: xfer.groupBy,
            filters: paged,
            ...snapExtra,
        });
        return;
    }
    if (xfer.reportType === 'expenses') {
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'expenses',
            groupBy: xfer.groupBy,
            filters: paged,
            ...snapExtra,
        });
        return;
    }
    if (xfer.reportType === 'uninvoiced') {
        writeReportPreviewTransfer({ v: 2, reportType: 'uninvoiced', filters: paged, ...snapExtra });
        return;
    }
    writeReportPreviewTransfer({ v: 2, reportType: 'project-budget', filters: paged, ...snapExtra });
}
export function ReportPreviewPage() {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const [reportPageSizeMax, setReportPageSizeMax] = useState<number | null>(null);
    const listPerPage = useMemo(() => {
        const cap = reportPageSizeMax != null && reportPageSizeMax > 0 ? Math.min(reportPageSizeMax, 5000) : 500;
        return Math.min(500, cap);
    }, [reportPageSizeMax]);
    const [loading, setLoading] = useState(true);
    const [xferHydrated, setXferHydrated] = useState(false);
    const [xferSnapshot, setXferSnapshot] = useState<ReportPreviewTransferV2 | null>(null);
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [teamFilterEnabled, setTeamFilterEnabled] = useState(false);
    const [teamFilterPartnerId, setTeamFilterPartnerId] = useState(0);
    const [teamFilterTeamId, setTeamFilterTeamId] = useState('');
    const [teamsCatalog, setTeamsCatalog] = useState<TimeTrackingTeamRow[]>([]);
    const [teamsCatalogLoading, setTeamsCatalogLoading] = useState(false);
    const [teamsCatalogError, setTeamsCatalogError] = useState<string | null>(null);
    const [usersForFilter, setUsersForFilter] = useState<ReportsFilterUser[]>([]);
    const [usersForFilterError, setUsersForFilterError] = useState<string | null>(null);
    const [catalogUserExportProfilesById, setCatalogUserExportProfilesById] = useState<Map<number, AuthUserExportProfile>>(() => new Map());
    const [ttUsersCatalog, setTtUsersCatalog] = useState<TimeTrackingUserRow[]>([]);
    const [periodDate, setPeriodDate] = useState(() => new Date());
    const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>('month');
    const [customRangeActive, setCustomRangeActive] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [projectMembersForEmployeePick, setProjectMembersForEmployeePick] = useState<ProjectPartnerAccessRow[]>([]);
    const [projectPartnersWithAccess, setProjectPartnersWithAccess] = useState<ProjectPartnerAccessRow[]>([]);
    const [projectMembersPickLoading, setProjectMembersPickLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [timeExcelRows, setTimeExcelRows] = useState<TimeExcelPreviewRow[]>([]);
    const [expenseExcelRows, setExpenseExcelRows] = useState<ExpenseExcelPreviewRow[]>([]);
    const [uninvoicedExcelRows, setUninvoicedExcelRows] = useState<UninvoicedExcelPreviewRow[]>([]);
    const [budgetExcelRows, setBudgetExcelRows] = useState<BudgetExcelPreviewRow[]>([]);
    const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
    const [employeeExcluded, setEmployeeExcluded] = useState<Set<string>>(() => new Set());
    const [employeeSortAsc, setEmployeeSortAsc] = useState(true);

    const [timeBriefEmployeeSearch, setTimeBriefEmployeeSearch] = useState('');
    const [serverDataRefreshNonce, setServerDataRefreshNonce] = useState(0);
    const [timeReportViewMode, setTimeReportViewMode] = useState<'brief' | 'full'>('brief');
    const timeExcelRowsRef = useRef<TimeExcelPreviewRow[]>([]);
    const timeEntrySaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const timeEntryServerOwnerByEntryIdRef = useRef<Map<string, number>>(new Map());
    const deletedTimeEntryIdsRef = useRef<Set<string>>(new Set());

    const timeEntryPersistSkipRowKeysRef = useRef<Set<string>>(new Set());
    const editHistoryRef = useRef(createReportPreviewEditHistory());
    const activeTimeRowKeyRef = useRef<string | null>(null);
    const undoBusyRef = useRef(false);
    const [editHistoryVersion, setEditHistoryVersion] = useState(0);
    const [hotkeyDuplicateRowKey, setHotkeyDuplicateRowKey] = useState<string | null>(null);
    const [flashRestoredRowKey, setFlashRestoredRowKey] = useState<string | null>(null);
    const flashRestoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [timeEntrySaveUI, setTimeEntrySaveUI] = useState<'idle' | 'saving' | 'saved' | 'err'>(() => 'idle');
    const [timeEntrySaveMessage, setTimeEntrySaveMessage] = useState<string | null>(null);
    const [timeEntryActionPendingRowKey, setTimeEntryActionPendingRowKey] = useState<string | null>(null);
    const [timeExcelDownloadBusy, setTimeExcelDownloadBusy] = useState(false);
    useLayoutEffect(() => {
        timeExcelRowsRef.current = timeExcelRows;
    }, [timeExcelRows]);
    useEffect(() => {
        return () => {
            for (const t of timeEntrySaveTimers.current.values())
                clearTimeout(t);
            timeEntrySaveTimers.current.clear();
            if (flashRestoredTimerRef.current)
                clearTimeout(flashRestoredTimerRef.current);
        };
    }, []);
    const bumpEditHistory = useCallback(() => {
        setEditHistoryVersion((v) => v + 1);
    }, []);
    const flashRestoredRow = useCallback((rowKey: string) => {
        if (flashRestoredTimerRef.current)
            clearTimeout(flashRestoredTimerRef.current);
        setFlashRestoredRowKey(rowKey);
        flashRestoredTimerRef.current = setTimeout(() => {
            setFlashRestoredRowKey((cur) => (cur === rowKey ? null : cur));
            flashRestoredTimerRef.current = null;
        }, 2600);
    }, []);
    const clearPendingSaveTimer = useCallback((rowKey: string) => {
        const prevT = timeEntrySaveTimers.current.get(rowKey);
        if (prevT)
            clearTimeout(prevT);
        timeEntrySaveTimers.current.delete(rowKey);
    }, []);
    useEffect(() => {
        setUsersForFilterError(null);
        void fetchReportsUsersForFilter()
            .then((list) => {
                const filtered = list.filter((u) => !isHiddenSystemUser({ email: u.email, display_name: u.displayName }));
                setUsersForFilter(filtered);
                setUsersForFilterError(null);
                setCatalogUserExportProfilesById((prev) => mergeAuthUserExportProfiles(prev, filtered.map((u) => ({
                    authUserId: u.id,
                    initials: u.initials,
                }))));
            })
            .catch((e: unknown) => {
                setUsersForFilter([]);
                if (isTimeTrackingHttpError(e, 401) || isTimeTrackingHttpError(e, 403))
                    setUsersForFilterError(t('timeTrackingPage.reports.header.usersFilterError'));
            });
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
        void listTimeTrackingUsers()
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
        };
    }, []);
    useEffect(() => {
        if (!user || !hasFullTimeTrackingTabs(user))
            return;
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
    }, [user]);
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
    }, [catalogUserExportProfilesById, projectMembersForEmployeePick]);
    useEffect(() => {
        void fetchReportsMeta()
            .then((m) => {
                setReportPageSizeMax(m.pageSizeMax);
            })
            .catch(() => {
                setReportPageSizeMax(null);
            });
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
        setXferSnapshot(xfer);
        setRangeFrom(base.dateFrom);
        setRangeTo(base.dateTo);
        const resolvedPeriod = resolveReportPreviewPeriodState(base.dateFrom, base.dateTo, xfer.period);
        setPeriodDate(resolvedPeriod.periodDate);
        setPeriodGranularity(resolvedPeriod.periodGranularity);
        setCustomRangeActive(resolvedPeriod.customRangeActive);
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
    const viewerIsPartner = useMemo(() => Boolean(user && isPartnerOrgRole(user.role, user.position)), [user]);
    const canPickTeamFilterPartner = Boolean(user && hasFullTimeTrackingTabs(user));
    const effectiveSelectedUserIds = useMemo(() => resolveEffectiveReportPreviewUserIds({
        teamFilterEnabled,
        teamFilterPartnerId,
        teamFilterTeamId,
        teams: teamsCatalog,
        selectedUserIds,
    }), [teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teamsCatalog, selectedUserIds]);
    const usersForEmployeeFilter = useMemo(() => {
        if (!teamFilterEnabled || teamFilterPartnerId <= 0)
            return usersForFilter;
        const allowed = new Set(resolveTeamMemberUserIds(
            teamsCatalog,
            teamFilterPartnerId,
            teamFilterTeamId.trim() || undefined,
        ));
        if (allowed.size === 0)
            return usersForFilter;
        return usersForFilter.filter((u) => allowed.has(u.id));
    }, [usersForFilter, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teamsCatalog]);
    const handleTeamFilterEnabledChange = useCallback((enabled: boolean) => {
        setTeamFilterEnabled(enabled);
        if (!enabled) {
            setSelectedUserIds([]);
            return;
        }
        if (viewerIsPartner && user?.id && teamFilterPartnerId <= 0)
            setTeamFilterPartnerId(user.id);
    }, [viewerIsPartner, user?.id, teamFilterPartnerId]);
    const handleTeamFilterPartnerChange = useCallback((partnerId: number) => {
        setTeamFilterPartnerId(partnerId);
        setTeamFilterTeamId(pickDefaultTeamId(teamsCatalog, partnerId));
        if (teamFilterEnabled) {
            const ids = resolveTeamMemberUserIds(
                teamsCatalog,
                partnerId,
                pickDefaultTeamId(teamsCatalog, partnerId) || undefined,
            );
            if (ids.length > 0)
                setSelectedUserIds(ids);
        }
    }, [teamsCatalog, teamFilterEnabled]);
    const handleTeamFilterTeamChange = useCallback((nextTeamId: string) => {
        setTeamFilterTeamId(nextTeamId);
        if (teamFilterEnabled && teamFilterPartnerId > 0) {
            const ids = resolveTeamMemberUserIds(
                teamsCatalog,
                teamFilterPartnerId,
                nextTeamId.trim() || undefined,
            );
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
        const ids = resolveTeamMemberUserIds(
            teamsCatalog,
            teamFilterPartnerId,
            teamFilterTeamId.trim() || undefined,
        );
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
            const filters = buildReportPreviewSyncedFilters(
                prev,
                rangeFrom,
                rangeTo,
                selectedProjectId,
                selectedClientId,
                effectiveSelectedUserIds,
                teamFilterEnabled,
                teamFilterPartnerId,
                teamFilterTeamId,
                reportPageSizeMax,
            );
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
        setSelectedUserName(null);
        setEmployeeExcluded(new Set());
        setEmployeeSortAsc(true);
    }, [previewDataResetKey]);
    const onPreviewFrom = useCallback((iso: string) => {
        setCustomRangeActive(true);
        setRangeFrom(iso);
        setRangeTo((to) => (iso > to ? iso : to));
    }, []);
    const onPreviewTo = useCallback((iso: string) => {
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
    const onPreviewPeriodGranularityChange = useCallback((g: PeriodGranularity) => {
        setPeriodGranularity(g);
        setCustomRangeActive(false);
    }, []);
    const onPreviewResetCustomRange = useCallback(() => {
        setCustomRangeActive(false);
    }, []);
    const onProjectPick = useCallback((id: string) => {
        setSelectedProjectId(id);
    }, []);
    const projectItemsForSelect = useMemo((): ProjectOption[] => {
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
    const addEntryProjectOption = useMemo((): ProjectOption | null => {
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
        const apiFilters: Omit<ReportFiltersV2, 'page' | 'per_page'> = {
            ...buildApiFilters(xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds),
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
        };
        void (async () => {
            try {
                if (xferSnapshot.reportType === 'time') {
                    const gb = xferSnapshot.groupBy as TimeGroup;
                    const raw = gb === 'clients'
                        ? await fetchAllTimeReportClientRows(apiFilters)
                        : gb === 'projects'
                            ? await fetchAllTimeReportProjectRows(apiFilters)
                            : gb === 'tasks'
                                ? await fetchAllTimeReportTaskRows(apiFilters)
                                : await fetchAllTimeReportTeamRows(apiFilters);
                    const sorted = sortTimeReportRowsForDisplay(gb, raw);
                    if (!cancelled) {
                        const rows = applyAuthUserExportProfilesToTimePreviewRows(
                            deduplicateTimeExcelPreviewRows(flattenTimeReportToExcelRows(gb, sorted)),
                            authUserExportProfilesById,
                        );
                        syncTimeEntryServerOwnersFromRows(timeEntryServerOwnerByEntryIdRef.current, rows);
                        setTimeExcelRows(rows);
                    }
                    return;
                }
                if (xferSnapshot.reportType === 'expenses') {
                    const gb = coerceGroupByForType('expenses', xferSnapshot.groupBy) as ExpenseGroup;
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
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds, serverDataRefreshNonce, reportPageSizeMax]);
    const requestServerDataReload = useCallback(() => {
        clearEditHistory(editHistoryRef.current);
        bumpEditHistory();
        invalidateReportApiCache();
        setServerDataRefreshNonce((n) => n + 1);
    }, [bumpEditHistory]);
    const isProjectPartnerForPreview = useMemo(() => {
        if (!user?.id)
            return false;
        const uid = user.id;
        return projectPartnersWithAccess.some((p) => p.authUserId === uid);
    }, [user?.id, projectPartnersWithAccess]);
    const canOverrideWeeklyLock = canOverrideReportPreviewWeeklyLock(user) || isProjectPartnerForPreview;
    const flushPersistTimeEntry = useCallback(async (rowKey: string) => {
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
    }, [canOverrideWeeklyLock]);
    const schedulePersistTimeEntry = useCallback((rowKey: string) => {
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
    const patchTimeExcel = useCallback((rowKey: string, patch: Partial<TimeExcelPreviewRow>) => {
        let asyncRateFetch: { authUserId: number; projectId: string; currency: string } | null = null;
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
                        amountToPay: computeTimePreviewRowAmountToPay({ ...row, billableRate: rate }),
                    };
                    const next = prev.map((r) => (r.rowKey === rowKey ? nextRow : r));
                    timeExcelRowsRef.current = next;
                    schedulePersistTimeEntry(rowKey);
                    return next;
                });
            });
        }
    }, [schedulePersistTimeEntry, canOverrideWeeklyLock, authUserExportProfilesById, bumpEditHistory]);
    const handleDeleteTimeEntry = useCallback(async (rowKey: string) => {
        const confirmed = await showConfirm({
            title: 'Удалить запись времени?',
            message: 'Сразу после удаления можно вернуть запись через «Отмена» или Ctrl/⌘+Z. После обновления с сервера отмена недоступна.',
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
            pushDeleteUndo(editHistoryRef.current, rowKey, snapshot);
            bumpEditHistory();
            setTimeExcelRows((prev) => {
                const next = prev.filter((r) => r.rowKey !== rowKey);
                timeExcelRowsRef.current = next;
                return next;
            });
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
    }, [bumpEditHistory, showAlert, showConfirm]);
    const handleMoveTimeEntryToProject = useCallback(async (rowKey: string, newProjectId: string) => {
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
            let resolvedTask: { taskId: string; taskName: string } | null = null;
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
    const handleDuplicateTimeEntry = useCallback(async (rowKey: string, workDateYmd: string, recordedAtIso: string) => {
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
                const next = [...prev, newRow];
                timeExcelRowsRef.current = next;
                return next;
            });
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
    }, [canOverrideWeeklyLock, rangeFrom, rangeTo, showAlert, bumpEditHistory]);
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
        const onKeyDown = (e: KeyboardEvent) => {
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
    const canUndoTimeEdit = useMemo(
        () => editHistoryCanUndo(editHistoryRef.current),
        [editHistoryVersion],
    );
    const setActiveTimeRowKey = useCallback((rowKey: string) => {
        activeTimeRowKeyRef.current = rowKey;
    }, []);
    const clearHotkeyDuplicateRowKey = useCallback(() => {
        setHotkeyDuplicateRowKey(null);
    }, []);
    const patchExpenseExcel = useCallback((rowKey: string, patch: Partial<ExpenseExcelPreviewRow>) => {
        setExpenseExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
    }, []);
    const patchUninvoicedExcel = useCallback((rowKey: string, patch: Partial<UninvoicedExcelPreviewRow>) => {
        setUninvoicedExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
    }, []);
    const patchBudgetExcel = useCallback((rowKey: string, patch: Partial<BudgetExcelPreviewRow>) => {
        setBudgetExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
    }, []);
    const archivedAuthUserIds = useMemo(() => buildArchivedAuthUserIds(ttUsersCatalog), [ttUsersCatalog]);
    const archivedEmployeeNames = useMemo(() => buildArchivedEmployeeNames(ttUsersCatalog), [ttUsersCatalog]);
    const timeUniqueNames = useMemo(() => {
        const rowNames = uniqueSortedEmployeeNames(
            timeExcelRows.filter((r) => isActiveReportPreviewEmployee(r.authUserId, archivedAuthUserIds)),
        );
        const memberNames = projectMembersForEmployeePick.map((m) => m.displayName);
        return mergeUniqueSortedEmployeeNames(rowNames, memberNames);
    }, [timeExcelRows, projectMembersForEmployeePick, archivedAuthUserIds]);
    const expenseUniqueNames = useMemo(
        () => filterActiveEmployeeNames(uniqueSortedEmployeeNames(expenseExcelRows), archivedEmployeeNames),
        [expenseExcelRows, archivedEmployeeNames],
    );
    const uninvoicedUniqueNames = useMemo(
        () => filterActiveEmployeeNames(uniqueSortedEmployeeNames(uninvoicedExcelRows), archivedEmployeeNames),
        [uninvoicedExcelRows, archivedEmployeeNames],
    );
    const budgetUniqueNames = useMemo(
        () => filterActiveEmployeeNames(uniqueSortedEmployeeNames(budgetExcelRows), archivedEmployeeNames),
        [budgetExcelRows, archivedEmployeeNames],
    );
    const timeDisplayRows = useMemo(() => {
        return timeExcelRows.filter((r) => !employeeExcluded.has(r.userName));
    }, [timeExcelRows, employeeExcluded]);
    const timeEmployeePartnerPick = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || xferSnapshot.groupBy !== 'projects')
            return null;
        if (!selectedProjectId.trim())
            return null;
        return {
            loading: projectMembersPickLoading,
            members: projectMembersForEmployeePick,
        };
    }, [xferSnapshot, selectedProjectId, projectMembersPickLoading, projectMembersForEmployeePick]);
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
    const timeExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={timeUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc} tableNameSearch={{ value: timeBriefEmployeeSearch, onChange: setTimeBriefEmployeeSearch }} />), [timeUniqueNames, employeeExcluded, employeeSortAsc, timeBriefEmployeeSearch]);
    const expenseExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={expenseUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc} />), [expenseUniqueNames, employeeExcluded, employeeSortAsc]);
    const uninvoicedExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={uninvoicedUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc} />), [uninvoicedUniqueNames, employeeExcluded, employeeSortAsc]);
    const budgetExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={budgetUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc} />), [budgetUniqueNames, employeeExcluded, employeeSortAsc]);
    const handleDownloadTimeExcel = useCallback(async (visiblePageRows: TimeExcelPreviewRow[]) => {
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
    const liveTitle = xferSnapshot ? previewLiveTitle(xferSnapshot) : '';
    const xferExists = readReportPreviewTransfer() != null;
    const partnerConfirmedReadOnly = Boolean(xferSnapshot?.partnerConfirmationSnapshotId?.trim());
    const forReviewPreviewLocked = Boolean(xferSnapshot?.forReviewPreview) || Boolean(xferSnapshot?.returnTo?.includes('reportsSection=for-review'));
    const hidePeriodControls = partnerConfirmedReadOnly || forReviewPreviewLocked;
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
    const partnerConfirmNavbarSlot = confirmationProjectId && !partnerConfirmedReadOnly
        ? (<ReportPreviewPartnerBar projectId={confirmationProjectId} dateFrom={rangeFrom} dateTo={rangeTo} userId={user?.id ?? null} sharedPartners={partnerBarSharedPartners} sharedPartnersLoading={partnerBarSharedPartners != null ? projectMembersPickLoading : undefined} returnTo={xferSnapshot?.returnTo} />)
        : null;
    const userCanSignPartnerReport = Boolean(
        user
        && confirmationProjectId
        && !partnerConfirmedReadOnly
        && (
            viewerIsPartner
            || projectPartnersWithAccess.some((p) => p.authUserId === user.id)
        ),
    );
    const partnerSignFooterExtras = userCanSignPartnerReport
        ? (<ReportPreviewPartnerSignFooter projectId={confirmationProjectId} dateFrom={rangeFrom} dateTo={rangeTo} userId={user?.id ?? null} returnTo={xferSnapshot?.returnTo} />)
        : null;
    const managerSubmitNavbarSlot = confirmationProjectId && !partnerConfirmedReadOnly && hasFullTimeTrackingTabs(user)
        ? (<ReportPreviewManagerSubmitBar projectId={confirmationProjectId} dateFrom={rangeFrom} dateTo={rangeTo} />)
        : null;
    const navbarExtrasSlot = managerSubmitNavbarSlot || partnerConfirmNavbarSlot
        ? (<div className="tt-rp-preview__navbar-actions">
            {managerSubmitNavbarSlot}
            {partnerConfirmNavbarSlot}
        </div>)
        : undefined;
    const reportHasTableData = Boolean(
        xferSnapshot && (
            xferSnapshot.reportType === 'time'
                ? timeExcelRows.length > 0
                : xferSnapshot.reportType === 'expenses'
                    ? expenseExcelRows.length > 0
                    : xferSnapshot.reportType === 'uninvoiced'
                        ? uninvoicedExcelRows.length > 0
                        : budgetExcelRows.length > 0
        ),
    );
    if (loading) {
        return (<div className="tt-rp-preview tt-rp-preview--fill" role="status" aria-live="polite">
            <ReportPreviewNavBar />
            <div className="tt-rp-preview__main tt-rp-preview__main--fill tt-rp-preview__body-pad">
                <ReportPreviewMockSkeleton variant="generic" label="Загрузка предпросмотра…" />
            </div>
        </div>);
    }
    if (!xferExists && !xferSnapshot) {
        return (<div className="tt-rp-preview">
            <ReportPreviewNavBar />
            <div className="tt-rp-preview__main">
                <div className="tt-rp-preview__empty">
                    <p>
                        Откройте раздел «Отчёты» в учёте времени и нажмите «Предпросмотр», либо список «Подтверждённые партнёром» и кнопку «Предпросмотр» у строки — передаются вид отчёта, разрез и фильтры.
                    </p>
                    <Link className="tt-rp-preview__btn tt-rp-preview__btn--accent" to={REPORTS_TAB_URL}>
                        Перейти к отчётам
                    </Link>
                </div>
            </div>
        </div>);
    }
    const timeProjectSwitcherEnabled = xferSnapshot?.reportType === 'time' && Boolean(user) && xferSnapshot.groupBy === 'projects';
    const timeReportViewToggle = xferSnapshot?.reportType === 'time'
        ? (<div className="tt-rp-preview__view-toggle" role="group" aria-label="Вид таблицы времени">
            <button type="button" className={`tt-rp-preview__view-toggle-btn${timeReportViewMode === 'brief' ? ' tt-rp-preview__view-toggle-btn--active' : ''}`} aria-pressed={timeReportViewMode === 'brief'} onClick={() => setTimeReportViewMode('brief')}>
                Краткий
            </button>
            <button type="button" className={`tt-rp-preview__view-toggle-btn${timeReportViewMode === 'full' ? ' tt-rp-preview__view-toggle-btn--active' : ''}`} aria-pressed={timeReportViewMode === 'full'} onClick={() => setTimeReportViewMode('full')}>
                Полный
            </button>
        </div>)
        : null;
    const navProjectSlot: ReactNode | undefined = xferSnapshot?.reportType === 'time' && xferSnapshot.groupBy === 'clients' && Boolean(user)
        ? (<div className="tt-rp-preview__navbar-project" title="Фильтр по клиенту (как при открытии из строки отчёта).">
            <span className="tt-rp-preview__navbar-hint tt-rp-preview__navbar-client-pill" aria-live="polite">
                {timePreviewTableTitle}
            </span>
        </div>)
        : timeProjectSwitcherEnabled
            ? (projectsError
                ? (<span className="tt-rp-preview__navbar-hint" title="Не удалось загрузить список проектов для переключения">
                    {projectsError}
                </span>)
                : (<div className="tt-rp-preview__navbar-project" title={partnerConfirmedReadOnly ? 'Проект зафиксирован для этого просмотра' : 'Выбор проекта (фильтр сохраняется для возврата в отчёты).'}>
                    <SearchableSelect<ProjectOption> portalDropdown className="tt-rp-preview__navbar-project-select" buttonClassName="tt-rp-preview__navbar-project-btn" aria-label="Проект" disabled={partnerConfirmedReadOnly || projectsLoading || projectItemsForSelect.length === 0} placeholder={projectsLoading ? 'Загрузка проектов…' : projectItemsForSelect.length === 0 ? 'Нет проектов' : 'Найдите или выберите проект…'} emptyListText={projectsLoading ? 'Загрузка…' : 'Нет доступных проектов'} noMatchText="Проект не найден" value={selectedProjectId} items={projectItemsForSelect} getOptionValue={(p) => p.id} getOptionLabel={previewProjectOptionLabel} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} onSelect={(p) => onProjectPick(p.id)} />
                </div>))
            : undefined;
    const mainBody = (() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo)
            return (<p className="tt-rp-preview__muted tt-rp-preview__no-table-msg">Укажите период (даты «С» и «По»).</p>);
        if (reportLoading && !reportHasTableData)
            return (<ReportPreviewMockSkeleton variant="generic" label="Загрузка отчёта…" />);
        if (reportError)
            return (<div className="tt-reports__table-err" role="alert">{reportError}</div>);
        if (xferSnapshot.reportType === 'time') {
            if (timeExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            const showTimeLiveTitle = xferSnapshot.groupBy !== 'projects';
            return (<>
                {showTimeLiveTitle ? (<p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>) : null}
                <TimeExcelPreviewTable projectTitle={timePreviewTableTitle} viewMode={timeReportViewMode} readOnly={partnerConfirmedReadOnly} rows={timeDisplayRows} onPatch={patchTimeExcel} selectedUserName={selectedUserName} onSelectUserName={partnerConfirmedReadOnly ? undefined : setSelectedUserName} employeeColumnFilterSlot={partnerConfirmedReadOnly ? null : timeExcelFilterSlot} briefEmployeeQuery={timeBriefEmployeeSearch} onRequestServerReload={partnerConfirmedReadOnly ? undefined : requestServerDataReload} serverReloadBusy={reportLoading} timeSave={partnerConfirmedReadOnly ? undefined : { ui: timeEntrySaveUI, message: timeEntrySaveMessage }} canOverrideClosedWeek={canOverrideWeeklyLock} moveProjectOptions={partnerConfirmedReadOnly || !user ? undefined : projectItemsForSelect} onDeleteTimeEntry={partnerConfirmedReadOnly || !user ? undefined : handleDeleteTimeEntry} onMoveTimeEntryToProject={partnerConfirmedReadOnly || !user ? undefined : handleMoveTimeEntryToProject} onDuplicateTimeEntry={partnerConfirmedReadOnly || !user ? undefined : handleDuplicateTimeEntry} onAddTimeEntry={partnerConfirmedReadOnly || !user ? undefined : handleAddTimeEntry} timeEntryWorkDateBounds={{ min: rangeFrom.slice(0, 10), max: rangeTo.slice(0, 10) }} timeEntryActionPendingRowKey={partnerConfirmedReadOnly ? null : timeEntryActionPendingRowKey} employeePartnerPick={partnerConfirmedReadOnly ? null : timeEmployeePartnerPick} onDownloadExcel={handleDownloadTimeExcel} downloadExcelBusy={timeExcelDownloadBusy} footerExtras={partnerSignFooterExtras} flashRowKey={partnerConfirmedReadOnly ? null : flashRestoredRowKey} hotkeyDuplicateRowKey={partnerConfirmedReadOnly ? null : hotkeyDuplicateRowKey} onHotkeyDuplicateConsumed={partnerConfirmedReadOnly ? undefined : clearHotkeyDuplicateRowKey} onActiveTimeRowKey={partnerConfirmedReadOnly ? undefined : setActiveTimeRowKey} canUndo={!partnerConfirmedReadOnly && canUndoTimeEdit} onUndo={partnerConfirmedReadOnly ? undefined : undoLastTimeEdit} onSaveNow={partnerConfirmedReadOnly ? undefined : flushAllPendingTimeEntrySaves} />
            </>);
        }
        if (xferSnapshot.reportType === 'expenses') {
            if (expenseExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (<>
                <p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>
                <ExpenseExcelPreviewTable rows={expenseDisplayRows} onPatch={patchExpenseExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={expenseExcelFilterSlot} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading} />
            </>);
        }
        if (xferSnapshot.reportType === 'uninvoiced') {
            if (uninvoicedExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (<>
                <p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>
                <UninvoicedExcelPreviewTable rows={uninvoicedDisplayRows} onPatch={patchUninvoicedExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={uninvoicedExcelFilterSlot} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading} />
            </>);
        }
        if (xferSnapshot.reportType === 'project-budget') {
            if (budgetExcelRows.length === 0 && !reportLoading)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (<>
                <p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>
                <BudgetExcelPreviewTable rows={budgetDisplayRows} onPatch={patchBudgetExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={budgetExcelFilterSlot} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading} />
            </>);
        }
        return null;
    })();
    return (<div className="tt-rp-preview tt-rp-preview--fill">
        <ReportPreviewNavBar projectSlot={navProjectSlot} timeReportViewSlot={timeReportViewToggle ?? undefined} extrasSlot={navbarExtrasSlot} />
        {xferSnapshot && rangeFrom && rangeTo ? (<ReportPreviewFiltersBar periodTitle={periodTitle} periodGranularity={periodGranularity} onPeriodGranularityChange={onPreviewPeriodGranularityChange} onPrevPeriod={onPreviewPrevPeriod} onNextPeriod={onPreviewNextPeriod} users={usersForEmployeeFilter} usersError={usersForFilterError} selectedUserIds={selectedUserIds} onSelectedUserIdsChange={setSelectedUserIds} dateFrom={rangeFrom} dateTo={rangeTo} onDateFromChange={onPreviewFrom} onDateToChange={onPreviewTo} customRangeActive={customRangeActive} onResetCustomRange={onPreviewResetCustomRange} disabled={partnerConfirmedReadOnly} hidePeriodControls={hidePeriodControls} teamFilter={{
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
        }} />) : null}

        <div className="tt-rp-preview__main tt-rp-preview__main--fill tt-rp-preview__body-pad">
            <div className={`tt-rp-preview__live${xferSnapshot && (xferSnapshot.reportType === 'time' || xferSnapshot.reportType === 'expenses' || xferSnapshot.reportType === 'uninvoiced' || xferSnapshot.reportType === 'project-budget') ? ' tt-rp-preview__live--sheet' : ''}${reportLoading && reportHasTableData ? ' tt-rp-preview__live--busy' : ''}`}>
                {mainBody}
            </div>
            {timeEntrySaveUI === 'err' && timeEntrySaveMessage
                ? (<p className="tt-rp-preview__save-err" role="alert">
                    {timeEntrySaveMessage}
                </p>)
                : null}
        </div>
    </div>);
}
export default ReportPreviewPage;
