import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { getInvoiceDetailUrl, getInvoicesListUrl, getProjectDetailUrl, routes } from '@shared/config';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { AppBackButton, AppHomeLogo, AppPageSettings, useAppDialog, useAppToast } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import {
  createInvoice,
  fetchUnbilledTimeEntries,
  fetchUnbilledExpenses,
  getReportSnapshot,
  listPartnerReportConfirmationsConfirmed,
  listAllTimeManagerClientsMerged,
  listAllClientProjectsMerged,
  listAllClientProjectsForClientMerged,
  isForbiddenError,
  writeInvoicePreviewSession,
  readInvoicePreviewSession,
  isInvoicePreviewSessionCreate,
  type TimeManagerClientRow,
  type TimeManagerClientProjectRow,
  type UnbilledTimeEntryDto,
  type UnbilledExpenseEntryDto,
  type PartnerReportConfirmationRequest,
} from '@entities/time-tracking';
import { collectClientIdsFromProjects, isActiveTimeManagerClientRow, isActiveTimeManagerProjectRow } from '@entities/time-tracking/lib/projectTimeEntry';
import { loadSnapshotRowsForPartnerExcel } from '@entities/time-tracking/lib/exportPartnerConfirmedSnapshotExcel';
import { formatHM } from '@shared/lib/formatTrackingHours';
import {
  addDaysIso,
  firstOfMonthIso,
  fmtMoney,
  lastOfMonthIso,
  notifyReportsInvalidated,
  todayIso,
} from '../lib/invoicePageShared';
import { invoiceClientDescription } from '../lib/invoiceClientDescription';
import {
  collectConfirmedSnapshotTimeEntryIds,
  intersectPreviewTimeEntryIdsWithSnapshot,
} from '../lib/confirmedSnapshotInvoiceLines';
import './TimeTrackingPage.css';
import './TimesheetPanel.css';
import './InvoicePage.css';

const IcoRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

export function InvoiceCreatePage() {
  const { t, locale } = useI18n();
  const { user, loading: userLoading } = useCurrentUser();
  const { showAlert } = useAppDialog();
  const { pushToast } = useAppToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeLoadProjectIdRef = useRef<string | null>(null);
  const resumeAppliedRef = useRef(false);

  const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
  const [activeProjectsAll, setActiveProjectsAll] = useState<TimeManagerClientProjectRow[]>([]);
  const [clientIdsWithActiveProjects, setClientIdsWithActiveProjects] = useState<Set<string>>(() => new Set());
  const [confirmedReportsForCreate, setConfirmedReportsForCreate] = useState<PartnerReportConfirmationRequest[]>([]);
  const [confirmedProjectIdsForCreate, setConfirmedProjectIdsForCreate] = useState<Set<string>>(() => new Set());
  const [confirmedClientIdsForCreate, setConfirmedClientIdsForCreate] = useState<Set<string>>(() => new Set());
  const [clientsErr, setClientsErr] = useState<string | null>(null);
  const [createClientId, setCreateClientId] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [projects, setProjects] = useState<TimeManagerClientProjectRow[]>([]);
  const [unbilledFrom, setUnbilledFrom] = useState(firstOfMonthIso());
  const [unbilledTo, setUnbilledTo] = useState(lastOfMonthIso());
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDaysIso(30));
  const [createInvoiceNumber, setCreateInvoiceNumber] = useState('');
  const [unbilledTime, setUnbilledTime] = useState<UnbilledTimeEntryDto[]>([]);
  const [unbilledExp, setUnbilledExp] = useState<UnbilledExpenseEntryDto[]>([]);
  const [selTime, setSelTime] = useState<Set<string>>(() => new Set());
  const [selExp, setSelExp] = useState<Set<string>>(() => new Set());
  const timeSelectAllRef = useRef<HTMLInputElement>(null);
  const expSelectAllRef = useRef<HTMLInputElement>(null);
  const [unbilledPartnerBlockReason, setUnbilledPartnerBlockReason] = useState<string | null>(null);
  const [unbilledLoading, setUnbilledLoading] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const clientsForCreate = useMemo(
    () => clients.filter((c) => clientIdsWithActiveProjects.has(c.id) && confirmedClientIdsForCreate.has(c.id)),
    [clients, clientIdsWithActiveProjects, confirmedClientIdsForCreate],
  );

  useEffect(() => {
    const ti = timeSelectAllRef.current;
    if (ti) {
      const n = unbilledTime.length;
      if (n === 0)
        ti.indeterminate = false;
      else {
        const c = unbilledTime.filter((x) => selTime.has(x.id)).length;
        ti.indeterminate = c > 0 && c < n;
      }
    }
    const ei = expSelectAllRef.current;
    if (ei) {
      const n = unbilledExp.length;
      if (n === 0)
        ei.indeterminate = false;
      else {
        const c = unbilledExp.filter((x) => selExp.has(x.id)).length;
        ei.indeterminate = c > 0 && c < n;
      }
    }
  }, [unbilledTime, unbilledExp, selTime, selExp]);

  useEffect(() => {
    Promise.all([
      listAllTimeManagerClientsMerged(false),
      listAllClientProjectsMerged(false),
    ])
      .then(([clientRows, projectRows]) => {
        const activeProjects = projectRows.filter((p) => isActiveTimeManagerProjectRow(p));
        setClients(clientRows.filter(isActiveTimeManagerClientRow));
        setActiveProjectsAll(activeProjects);
        setClientIdsWithActiveProjects(collectClientIdsFromProjects(activeProjects));
        setClientsErr(null);
      })
      .catch((e: unknown) => {
        setClients([]);
        setActiveProjectsAll([]);
        setClientIdsWithActiveProjects(new Set());
        setClientsErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noClientAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
      });
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void listPartnerReportConfirmationsConfirmed()
      .then((rows) => {
        if (cancelled)
          return;
        const confirmed = rows.filter((r) => String(r.status ?? '').trim().toLowerCase() === 'fully_confirmed');
        setConfirmedReportsForCreate(confirmed);
        const projectIds = new Set(confirmed.map((r) => String(r.projectId ?? '').trim()).filter(Boolean));
        const clientIds = new Set<string>();
        for (const p of activeProjectsAll) {
          if (projectIds.has(String(p.id)))
            clientIds.add(String(p.client_id));
        }
        setConfirmedProjectIdsForCreate(projectIds);
        setConfirmedClientIdsForCreate(clientIds);
      })
      .catch(() => {
        if (cancelled)
          return;
        setConfirmedReportsForCreate([]);
        setConfirmedProjectIdsForCreate(new Set());
        setConfirmedClientIdsForCreate(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectsAll]);

  useEffect(() => {
    setUnbilledPartnerBlockReason(null);
  }, [unbilledFrom, unbilledTo, createProjectId]);

  useEffect(() => {
    const pid = createProjectId.trim();
    if (!pid)
      return;
    const candidates = confirmedReportsForCreate.filter((r) => String(r.projectId ?? '').trim() === pid);
    if (candidates.length === 0)
      return;
    const latest = candidates.reduce((best, r) => {
      const bestTo = String(best.dateTo ?? '').slice(0, 10);
      const curTo = String(r.dateTo ?? '').slice(0, 10);
      return curTo > bestTo ? r : best;
    }, candidates[0]!);
    const nextFrom = String(latest.dateFrom ?? '').slice(0, 10);
    const nextTo = String(latest.dateTo ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(nextTo))
      return;
    if (unbilledFrom !== nextFrom)
      setUnbilledFrom(nextFrom);
    if (unbilledTo !== nextTo)
      setUnbilledTo(nextTo);
  }, [createProjectId, confirmedReportsForCreate, unbilledFrom, unbilledTo]);

  useEffect(() => {
    if (clientsErr)
      pushToast({ message: clientsErr, variant: 'warning' });
  }, [clientsErr, pushToast]);

  useEffect(() => {
    if (!createClientId) {
      setProjects([]);
      return;
    }
    listAllClientProjectsForClientMerged(createClientId)
      .then((rows) => setProjects(rows.filter((p) => isActiveTimeManagerProjectRow(p) && confirmedProjectIdsForCreate.has(String(p.id)))))
      .catch(() => setProjects([]));
  }, [createClientId, confirmedProjectIdsForCreate]);

  useEffect(() => {
    if (createClientId && !clientsForCreate.some((c) => c.id === createClientId))
      setCreateClientId('');
    if (createProjectId && !projects.some((p) => p.id === createProjectId))
      setCreateProjectId('');
  }, [createClientId, createProjectId, clientsForCreate, projects]);

  const requireFullyConfirmedPeriod = useCallback(async (projectIdRaw: string, fromRaw: string, toRaw: string): Promise<boolean> => {
    const projectId = projectIdRaw.trim();
    const from = fromRaw.trim().slice(0, 10);
    const to = toRaw.trim().slice(0, 10);
    if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      return false;
    const rows = await listPartnerReportConfirmationsConfirmed();
    return rows.some((r) =>
      String(r.projectId ?? '').trim() === projectId
      && String(r.dateFrom ?? '').slice(0, 10) === from
      && String(r.dateTo ?? '').slice(0, 10) === to
      && String(r.status ?? '').trim().toLowerCase() === 'fully_confirmed');
  }, []);

  const loadUnbilled = useCallback(async (opts?: { preserveSelections?: boolean }) => {
    if (!createProjectId) {
      await showAlert({ message: t('timeTrackingPage.invoices.errors.selectProjectUnbilled') });
      return;
    }
    setUnbilledLoading(true);
    try {
      setUnbilledPartnerBlockReason(null);
      const allowed = await requireFullyConfirmedPeriod(createProjectId, unbilledFrom, unbilledTo);
      if (!allowed) {
        const msg = t('timeTrackingPage.invoices.errors.confirmedOnlyRequired');
        setUnbilledTime([]);
        setUnbilledExp([]);
        setUnbilledPartnerBlockReason(msg);
        return;
      }
      const [timeRows, expRows] = await Promise.all([
        fetchUnbilledTimeEntries({ projectId: createProjectId, dateFrom: unbilledFrom, dateTo: unbilledTo }),
        fetchUnbilledExpenses({ projectId: createProjectId, dateFrom: unbilledFrom, dateTo: unbilledTo }),
      ]);

      let filteredTime = timeRows;
      const matchingConfirm = confirmedReportsForCreate.find((r) =>
        String(r.projectId ?? '').trim() === createProjectId.trim()
        && String(r.dateFrom ?? '').slice(0, 10) === unbilledFrom.trim().slice(0, 10)
        && String(r.dateTo ?? '').slice(0, 10) === unbilledTo.trim().slice(0, 10)
        && String(r.status ?? '').trim().toLowerCase() === 'fully_confirmed');
      const snapId = String(matchingConfirm?.snapshotId ?? '').trim();
      if (snapId) {
        try {
          const snapshot = await getReportSnapshot(snapId);
          const snapRows = await loadSnapshotRowsForPartnerExcel(snapId, snapshot);
          const snapTeIds = collectConfirmedSnapshotTimeEntryIds(snapRows);
          if (snapTeIds.length > 0) {
            const { timeEntryIds } = intersectPreviewTimeEntryIdsWithSnapshot(
              timeRows.map((r) => r.id),
              snapTeIds,
            );
            const keep = new Set(timeEntryIds);
            filteredTime = timeRows.filter((r) => keep.has(r.id));
          }
        }
        catch {
          /* keep unfiltered unbilled if snapshot load fails */
        }
      }

      setUnbilledTime(filteredTime);
      setUnbilledExp(expRows);
      if (!opts?.preserveSelections) {
        setSelTime(new Set());
        setSelExp(new Set());
      }
      else {
        const timeIds = new Set(filteredTime.map((r) => r.id));
        const expIds = new Set(expRows.map((r) => r.id));
        setSelTime((prev) => new Set([...prev].filter((id) => timeIds.has(id))));
        setSelExp((prev) => new Set([...prev].filter((id) => expIds.has(id))));
      }
    }
    catch (err: unknown) {
      setUnbilledTime([]);
      setUnbilledExp([]);
      if (isForbiddenError(err)) {
        const msg = err instanceof Error ? err.message.trim() : '';
        setUnbilledPartnerBlockReason(
          msg || t('timeTrackingPage.invoices.errors.unbilledAccessLimited'),
        );
      }
      else {
        setUnbilledPartnerBlockReason(null);
        await showAlert({ message: err instanceof Error ? err.message : t('timeTrackingPage.invoices.errors.unbilledLoadFailed') });
      }
    }
    finally {
      setUnbilledLoading(false);
    }
  }, [createProjectId, unbilledFrom, unbilledTo, confirmedReportsForCreate, requireFullyConfirmedPeriod, showAlert, t]);

  useEffect(() => {
    if (resumeAppliedRef.current)
      return;
    if (searchParams.get('resume') !== '1')
      return;
    const snap = readInvoicePreviewSession();
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('resume');
      return p;
    }, { replace: true });
    if (!isInvoicePreviewSessionCreate(snap))
      return;
    resumeAppliedRef.current = true;
    const f = snap.form;
    setCreateClientId(f.createClientId);
    setCreateProjectId(f.createProjectId);
    setUnbilledFrom(f.unbilledFrom);
    setUnbilledTo(f.unbilledTo);
    setIssueDate(f.issueDate);
    setDueDate(f.dueDate);
    setCreateInvoiceNumber((f.invoiceNumber ?? '').trim());
    setSelTime(new Set(f.selTime));
    setSelExp(new Set(f.selExp));
    resumeLoadProjectIdRef.current = f.createProjectId.trim() !== '' ? f.createProjectId : null;
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const want = resumeLoadProjectIdRef.current;
    if (want == null)
      return;
    if (createProjectId !== want)
      return;
    if (projects.length === 0)
      return;
    if (!projects.some((p) => p.id === want)) {
      resumeLoadProjectIdRef.current = null;
      return;
    }
    resumeLoadProjectIdRef.current = null;
    void loadUnbilled({ preserveSelections: true });
  }, [createProjectId, projects, loadUnbilled]);

  const openInvoicePreview = useCallback(() => {
    const clientRow = clients.find((c) => c.id === createClientId);
    const clientLabel = clientRow?.name?.trim();
    const proj = projects.find((p) => p.id === createProjectId);
    const projectLabel = proj
      ? (proj.code ? `${proj.name} (${proj.code})` : proj.name).trim()
      : undefined;
    writeInvoicePreviewSession({
      v: 1,
      mode: 'create',
      form: {
        createClientId,
        createProjectId,
        unbilledFrom,
        unbilledTo,
        issueDate,
        dueDate,
        selTime: [...selTime],
        selExp: [...selExp],
        ...(createInvoiceNumber.trim() ? { invoiceNumber: createInvoiceNumber.trim() } : {}),
      },
      meta: {
        ...(clientLabel ? { clientLabel } : {}),
        ...(projectLabel ? { projectLabel } : {}),
        ...(createInvoiceNumber.trim() ? { invoiceNumber: createInvoiceNumber.trim() } : {}),
      },
    });
    navigate(routes.timeTrackingInvoicePreview);
  }, [clients, createClientId, createProjectId, unbilledFrom, unbilledTo, issueDate, dueDate, createInvoiceNumber, selTime, selExp, projects, navigate]);

  const handleCreate = useCallback(async () => {
    if (!createClientId) {
      await showAlert({ message: t('timeTrackingPage.invoices.errors.selectClient') });
      return;
    }
    if (selTime.size === 0 && selExp.size === 0) {
      await showAlert({ message: t('timeTrackingPage.invoices.errors.selectLines') });
      return;
    }
    const billProjectId = createProjectId.trim();
    if (!billProjectId) {
      await showAlert({
        message: t('timeTrackingPage.invoices.errors.selectProject'),
      });
      return;
    }
    const confirmedAllowed = await requireFullyConfirmedPeriod(billProjectId, unbilledFrom, unbilledTo);
    if (!confirmedAllowed) {
      const msg = t('timeTrackingPage.invoices.errors.confirmedOnlyRequired');
      setUnbilledPartnerBlockReason(msg);
      await showAlert({ message: msg });
      return;
    }
    setCreateBusy(true);
    try {
      const manualNumber = createInvoiceNumber.trim();
      const clientRow = clients.find((c) => c.id === createClientId);
      const currency = String(clientRow?.currency ?? '').trim().toUpperCase() || undefined;
      const created = await createInvoice({
        clientId: createClientId,
        projectId: billProjectId,
        issueDate,
        dueDate,
        ...(manualNumber ? { invoiceNumber: manualNumber } : {}),
        ...(currency ? { currency } : {}),
        timeEntryIds: [...selTime],
        expenseIds: [...selExp],
        partnerBillingPeriodFrom: unbilledFrom.trim().slice(0, 10),
        partnerBillingPeriodTo: unbilledTo.trim().slice(0, 10),
      });
      notifyReportsInvalidated();
      navigate(getInvoiceDetailUrl(created.id), { replace: true });
    }
    catch (e) {
      const raw = e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.createFailed');
      const conflict = /409|уже существует|already exists/i.test(raw);
      const base = conflict ? t('timeTrackingPage.invoices.errors.invoiceNumberConflict') : raw;
      const hint = isForbiddenError(e)
        ? t('timeTrackingPage.invoices.errors.partnerConfirmHint')
        : '';
      await showAlert({ message: `${base}${hint}` });
    }
    finally {
      setCreateBusy(false);
    }
  }, [createClientId, createProjectId, issueDate, dueDate, createInvoiceNumber, selTime, selExp, unbilledFrom, unbilledTo, requireFullyConfirmedPeriod, clients, navigate, showAlert, t]);

  const toInvoices = () => {
    void navigate(getInvoicesListUrl());
  };

  if (userLoading) {
    return (
      <div className="time-page time-page--enter time-page--invoice-sub" role="status" aria-live="polite" aria-busy="true">
        <main className="time-page__main">
          <nav className="time-page__navbar" aria-label={t('timeTrackingPage.invoices.createPage.navAria')}>
            <AppBackButton onClick={toInvoices} label={t('timeTrackingPage.invoices.backToInvoices')} ariaLabel={t('timeTrackingPage.invoices.backToInvoices')} hideLabelOnMobile />
            <AppHomeLogo withSeparator />
            <div className="time-page__navbar-sep" aria-hidden="true" />
            <span className="time-page__navbar-title">{t('timeTrackingPage.invoices.createDialog.title')}</span>
            <div className="time-page__navbar-spacer" />
            <div className="time-page__navbar-settings"><AppPageSettings /></div>
          </nav>
          <div className="time-page__content time-page__content--enter">
            <p className="tt-inv__muted">{t('timeTrackingPage.common.loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user || !canAccessTimeTracking(user))
    return <Navigate to={routes.home} replace />;

  return (
    <div className="time-page time-page--enter time-page--invoice-sub">
      <main className="time-page__main">
        <nav className="time-page__navbar" aria-label={t('timeTrackingPage.invoices.createPage.navAria')}>
          <AppBackButton
            onClick={toInvoices}
            label={t('timeTrackingPage.invoices.backToInvoices')}
            ariaLabel={t('timeTrackingPage.invoices.backToInvoices')}
            hideLabelOnMobile
          />
          <AppHomeLogo withSeparator />
          <div className="time-page__navbar-sep" aria-hidden="true" />
          <span className="time-page__navbar-title">{t('timeTrackingPage.invoices.createDialog.title')}</span>
          <div className="time-page__navbar-spacer" />
          <div className="time-page__navbar-settings">
            <AppPageSettings />
          </div>
        </nav>
        <div className="time-page__content time-page__content--enter tt-inv-page" role="region" aria-labelledby="tt-inv-create-title">
          <header className="tt-inv-page__header">
            <h1 id="tt-inv-create-title" className="tt-inv-page__title">{t('timeTrackingPage.invoices.createDialog.title')}</h1>
            <p className="tt-inv-page__sub">{t('timeTrackingPage.invoices.createDialog.subtitle')}</p>
          </header>

          <div className="tt-inv-page__body">
            <div className="tt-inv-dialog__section">
              <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2">
                <div className="tt-inv-dialog__field">
                  <label id="tt-inv-create-client-lbl" className="tt-inv-dialog__label" htmlFor="tt-inv-create-client-btn">{t('timeTrackingPage.invoices.createDialog.clientRequired')}</label>
                  <SearchableSelect<TimeManagerClientRow> className="tsp-srch tt-inv-dialog-searchable" buttonClassName="tsp-srch__btn tt-inv-dialog-searchable__btn" buttonId="tt-inv-create-client-btn" portalDropdown portalZIndex={12050} portalMinWidth={400} placeholder={clientsErr ? t('timeTrackingPage.invoices.createDialog.clientsLoadError') : clientsForCreate.length === 0 ? t('timeTrackingPage.invoices.createDialog.clientsLoading') : t('timeTrackingPage.invoices.createDialog.selectClient')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.clientNotFound')} value={createClientId} items={clientsForCreate} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={(c) => `${c.name} ${c.id}`.trim()} onSelect={(c) => {
                    setCreateClientId(c.id);
                    setCreateProjectId('');
                  }} disabled={Boolean(clientsErr) || clientsForCreate.length === 0} aria-labelledby="tt-inv-create-client-lbl" />
                </div>
                <div className="tt-inv-dialog__field">
                  <label id="tt-inv-create-project-lbl" className="tt-inv-dialog__label" htmlFor="tt-inv-create-project-btn">{t('timeTrackingPage.invoices.createDialog.project')}</label>
                  <SearchableSelect<TimeManagerClientProjectRow> className="tsp-srch tt-inv-dialog-searchable" buttonClassName="tsp-srch__btn tt-inv-dialog-searchable__btn" buttonId="tt-inv-create-project-btn" portalDropdown portalZIndex={12050} portalMinWidth={560} placeholder={!createClientId ? t('timeTrackingPage.common.selectClientFirst') : projects.length === 0 ? t('timeTrackingPage.common.noProjects') : t('timeTrackingPage.invoices.createDialog.selectProject')} emptyListText={t('timeTrackingPage.common.noProjects')} noMatchText={t('timeTrackingPage.common.projectNotFound')} value={createProjectId} items={projects} getOptionValue={(p) => p.id} getOptionLabel={(p) => p.code ? `${p.name} (${p.code})` : p.name} getSearchText={(p) => `${p.name} ${p.code ?? ''} ${p.id}`.trim()} onSelect={(p) => setCreateProjectId(p.id)} disabled={!createClientId} aria-labelledby="tt-inv-create-project-lbl" />
                </div>
              </div>
            </div>

            <div className="tt-inv-dialog__section">
              <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2">
                <div className="tt-inv-dialog__field">
                  <span id="tt-inv-issue-date-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.createDialog.issueDate')}</span>
                  <DatePicker id="tt-inv-issue-date" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={issueDate} max={dueDate || undefined} onChange={(iso) => setIssueDate(iso)} portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.createDialog.issueDate')} showChevron aria-labelledby="tt-inv-issue-date-lbl" />
                </div>
                <div className="tt-inv-dialog__field">
                  <span id="tt-inv-due-date-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.createDialog.dueDate')}</span>
                  <DatePicker id="tt-inv-due-date" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={dueDate} min={issueDate || undefined} onChange={(iso) => setDueDate(iso)} portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.createDialog.dueDate')} showChevron aria-labelledby="tt-inv-due-date-lbl" />
                </div>
              </div>
              <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2" style={{ marginTop: '0.75rem' }}>
                <div className="tt-inv-dialog__field">
                  <label className="tt-inv-dialog__label" htmlFor="tt-inv-create-number">{t('timeTrackingPage.invoices.createDialog.invoiceNumber')}</label>
                  <input
                    id="tt-inv-create-number"
                    type="text"
                    className="tt-inv-dialog__control"
                    value={createInvoiceNumber}
                    onChange={(e) => setCreateInvoiceNumber(e.target.value)}
                    placeholder={t('timeTrackingPage.invoices.createDialog.invoiceNumberPlaceholder')}
                    maxLength={64}
                    autoComplete="off"
                    disabled={createBusy}
                  />
                  <p className="tt-inv-dialog__section-desc" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                    {t('timeTrackingPage.invoices.createDialog.invoiceNumberHint')}
                  </p>
                </div>
              </div>
            </div>

            <div className="tt-inv-dialog__section tt-inv-dialog__section--callout">
              <p className="tt-inv-dialog__section-title">{t('timeTrackingPage.invoices.createDialog.unbilledSectionTitle')}</p>
              <p className="tt-inv-dialog__section-desc" style={{ marginTop: '0.35rem' }}>
                {t('timeTrackingPage.invoices.createDialog.unbilledReimbursableNote')}
              </p>
              <div className="tt-inv-dialog__period-bar">
                <div className="tt-inv-dialog__field">
                  <span id="tt-inv-unbill-from-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.createDialog.fromLabel')}</span>
                  <DatePicker id="tt-inv-unbill-from" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={unbilledFrom} max={unbilledTo || undefined} onChange={() => {}} disabled portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.createDialog.unbilledFrom')} showChevron aria-labelledby="tt-inv-unbill-from-lbl" />
                </div>
                <div className="tt-inv-dialog__field">
                  <span id="tt-inv-unbill-to-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.createDialog.toLabel')}</span>
                  <DatePicker id="tt-inv-unbill-to" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={unbilledTo} min={unbilledFrom || undefined} onChange={() => {}} disabled portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.createDialog.unbilledTo')} showChevron aria-labelledby="tt-inv-unbill-to-lbl" />
                </div>
                <div className="tt-inv-dialog__period-action">
                  <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => void loadUnbilled()} disabled={unbilledLoading || !createProjectId} title={!createProjectId ? t('timeTrackingPage.invoices.createDialog.selectProjectFirst') : t('timeTrackingPage.invoices.createDialog.loadUnbilledTitle')}>
                    <IcoRefresh />
                    {unbilledLoading ? t('timeTrackingPage.common.loading') : t('timeTrackingPage.invoices.createDialog.loadUnbilled')}
                  </button>
                </div>
              </div>
            </div>

            {unbilledPartnerBlockReason ? (
              <div className="tt-inv-dialog__section tt-inv-dialog__partner-gate" role="alert">
                <p className="tt-inv-dialog__section-desc" style={{ marginBottom: '0.75rem' }}>{unbilledPartnerBlockReason}</p>
                <p style={{ margin: 0 }} className="tt-inv-dialog__section-desc">
                  <Link className="tt-inv-dialog__partner-gate-link" to={`${routes.timeTracking}?tab=reports`}>{t('timeTrackingPage.invoices.createDialog.openReportsLink')}</Link>
                  {createProjectId.trim() !== '' ? (
                    <>
                      {' '}·{' '}
                      <Link className="tt-inv-dialog__partner-gate-link" to={getProjectDetailUrl(createProjectId.trim())}>
                        {t('timeTrackingPage.invoices.empty.projectCardLink')}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}

            {unbilledTime.length > 0 && (
              <div className="tt-inv-dialog__subsection">
                <h2 className="tt-inv__section-title">
                  {t('timeTrackingPage.invoices.createDialog.timeSection').replace('{count}', String(unbilledTime.length))}
                </h2>
                <div className="tt-reports__table-wrap tt-inv-page__table-wrap">
                  <table className="tt-inv-mini">
                    <thead>
                      <tr>
                        <th scope="col">
                          <input ref={timeSelectAllRef} type="checkbox" aria-label={t('timeTrackingPage.invoices.createDialog.timeSelectAll')} checked={unbilledTime.length > 0 && unbilledTime.every((x) => selTime.has(x.id))} onChange={() => {
                            setSelTime((prev) => {
                              const ids = unbilledTime.map((x) => x.id);
                              const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
                              if (allOn) {
                                const n = new Set(prev);
                                ids.forEach((id) => n.delete(id));
                                return n;
                              }
                              return new Set([...prev, ...ids]);
                            });
                          }} />
                        </th>
                        <th>{t('timeTrackingPage.invoices.createDialog.date')}</th>
                        <th title={t('timeTrackingPage.invoices.createDialog.durationTitle')}>{t('timeTrackingPage.invoices.createDialog.duration')}</th>
                        <th title={t('timeTrackingPage.invoices.createDialog.hoursTitle')}>{t('timeTrackingPage.invoices.createDialog.hours')}</th>
                        <th>{t('timeTrackingPage.invoices.createDialog.amount')}</th>
                        <th>{t('timeTrackingPage.invoices.createDialog.description')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unbilledTime.map((x) => {
                        const seconds = typeof x.durationSeconds === 'number' && Number.isFinite(x.durationSeconds)
                          ? x.durationSeconds
                          : Math.round(Number(x.hours) * 3600);
                        return (
                          <tr key={x.id}>
                            <td>
                              <input type="checkbox" checked={selTime.has(x.id)} onChange={() => setSelTime((prev) => {
                                const n = new Set(prev);
                                if (n.has(x.id))
                                  n.delete(x.id);
                                else
                                  n.add(x.id);
                                return n;
                              })} />
                            </td>
                            <td>{x.workDate}</td>
                            <td>{formatHM(seconds)}</td>
                            <td>{Number(x.hours).toFixed(2)}</td>
                            <td>{fmtMoney(x.billableAmount, x.currency, locale)}{x.packageCovered ? ` (${t('timeTrackingPage.invoices.createDialog.packageCovered')})` : ''}</td>
                            <td>{invoiceClientDescription(x.description) || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {unbilledExp.length > 0 && (
              <div className="tt-inv-dialog__subsection">
                <h2 className="tt-inv__section-title">{t('timeTrackingPage.invoices.createDialog.expensesSection').replace('{count}', String(unbilledExp.length))}</h2>
                <div className="tt-reports__table-wrap tt-inv-page__table-wrap">
                  <table className="tt-inv-mini">
                    <thead>
                      <tr>
                        <th scope="col">
                          <input ref={expSelectAllRef} type="checkbox" aria-label={t('timeTrackingPage.invoices.createDialog.expSelectAll')} checked={unbilledExp.length > 0 && unbilledExp.every((x) => selExp.has(x.id))} onChange={() => {
                            setSelExp((prev) => {
                              const ids = unbilledExp.map((x) => x.id);
                              const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
                              if (allOn) {
                                const n = new Set(prev);
                                ids.forEach((id) => n.delete(id));
                                return n;
                              }
                              return new Set([...prev, ...ids]);
                            });
                          }} />
                        </th>
                        <th>{t('timeTrackingPage.invoices.createDialog.date')}</th>
                        <th>{t('timeTrackingPage.invoices.createDialog.expAmountUsd')}</th>
                        <th>{t('timeTrackingPage.invoices.createDialog.expStatus')}</th>
                        <th>{t('timeTrackingPage.invoices.createDialog.description')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unbilledExp.map((x) => (
                        <tr key={x.id}>
                          <td>
                            <input type="checkbox" checked={selExp.has(x.id)} onChange={() => setSelExp((prev) => {
                              const n = new Set(prev);
                              if (n.has(x.id))
                                n.delete(x.id);
                              else
                                n.add(x.id);
                              return n;
                            })} />
                          </td>
                          <td>{String(x.expenseDate)}</td>
                          <td>{fmtMoney(x.equivalentAmount, 'USD', locale)}</td>
                          <td>{x.status}</td>
                          <td>{x.description ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <footer className="tt-inv-page__foot">
            <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => void openInvoicePreview()} disabled={createBusy} title={t('timeTrackingPage.invoices.createDialog.previewTitle')}>
              {t('timeTrackingPage.invoices.createDialog.preview')}
            </button>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={toInvoices} disabled={createBusy}>{t('timeTrackingPage.common.cancel')}</button>
            <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handleCreate()} disabled={createBusy}>
              {createBusy ? t('timeTrackingPage.invoices.createDialog.creating') : t('timeTrackingPage.invoices.createDialog.createDraft')}
            </button>
          </footer>
        </div>
      </main>
    </div>
  );
}
