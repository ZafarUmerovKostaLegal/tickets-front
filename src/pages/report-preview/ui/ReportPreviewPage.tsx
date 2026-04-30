import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, } from 'react';
import { createPortal } from 'react-dom';
import { ReportPreviewMockSkeleton } from './ReportPreviewMockSkeleton';
import { ReportPreviewEmployeeExcelFilter } from './ReportPreviewEmployeeExcelFilter';
import {
    BudgetExcelPreviewTable,
    ExpenseExcelPreviewTable,
    TimeExcelPreviewTable,
    UninvoicedExcelPreviewTable,
} from './ReportPreviewExcelTables';
import { sortRowsByUserName, uniqueSortedEmployeeNames, } from '../lib/sortReportPreviewRows';
import { Link } from 'react-router-dom';
import { routes } from '@shared/config';
import {
    type ReportFiltersV2,
    fetchReportsMeta,
    fetchAllTimeReportClientRows,
    fetchAllTimeReportProjectRows,
    fetchAllExpenseReportRows,
    fetchAllUninvoicedReportRows,
    fetchAllBudgetReportRows,
    isTimeTrackingHttpError,
    canGrantTimeEntryEditUnlock,
    grantTimeEntryEditUnlock,
    isClosedReportingWeekEditingBlockedForSubject,
    patchTimeEntry,
    createTimeEntry,
    deleteTimeEntry,
    listClientTasks,
    canOverrideReportPreviewWeeklyLock,
    listPartnerUsersWithProjectAccessToProject,
    listPartnerReportConfirmationsPending,
    listPartnerReportConfirmationsConfirmed,
    confirmPartnerReportConfirmation,
    submitPartnerReportConfirmationFromPreview,
    parsePartnerReportConfirmationRequest,
    type ProjectPartnerAccessRow,
    type PartnerReportConfirmationRequest,
    notifyPartnerConfirmedReportsListInvalidate,
} from '@entities/time-tracking';
import { readReportPreviewTransfer, clearReportPreviewTransfer, normalizeReportPreviewTransfer, writeReportPreviewTransfer, type ReportPreviewTransferV2, } from '@entities/time-tracking/model/reportPreviewTransfer';
import { coerceGroupByForType, type ExpenseGroup, type TimeGroup, } from '@entities/time-tracking/model/reportsPanelConfig';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { loadTimesheetProjectOptions, type ProjectOption, } from '@pages/time-tracking/ui/timesheetProjectLoader';
import { sortTimeReportRowsForDisplay } from '@entities/time-tracking/lib/timeReportRows';
import {
    flattenTimeReportToExcelRows,
    flattenExpenseReportToExcelRows,
    flattenUninvoicedToExcelRows,
    flattenBudgetToExcelRows,
} from '../lib/reportPreviewApiToExcelRows';
import { mergeTimeEntryResponseIntoRow, previewRowAfterCreate, timeExcelPreviewRowToCreateBody, timeExcelPreviewRowToPatchBody, } from '../lib/reportPreviewTimeEntrySave';
import { localYmdAndHmToIso, } from '../lib/briefRecordDateTimeEdit';
import type { TimeExcelPreviewRow, ExpenseExcelPreviewRow, UninvoicedExcelPreviewRow, BudgetExcelPreviewRow, } from '../lib/previewExcelTypes';
import { useCurrentUser } from '@shared/hooks';
import { AppPageSettings, useAppDialog } from '@shared/ui';
import '@pages/time-tracking/ui/TimeTrackingPage.css';
import './ReportPreviewPage.css';
const REPORTS_TAB_URL = `${routes.timeTracking}?tab=reports`;
function stripReportPagination(filters: ReportFiltersV2): ReportFiltersV2 {
    const { page: _pg, per_page: _pp, ...rest } = filters;
    return rest;
}
function previewProjectOptionLabel(p: ProjectOption): string {
    return p.client ? `${p.name} — ${p.client}` : p.name;
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
function buildApiFilters(xfer: ReportPreviewTransferV2, rangeFrom: string, rangeTo: string, selectedProjectId: string, selectedClientId: string): Omit<ReportFiltersV2, 'page' | 'per_page'> {
    const base = stripReportPagination(xfer.filters);
    const out: Omit<ReportFiltersV2, 'page' | 'per_page'> = { ...base, dateFrom: rangeFrom, dateTo: rangeTo };
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
        /* ignore */
    }
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
function ReportPreviewPartnerBar({ projectId, dateFrom, dateTo, userId, }: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    userId: number | null;
}) {
    const { showAlert } = useAppDialog();
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);
    const partnerModalPanelRef = useRef<HTMLDivElement>(null);
    const [partners, setPartners] = useState<ProjectPartnerAccessRow[]>([]);
    const [partnersLoad, setPartnersLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('loading');
    const [pendingReqs, setPendingReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [confirmedReqs, setConfirmedReqs] = useState<PartnerReportConfirmationRequest[]>([]);
    const [listsLoad, setListsLoad] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [sessionSnapshot, setSessionSnapshot] = useState<PartnerReportConfirmationRequest | null>(null);
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
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
            listPartnerReportConfirmationsPending(),
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
            listPartnerReportConfirmationsPending(),
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
        <button type="button" className="tt-rp-preview__partner-trigger" onClick={() => setPartnerModalOpen(true)} aria-haspopup="dialog" aria-expanded={partnerModalOpen}>
          <span className="tt-rp-preview__partner-trigger-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </span>
          <span className="tt-rp-preview__partner-trigger-label">Подтверждение отчёта</span>
          {triggerBadge}
        </button>
      </div>
      {modal}
    </>);
}
export type ReportPreviewNavBarPeriod = {
    from: string;
    to: string;
    onFromChange: (iso: string) => void;
    onToChange: (iso: string) => void;
    disabled?: boolean;
};
export type ReportPreviewNavBarProps = {
    period?: ReportPreviewNavBarPeriod | null;
    hint?: string | null;
    hintTitle?: string | null;
    projectSlot?: ReactNode;
    
    timeReportViewSlot?: ReactNode;
};
export function ReportPreviewNavBar({ period, hint, hintTitle, projectSlot, timeReportViewSlot }: ReportPreviewNavBarProps) {
    const rangeId = useId();
    const onLeave = () => {
        void clearReportPreviewTransfer();
    };
    return (<nav className="time-page__navbar tt-rp-preview__navbar" aria-label="Предпросмотр отчёта">
      <Link to={REPORTS_TAB_URL} className="time-page__back-btn" onClick={onLeave}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m15 18-6-6 6-6"/>
        </svg>
        <span className="time-page__back-label">Назад</span>
      </Link>
      <div className="time-page__navbar-sep" aria-hidden="true"/>
      <div className="time-page__navbar-tabs" role="tablist" aria-label="Текущий раздел">
        <span className="time-page__navbar-tab time-page__navbar-tab--active" role="tab" aria-selected="true" tabIndex={-1}>
          Предпросмотр
        </span>
      </div>
      {period ? (<div className="tt-reports__date-range tt-rp-preview__navbar-dates" aria-label="Период отчёта">
          <div className="tt-reports__date-field">
            <span className="tt-reports__date-field-label" id={`${rangeId}-from`}>
              С
            </span>
            <DatePicker value={period.from} max={period.to} onChange={period.onFromChange} disabled={Boolean(period.disabled)} aria-labelledby={`${rangeId}-from`} portal buttonClassName="tt-reports__date-picker-btn"/>
          </div>
          <div className="tt-reports__date-field">
            <span className="tt-reports__date-field-label" id={`${rangeId}-to`}>
              По
            </span>
            <DatePicker value={period.to} min={period.from} onChange={period.onToChange} disabled={Boolean(period.disabled)} aria-labelledby={`${rangeId}-to`} portal buttonClassName="tt-reports__date-picker-btn"/>
          </div>
        </div>) : null}
      {timeReportViewSlot ? (<div className="tt-rp-preview__navbar-view-slot">{timeReportViewSlot}</div>) : null}
      <div className="time-page__navbar-spacer"/>
      <div className="time-page__navbar-settings">
        <AppPageSettings />
      </div>
      {projectSlot !== undefined
        ? projectSlot
        : hint
            ? (<span className="tt-rp-preview__navbar-hint" title={hintTitle ?? undefined}>{hint}</span>)
            : null}
    </nav>);
}
function persistXferFilters(xfer: ReportPreviewTransferV2, filters: ReportFiltersV2, listPerPage: number): void {
    const paged: ReportFiltersV2 = { ...filters, page: 1, per_page: listPerPage };
    if (xfer.reportType === 'time') {
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'time',
            groupBy: xfer.groupBy,
            filters: paged,
        });
        return;
    }
    if (xfer.reportType === 'expenses') {
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'expenses',
            groupBy: xfer.groupBy,
            filters: paged,
        });
        return;
    }
    if (xfer.reportType === 'uninvoiced') {
        writeReportPreviewTransfer({ v: 2, reportType: 'uninvoiced', filters: paged });
        return;
    }
    writeReportPreviewTransfer({ v: 2, reportType: 'project-budget', filters: paged });
}
export function ReportPreviewPage() {
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const [reportPageSizeMax, setReportPageSizeMax] = useState<number | null>(null);
    const listPerPage = useMemo(() => {
        const cap = reportPageSizeMax != null && reportPageSizeMax > 0 ? Math.min(reportPageSizeMax, 5000) : 500;
        return Math.min(500, cap);
    }, [reportPageSizeMax]);
    const [loading, setLoading] = useState(true);
    const [xferSnapshot, setXferSnapshot] = useState<ReportPreviewTransferV2 | null>(null);
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [projectPartnersForEmployeePick, setProjectPartnersForEmployeePick] = useState<ProjectPartnerAccessRow[]>([]);
    const [projectPartnersPickLoading, setProjectPartnersPickLoading] = useState(false);
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
    const [timeEntrySaveUI, setTimeEntrySaveUI] = useState<'idle' | 'saving' | 'saved' | 'err'>(() => 'idle');
    const [timeEntrySaveMessage, setTimeEntrySaveMessage] = useState<string | null>(null);
    const [timeEntryActionPendingRowKey, setTimeEntryActionPendingRowKey] = useState<string | null>(null);
    const [editUnlockPendingCompoundKey, setEditUnlockPendingCompoundKey] = useState<string | null>(null);
    useLayoutEffect(() => {
        timeExcelRowsRef.current = timeExcelRows;
    }, [timeExcelRows]);
    useEffect(() => {
        return () => {
            for (const t of timeEntrySaveTimers.current.values())
                clearTimeout(t);
            timeEntrySaveTimers.current.clear();
        };
    }, []);
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
            setLoading(false);
            return;
        }
        const xfer = normalizeReportPreviewTransfer(raw);
        const base = stripReportPagination(xfer.filters);
        setXferSnapshot(xfer);
        setRangeFrom(base.dateFrom);
        setRangeTo(base.dateTo);
        const pid = typeof base.project_id === 'string' && base.project_id.trim() ? base.project_id.trim() : '';
        setSelectedProjectId(pid);
        const clid = typeof base.client_id === 'string' && base.client_id.trim() ? base.client_id.trim() : '';
        setSelectedClientId(clid);
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
        void loadTimesheetProjectOptions(user).then(({ items, error }) => {
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
            setProjectPartnersForEmployeePick([]);
            setProjectPartnersPickLoading(false);
            return;
        }
        const pid = selectedProjectId.trim();
        if (!pid) {
            setProjectPartnersForEmployeePick([]);
            setProjectPartnersPickLoading(false);
            return;
        }
        let cancelled = false;
        setProjectPartnersPickLoading(true);
        void listPartnerUsersWithProjectAccessToProject(pid)
            .then((partners) => {
                if (!cancelled)
                    setProjectPartnersForEmployeePick(partners);
            })
            .catch(() => {
                if (!cancelled)
                    setProjectPartnersForEmployeePick([]);
            })
            .finally(() => {
                if (!cancelled)
                    setProjectPartnersPickLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [xferSnapshot, selectedProjectId]);
    useEffect(() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo)
            return;
        const cur = stripReportPagination(xferSnapshot.filters);
        const nextPid = selectedProjectId || '';
        const nextCid = selectedClientId || '';
        const curPid = typeof cur.project_id === 'string' ? cur.project_id : '';
        const curCid = typeof cur.client_id === 'string' ? cur.client_id : '';
        const t = xferSnapshot.reportType === 'time';
        const timeGb = t ? xferSnapshot.groupBy : null;
        if (cur.dateFrom === rangeFrom && cur.dateTo === rangeTo) {
            if (timeGb === 'clients' && curCid === nextCid)
                return;
            if (timeGb === 'projects' && curPid === nextPid)
                return;
            if (!t && curPid === nextPid)
                return;
        }
        const filters: ReportFiltersV2 = {
            ...cur,
            dateFrom: rangeFrom,
            dateTo: rangeTo,
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
        };
        if (xferSnapshot.reportType === 'time' && xferSnapshot.groupBy === 'clients') {
            if (selectedClientId)
                filters.client_id = selectedClientId;
            else
                delete filters.client_id;
            delete filters.project_id;
        }
        else if (xferSnapshot.reportType === 'time' && xferSnapshot.groupBy === 'projects') {
            if (selectedProjectId)
                filters.project_id = selectedProjectId;
            else
                delete filters.project_id;
            delete filters.client_id;
        }
        else {
            if (selectedProjectId)
                filters.project_id = selectedProjectId;
            else
                delete filters.project_id;
        }
        persistXferFilters(xferSnapshot, filters, listPerPage);
        setXferSnapshot((prev) => {
            if (!prev)
                return prev;
            return { ...prev, filters: { ...filters, page: 1, per_page: listPerPage } };
        });
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, listPerPage, reportPageSizeMax]);
    const previewDataResetKey = useMemo(() => {
        if (!xferSnapshot)
            return '';
        if (xferSnapshot.reportType === 'time')
            return `time|${rangeFrom}|${rangeTo}|p:${selectedProjectId}|c:${selectedClientId}|${xferSnapshot.groupBy}`;
        return `${xferSnapshot.reportType}|${rangeFrom}|${rangeTo}`;
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId]);
    useEffect(() => {
        setSelectedUserName(null);
        setEmployeeExcluded(new Set());
        setEmployeeSortAsc(true);
    }, [previewDataResetKey]);
    const onPreviewFrom = useCallback((iso: string) => {
        setRangeFrom(iso);
        setRangeTo((t) => (iso > t ? iso : t));
    }, []);
    const onPreviewTo = useCallback((iso: string) => {
        setRangeTo(iso);
        setRangeFrom((f) => (iso < f ? iso : f));
    }, []);
    const onProjectPick = useCallback((id: string) => {
        setSelectedProjectId(id);
    }, []);
    const projectItemsForSelect = useMemo((): ProjectOption[] => {
        const list = projectOptions;
        if (!selectedProjectId || list.some((p) => p.id === selectedProjectId))
            return list;
        return [{
                id: selectedProjectId,
                name: selectedProjectId,
                client: '',
                clientId: '',
                color: 'hsl(220 14% 46%)',
                currency: 'USD',
            }, ...list];
    }, [projectOptions, selectedProjectId]);
    const timeProjectTitle = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || !rangeFrom || !rangeTo)
            return '';
        const sel = projectItemsForSelect.find((p) => p.id === selectedProjectId);
        return sel
            ? previewProjectOptionLabel(sel)
            : selectedProjectId
                ? `Проект ${selectedProjectId}`
                : 'Все проекты (по фильтрам)';
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, projectItemsForSelect]);
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
            return;
        }
        let cancelled = false;
        setReportLoading(true);
        setReportError(null);
        setTimeExcelRows([]);
        setExpenseExcelRows([]);
        setUninvoicedExcelRows([]);
        setBudgetExcelRows([]);
        const apiFilters: Omit<ReportFiltersV2, 'page' | 'per_page'> = {
            ...buildApiFilters(xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId),
            pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
        };
        void (async () => {
            try {
                if (xferSnapshot.reportType === 'time') {
                    const gb = xferSnapshot.groupBy as TimeGroup;
                    const raw = gb === 'clients'
                        ? await fetchAllTimeReportClientRows(apiFilters)
                        : await fetchAllTimeReportProjectRows(apiFilters);
                    const sorted = sortTimeReportRowsForDisplay(gb, raw);
                    if (!cancelled)
                        setTimeExcelRows(flattenTimeReportToExcelRows(gb, sorted));
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
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId, selectedClientId, serverDataRefreshNonce, reportPageSizeMax]);
    const requestServerDataReload = useCallback(() => {
        setServerDataRefreshNonce((n) => n + 1);
    }, []);
    const canOverrideWeeklyLock = canOverrideReportPreviewWeeklyLock(user);
    const flushPersistTimeEntry = useCallback(async (rowKey: string) => {
        const row = timeExcelRowsRef.current.find((r) => r.rowKey === rowKey);
        if (!row || row.rowKind !== 'entry' || !row.timeEntryId?.trim()) {
            return;
        }
        if (row.isVoided)
            return;
        const wd = (row.workDate || '').trim().slice(0, 10);
        if (wd && isClosedReportingWeekEditingBlockedForSubject(row.authUserId, wd, canOverrideWeeklyLock)) {
            return;
        }
        setTimeEntrySaveUI('saving');
        setTimeEntrySaveMessage(null);
        try {
            const body = timeExcelPreviewRowToPatchBody(row);
            const updated = await patchTimeEntry(row.authUserId, row.timeEntryId, body);
            const merged = mergeTimeEntryResponseIntoRow(updated);
            setTimeExcelRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...merged } : r)));
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage('Запись сохранена');
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись сохранена' ? null : m));
            }, 3200);
        }
        catch (e) {
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
        const prevT = timeEntrySaveTimers.current.get(rowKey);
        if (prevT)
            clearTimeout(prevT);
        timeEntrySaveTimers.current.set(rowKey, setTimeout(() => {
            timeEntrySaveTimers.current.delete(rowKey);
            void flushPersistTimeEntry(rowKey);
        }, 750));
    }, [flushPersistTimeEntry]);
    const patchTimeExcel = useCallback((rowKey: string, patch: Partial<TimeExcelPreviewRow>) => {
        setTimeExcelRows((prev) => {
            const next = prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r));
            timeExcelRowsRef.current = next;
            const merged = next.find((x) => x.rowKey === rowKey) ?? null;
            if (merged && merged.rowKind === 'entry' && merged.timeEntryId?.trim() && !merged.isVoided) {
                const nextWd = (merged.workDate || '').trim().slice(0, 10);
                const blocked = Boolean(nextWd && isClosedReportingWeekEditingBlockedForSubject(merged.authUserId, nextWd, canOverrideWeeklyLock));
                if (!blocked)
                    schedulePersistTimeEntry(rowKey);
            }
            return next;
        });
    }, [schedulePersistTimeEntry, canOverrideWeeklyLock]);
    const handleDeleteTimeEntry = useCallback(async (rowKey: string) => {
        const confirmed = await showConfirm({
            title: 'Удалить запись времени?',
            message: 'Действие нельзя отменить.',
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
        const wd = (row.workDate || '').trim().slice(0, 10);
        if (wd && isClosedReportingWeekEditingBlockedForSubject(row.authUserId, wd, canOverrideWeeklyLock)) {
            await showAlert({
                message: 'Неделя по дате записи закрыта на сервере — удаление недоступно. Можно сменить дату на день из открытого периода, затем удалить.',
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
            const afterDelete = await deleteTimeEntry(row.authUserId, row.timeEntryId);
            if (afterDelete == null) {
                setTimeExcelRows((prev) => {
                    const next = prev.filter((r) => r.rowKey !== rowKey);
                    timeExcelRowsRef.current = next;
                    return next;
                });
                setTimeEntrySaveUI('saved');
                setTimeEntrySaveMessage('Запись удалена');
            }
            else {
                const merged = mergeTimeEntryResponseIntoRow(afterDelete);
                setTimeExcelRows((prev) => {
                    const next = prev.map((r) => (r.rowKey === rowKey ? { ...r, ...merged } : r));
                    timeExcelRowsRef.current = next;
                    return next;
                });
                setTimeEntrySaveUI('saved');
                setTimeEntrySaveMessage('Запись снята с учёта');
            }
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (m === 'Запись удалена' || m === 'Запись снята с учёта' ? null : m));
            }, 2800);
        }
        catch (e) {
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось удалить запись';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
        }
        finally {
            setTimeEntryActionPendingRowKey(null);
        }
    }, [canOverrideWeeklyLock, showAlert, showConfirm]);
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
            const updated = await patchTimeEntry(row.authUserId, row.timeEntryId, { projectId: newProjectId });
            const base = mergeTimeEntryResponseIntoRow(updated);
            let taskName = row.taskName;
            let taskId = String(base.taskId ?? row.taskId ?? '').trim();
            if (opt.clientId) {
                try {
                    const tasks = await listClientTasks(opt.clientId);
                    const match = taskId
                        ? tasks.find((x) => String(x.id) === taskId)
                        : tasks[0];
                    if (match) {
                        taskId = match.id;
                        taskName = match.name;
                    }
                }
                catch {
                }
            }
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
    }, [user, addEntryProjectOption, rangeFrom, rangeTo, canOverrideWeeklyLock, showAlert]);
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
            const newRow = previewRowAfterCreate(row, tr, { recordedAt: recordedAtIso });
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
    }, [canOverrideWeeklyLock, rangeFrom, rangeTo, showAlert]);
    const handleGrantEditUnlock = useCallback(async (authUserId: number, workDateYmd: string) => {
        const wd = workDateYmd.trim().slice(0, 10);
        const compound = `${authUserId}:${wd}`;
        setEditUnlockPendingCompoundKey(compound);
        setTimeEntrySaveMessage(null);
        try {
            const out = await grantTimeEntryEditUnlock(authUserId, wd);
            const until = new Date(out.expiresAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
            setTimeEntrySaveUI('saved');
            setTimeEntrySaveMessage(`Разблокировка активна до ${until}`);
            setTimeout(() => {
                setTimeEntrySaveUI((u) => (u === 'saved' ? 'idle' : u));
                setTimeEntrySaveMessage((m) => (typeof m === 'string' && m.startsWith('Разблокировка активна') ? null : m));
            }, 4200);
        }
        catch (e) {
            const msg = isTimeTrackingHttpError(e)
                ? e.message
                : e instanceof Error
                    ? e.message
                    : 'Не удалось выдать разблокировку';
            setTimeEntrySaveUI('err');
            setTimeEntrySaveMessage(msg);
        }
        finally {
            setEditUnlockPendingCompoundKey(null);
        }
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
    const timeUniqueNames = useMemo(() => uniqueSortedEmployeeNames(timeExcelRows), [timeExcelRows]);
    const expenseUniqueNames = useMemo(() => uniqueSortedEmployeeNames(expenseExcelRows), [expenseExcelRows]);
    const uninvoicedUniqueNames = useMemo(() => uniqueSortedEmployeeNames(uninvoicedExcelRows), [uninvoicedExcelRows]);
    const budgetUniqueNames = useMemo(() => uniqueSortedEmployeeNames(budgetExcelRows), [budgetExcelRows]);
    const timeDisplayRows = useMemo(() => {
        const base = timeExcelRows.filter((r) => !employeeExcluded.has(r.userName));
        return sortRowsByUserName(base, employeeSortAsc);
    }, [timeExcelRows, employeeExcluded, employeeSortAsc]);
    const timeEmployeePartnerPick = useMemo(() => {
        if (!xferSnapshot || xferSnapshot.reportType !== 'time' || xferSnapshot.groupBy !== 'projects')
            return null;
        if (!selectedProjectId.trim())
            return null;
        return {
            loading: projectPartnersPickLoading,
            partners: projectPartnersForEmployeePick,
        };
    }, [xferSnapshot, selectedProjectId, projectPartnersPickLoading, projectPartnersForEmployeePick]);
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
    const timeExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={timeUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc} tableNameSearch={{ value: timeBriefEmployeeSearch, onChange: setTimeBriefEmployeeSearch }}/>), [timeUniqueNames, employeeExcluded, employeeSortAsc, timeBriefEmployeeSearch]);
    const expenseExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={expenseUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc}/>), [expenseUniqueNames, employeeExcluded, employeeSortAsc]);
    const uninvoicedExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={uninvoicedUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc}/>), [uninvoicedUniqueNames, employeeExcluded, employeeSortAsc]);
    const budgetExcelFilterSlot = useMemo(() => (<ReportPreviewEmployeeExcelFilter uniqueNames={budgetUniqueNames} excludedNames={employeeExcluded} onExcludedChange={setEmployeeExcluded} sortAsc={employeeSortAsc} onSortAscChange={setEmployeeSortAsc}/>), [budgetUniqueNames, employeeExcluded, employeeSortAsc]);
    const liveTitle = xferSnapshot ? previewLiveTitle(xferSnapshot) : '';
    const xferExists = readReportPreviewTransfer() != null;
    const confirmationProjectId = useMemo(() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo)
            return '';
        return reportPreviewConfirmationProjectId(xferSnapshot, selectedProjectId);
    }, [xferSnapshot, rangeFrom, rangeTo, selectedProjectId]);
    if (loading) {
        return (<div className="tt-rp-preview tt-rp-preview--fill" role="status" aria-live="polite">
        <ReportPreviewNavBar />
        <div className="tt-rp-preview__main tt-rp-preview__main--fill tt-rp-preview__body-pad">
          <ReportPreviewMockSkeleton variant="generic" label="Загрузка предпросмотра…"/>
        </div>
      </div>);
    }
    if (!xferExists && !xferSnapshot) {
        return (<div className="tt-rp-preview">
        <ReportPreviewNavBar />
        <div className="tt-rp-preview__main">
          <div className="tt-rp-preview__empty">
            <p>
              Откройте «Отчёты» в учёте времени и нажмите «Предпросмотр» — передаются текущий вид отчёта, разрез и
              фильтры.
            </p>
            <Link className="tt-rp-preview__btn tt-rp-preview__btn--accent" to={REPORTS_TAB_URL}>
              Перейти к отчётам
            </Link>
          </div>
        </div>
      </div>);
    }
    const navPeriodControls = xferSnapshot && rangeFrom && rangeTo
        ? {
            from: rangeFrom,
            to: rangeTo,
            onFromChange: onPreviewFrom,
            onToChange: onPreviewTo,
            disabled: false,
        }
        : null;
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
                : (<div className="tt-rp-preview__navbar-project" title="Выбор проекта (фильтр сохраняется для возврата в отчёты).">
            <SearchableSelect<ProjectOption> portalDropdown className="tt-rp-preview__navbar-project-select" buttonClassName="tt-rp-preview__navbar-project-btn" aria-label="Проект" disabled={projectsLoading || projectItemsForSelect.length === 0} placeholder={projectsLoading ? 'Загрузка проектов…' : projectItemsForSelect.length === 0 ? 'Нет проектов' : 'Найдите или выберите проект…'} emptyListText={projectsLoading ? 'Загрузка…' : 'Нет доступных проектов'} noMatchText="Проект не найден" value={selectedProjectId} items={projectItemsForSelect} getOptionValue={(p) => p.id} getOptionLabel={previewProjectOptionLabel} getSearchText={(p) => `${p.name} ${p.client}`.replace(/\s+/g, ' ').trim()} onSelect={(p) => onProjectPick(p.id)}/>
          </div>))
            : undefined;
    const mainBody = (() => {
        if (!xferSnapshot || !rangeFrom || !rangeTo)
            return (<p className="tt-rp-preview__muted tt-rp-preview__no-table-msg">Укажите период (даты «С» и «По»).</p>);
        if (reportLoading)
            return (<ReportPreviewMockSkeleton variant="generic" label="Загрузка отчёта…"/>);
        if (reportError)
            return (<div className="tt-reports__table-err" role="alert">{reportError}</div>);
        if (xferSnapshot.reportType === 'time') {
            if (timeExcelRows.length === 0)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            const showTimeLiveTitle = xferSnapshot.groupBy !== 'projects';
            return (<>
          {showTimeLiveTitle ? (<p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>) : null}
          <TimeExcelPreviewTable projectTitle={timePreviewTableTitle} viewMode={timeReportViewMode} rows={timeDisplayRows} onPatch={patchTimeExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={timeExcelFilterSlot} briefEmployeeQuery={timeBriefEmployeeSearch} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading} timeSave={{ ui: timeEntrySaveUI, message: timeEntrySaveMessage }} canOverrideClosedWeek={canOverrideWeeklyLock} moveProjectOptions={user ? projectItemsForSelect : undefined} onDeleteTimeEntry={user ? handleDeleteTimeEntry : undefined} onMoveTimeEntryToProject={user ? handleMoveTimeEntryToProject : undefined} onDuplicateTimeEntry={user ? handleDuplicateTimeEntry : undefined} onGrantEditUnlock={user ? handleGrantEditUnlock : undefined} canGrantEditUnlockForTarget={user ? (tid) => canGrantTimeEntryEditUnlock(user, tid) : undefined} editUnlockPendingCompoundKey={editUnlockPendingCompoundKey} onAddTimeEntry={user ? handleAddTimeEntry : undefined} timeEntryWorkDateBounds={{ min: rangeFrom.slice(0, 10), max: rangeTo.slice(0, 10) }} timeEntryActionPendingRowKey={timeEntryActionPendingRowKey} employeePartnerPick={timeEmployeePartnerPick}/>
        </>);
        }
        if (xferSnapshot.reportType === 'expenses') {
            if (expenseExcelRows.length === 0)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (<>
          <p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>
          <ExpenseExcelPreviewTable rows={expenseDisplayRows} onPatch={patchExpenseExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={expenseExcelFilterSlot} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading}/>
        </>);
        }
        if (xferSnapshot.reportType === 'uninvoiced') {
            if (uninvoicedExcelRows.length === 0)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (<>
          <p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>
          <UninvoicedExcelPreviewTable rows={uninvoicedDisplayRows} onPatch={patchUninvoicedExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={uninvoicedExcelFilterSlot} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading}/>
        </>);
        }
        if (xferSnapshot.reportType === 'project-budget') {
            if (budgetExcelRows.length === 0)
                return reportPreviewEmptyBlock(rangeFrom, rangeTo);
            return (<>
          <p className="tt-rp-preview__live-title tt-rp-preview__live-title--inline">{liveTitle}</p>
          <BudgetExcelPreviewTable rows={budgetDisplayRows} onPatch={patchBudgetExcel} selectedUserName={selectedUserName} onSelectUserName={setSelectedUserName} employeeColumnFilterSlot={budgetExcelFilterSlot} onRequestServerReload={requestServerDataReload} serverReloadBusy={reportLoading}/>
        </>);
        }
        return null;
    })();
    return (<div className="tt-rp-preview tt-rp-preview--fill">
      <ReportPreviewNavBar period={navPeriodControls} projectSlot={navProjectSlot} timeReportViewSlot={timeReportViewToggle ?? undefined}/>

      <div className="tt-rp-preview__main tt-rp-preview__main--fill tt-rp-preview__body-pad">
        {confirmationProjectId ? (<ReportPreviewPartnerBar projectId={confirmationProjectId} dateFrom={rangeFrom} dateTo={rangeTo} userId={user?.id ?? null}/>) : null}
        <div className={`tt-rp-preview__live${xferSnapshot && (xferSnapshot.reportType === 'time' || xferSnapshot.reportType === 'expenses' || xferSnapshot.reportType === 'uninvoiced' || xferSnapshot.reportType === 'project-budget') ? ' tt-rp-preview__live--sheet' : ''}`}>
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
