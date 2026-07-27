import './TimesheetPanel.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes, getProjectDetailUrl, getInvoiceCreateUrl, getInvoiceDetailUrl } from '@shared/config';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { useAppDialog, useAppToast } from '@shared/ui';
import { useI18n, ttInvoiceStatusLabel } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import {
  listInvoices,
  getInvoicesAggregatedStats,
  aggregateInvoicesMoneyExcludingCanceled,
  deleteDraftInvoice,
  listAllTimeManagerClientsMerged,
  listAllClientProjectsMerged,
  listAllClientProjectsForClientMerged,
  listAllClientProjectsForPicker,
  isForbiddenError,
  INVOICE_STATUS_BADGE_CLASS,
  invoiceCanDeleteDraft,
  OPEN_INVOICE_DETAIL_QUERY,
  type InvoiceDto,
  type InvoiceUiStatus,
  type InvoicesAggregatedStats,
  type TimeManagerClientRow,
  type TimeManagerClientProjectRow,
} from '@entities/time-tracking';
import { isActiveTimeManagerClientRow, isActiveTimeManagerProjectRow } from '@entities/time-tracking/lib/projectTimeEntry';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { fmtMoney, fmtDisplayDate, notifyReportsInvalidated } from '../lib/invoicePageShared';
import { InvoiceRegistryPanel } from './InvoiceRegistryPanel';
import { InvoiceRegistryStatisticsPanel } from './InvoiceRegistryStatisticsPanel';

function invoiceListPartnerBillingGateOpts(projectFilter: string, listDateFrom: string, listDateTo: string): {
  partnerBillingProjectId?: string;
  partnerBillingPeriodFrom?: string;
  partnerBillingPeriodTo?: string;
} {
  const pid = projectFilter.trim();
  const from = listDateFrom.trim().slice(0, 10);
  const to = listDateTo.trim().slice(0, 10);
  if (!pid || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return {};
  return {
    partnerBillingProjectId: pid,
    partnerBillingPeriodFrom: from,
    partnerBillingPeriodTo: to,
  };
}

function applyInvoiceMutationToListRows(list: InvoiceDto[], inv: InvoiceDto): InvoiceDto[] {
  return list.map((row) => {
    if (row.id !== inv.id)
      return row;
    return {
      ...row,
      status: inv.status,
      storedStatus: inv.storedStatus,
      totalAmount: inv.totalAmount,
      amountPaid: inv.amountPaid,
      balanceDue: inv.balanceDue,
      ...(inv.payments !== undefined ? { payments: inv.payments } : {}),
      requiresPaymentConfirmationDocument: inv.requiresPaymentConfirmationDocument,
      paymentConfirmationDocumentUrl: inv.paymentConfirmationDocumentUrl,
      paymentConfirmationRecordedAt: inv.paymentConfirmationRecordedAt,
    };
  });
}

const IcoPlus = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
</svg>);
const IcoRefresh = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
</svg>);
const IcoChevRight = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M9 18l6-6-6-6" />
</svg>);
const IcoTrash = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
</svg>);
const IcoChevDown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M6 9l6 6 6-6" />
</svg>);
type InvSelectOption = {
  value: string;
  label: string;
};
function InvoicesSelectDropdown({ id, value, options, onChange, disabled, variant, 'aria-label': ariaLabel, }: {
  id: string;
  value: string;
  options: InvSelectOption[];
  onChange: (next: string) => void;
  disabled?: boolean;
  variant: 'filter' | 'dialog';
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-listbox`;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '—';
  useEffect(() => {
    if (!open)
      return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);
  useEffect(() => {
    if (!open)
      return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')
        setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (<div ref={wrapRef} className={`tt-inv-dd${variant === 'filter' ? ' tt-inv-dd--filter' : ' tt-inv-dd--dialog'}`}>
    <button type="button" id={id} className={`tt-inv-dd__trigger${variant === 'dialog' ? ' tt-inv-dd__trigger--dialog' : ''}`} disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-label={ariaLabel} onClick={() => {
      if (disabled)
        return;
      setOpen((v) => !v);
    }}>
      <span className="tt-inv-dd__value">{selectedLabel}</span>
      <span className="tt-inv-dd__chev" aria-hidden>
        <IcoChevDown />
      </span>
    </button>
    {open && !disabled && (<div id={listId} className="tt-inv-dd__menu" role="listbox">
      {options.map((opt) => (<button key={opt.value === '' ? '__all' : opt.value} type="button" role="option" aria-selected={opt.value === value} className={`tt-inv-dd__opt${opt.value === value ? ' tt-inv-dd__opt--active' : ''}`} onClick={() => {
        onChange(opt.value);
        setOpen(false);
      }}>
        {opt.label}
      </button>))}
    </div>)}
  </div>);
}
const IcoInvoiceEmpty = () => (<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" aria-hidden>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" />
</svg>);

export type InvoicesPanelProps = {

    variant?: 'default' | 'accounting';
};

export function InvoicesPanel({ variant = 'default' }: InvoicesPanelProps) {
  const accountingEmbed = variant === 'accounting';
  const readOnly = accountingEmbed;
  const { t, locale } = useI18n();
  const { showAlert, showConfirm } = useAppDialog();
  const { pushToast } = useAppToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
  const [clientsErr, setClientsErr] = useState<string | null>(null);
  const [items, setItems] = useState<InvoiceDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [partnerListBlocked, setPartnerListBlocked] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState('');
  const [listProjectsFilter, setListProjectsFilter] = useState<TimeManagerClientProjectRow[]>([]);
  const [listDateFrom, setListDateFrom] = useState('');
  const [listDateTo, setListDateTo] = useState('');
  const [invoiceListPage, setInvoiceListPage] = useState(1);
  const [invoiceListTotalCount, setInvoiceListTotalCount] = useState<number | null>(null);
  const [aggStats, setAggStats] = useState<InvoicesAggregatedStats | null>(null);
  const [aggStatsLoading, setAggStatsLoading] = useState(false);
  const [aggStatsErr, setAggStatsErr] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const INV_PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(String(c.id), c.name));
    return m;
  }, [clients]);
  const clientFilterSearchItems = useMemo(() => [{ id: '', name: t('timeTrackingPage.common.allClients'), search: t('timeTrackingPage.invoices.filters.allClientsSearch') }, ...clients.map((c) => ({
    id: c.id,
    name: c.name,
    search: `${c.name} ${c.id}`.trim().toLowerCase(),
  }))], [clients, t]);
  const statusFilterOptions = useMemo(() => [
    { value: '', label: t('timeTrackingPage.invoices.filters.allStatuses') },
    ...(['draft', 'sent', 'viewed', 'partial_paid', 'paid', 'canceled', 'overdue'] as const).map((s) => ({
      value: s,
      label: ttInvoiceStatusLabel(s, t),
    })),
  ], [t]);
  const projectFilterSearchItems = useMemo(() => {
    const allOpt = { id: '', name: t('timeTrackingPage.invoices.filters.allProjects'), search: t('timeTrackingPage.invoices.filters.allProjectsSearch') };
    if (!clientFilter) {
      return [allOpt, ...listProjectsFilter.map((p) => {
        const clientLabel = clientNameById.get(String(p.client_id)) ?? p.client_id;
        const line = p.code ? `${p.name} (${p.code})` : p.name;
        return {
          id: p.id,
          name: `${clientLabel} — ${line}`,
          search: `${clientLabel} ${p.name} ${p.code ?? ''} ${p.id}`.trim().toLowerCase(),
        };
      })];
    }
    return [allOpt, ...listProjectsFilter.map((p) => ({
      id: p.id,
      name: p.code ? `${p.name} (${p.code})` : p.name,
      search: `${p.name} ${p.code ?? ''} ${p.id}`.trim().toLowerCase(),
    }))];
  }, [clientFilter, listProjectsFilter, clientNameById, t]);
  const invoicePagerOffset = (invoiceListPage - 1) * INV_PAGE;
  const invoiceNextDisabled = listLoading || (invoiceListTotalCount != null
    ? invoicePagerOffset + items.length >= invoiceListTotalCount
    : items.length < INV_PAGE);
  const showInvoicePager = invoiceListPage > 1 || (items.length === INV_PAGE && (invoiceListTotalCount == null || invoicePagerOffset + items.length < invoiceListTotalCount));
  const listStatsFromAgg = useMemo(() => {
    if (!aggStats)
      return null;
    const by = aggStats.byEffectiveStatus;
    const n = (k: string) => by[k] ?? 0;
    return {
      drafts: n('draft'),
      open: n('sent') + n('viewed') + n('partial_paid'),
      paid: n('paid'),
      canceled: n('canceled'),
      overdue: n('overdue'),
    };
  }, [aggStats]);
  const loadClients = useCallback(() => {
    Promise.all([
      listAllTimeManagerClientsMerged(false),
      listAllClientProjectsMerged(false),
    ])
      .then(([clientRows, _projectRows]) => {
        setClients(clientRows.filter(isActiveTimeManagerClientRow));
        setClientsErr(null);
      })
      .catch((e: unknown) => {
        setClients([]);
        setClientsErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noClientAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
      });
  }, [t]);
  const loadList = useCallback((opts?: {
    silent?: boolean;
    invoiceResponsePatch?: InvoiceDto;
    signal?: AbortSignal;
  }) => {
    const silent = Boolean(opts?.silent);
    const invoiceResponsePatch = opts?.invoiceResponsePatch;
    const signal = opts?.signal;
    if (!silent)
      setListLoading(true);
    setListErr(null);
    const billingGate = invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo);
    return listInvoices({
      status: statusFilter || undefined,
      clientId: clientFilter || undefined,
      projectId: projectFilter || undefined,
      dateFrom: listDateFrom || undefined,
      dateTo: listDateTo || undefined,
      limit: INV_PAGE,
      offset: (invoiceListPage - 1) * INV_PAGE,
      includeTotalCount: true,
      ...billingGate,
    }, signal)
      .then((r) => {
        if (signal?.aborted)
          return;
        let rows = r.items;
        if (invoiceResponsePatch)
          rows = applyInvoiceMutationToListRows(rows, invoiceResponsePatch);
        setItems(rows);
        setPartnerListBlocked(r.partnerConfirmationBlocked === true);
        setInvoiceListTotalCount(typeof r.totalCount === 'number' ? r.totalCount : null);
      })
      .catch((e: unknown) => {
        if (signal?.aborted)
          return;
        setItems([]);
        setPartnerListBlocked(false);
        setInvoiceListTotalCount(null);
        setListErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noInvoiceAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
      })
      .finally(() => {
        if (!silent && !signal?.aborted)
          setListLoading(false);
      });
  }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo, invoiceListPage, INV_PAGE, t]);
  const loadAggStats = useCallback((signal?: AbortSignal) => {
    setAggStatsLoading(true);
    setAggStatsErr(null);
    const billingGate = invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo);
    const filterBase = {
      status: statusFilter || undefined,
      clientId: clientFilter || undefined,
      projectId: projectFilter || undefined,
      dateFrom: listDateFrom || undefined,
      dateTo: listDateTo || undefined,
      ...billingGate,
    };
    return Promise.all([
      getInvoicesAggregatedStats(filterBase, signal),
      aggregateInvoicesMoneyExcludingCanceled(filterBase, signal),
    ])
      .then(([s, ex]) => {
        if (signal?.aborted)
          return;
        setAggStats({
          ...s,
          byCurrency: ex.byCurrency,
          unpaidInvoicesCount: ex.unpaidInvoicesCount,
          openBalanceDue: ex.openBalanceDue,
        });
      })
      .catch((e: unknown) => {
        if (signal?.aborted)
          return;
        setAggStats(null);
        setAggStatsErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noStatsAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
      })
      .finally(() => {
        if (!signal?.aborted)
          setAggStatsLoading(false);
      });
  }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo, t]);
  const changeStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setInvoiceListPage(1);
  }, []);
  const changeClientFilter = useCallback((value: string) => {
    setClientFilter(value);
    setProjectFilter('');
    setInvoiceListPage(1);
  }, []);
  const changeProjectFilter = useCallback((value: string) => {
    setProjectFilter(value);
    setInvoiceListPage(1);
  }, []);
  const changeListDateFrom = useCallback((value: string) => {
    setListDateFrom(value);
    setInvoiceListPage(1);
  }, []);
  const changeListDateTo = useCallback((value: string) => {
    setListDateTo(value);
    setInvoiceListPage(1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadAggStats(controller.signal);
    return () => controller.abort();
  }, [loadAggStats]);
  useEffect(() => {
    if (!clientFilter) {
      listAllClientProjectsForPicker()
        .then((rows) => setListProjectsFilter(rows.filter((p) => isActiveTimeManagerProjectRow(p))))
        .catch(() => setListProjectsFilter([]));
      return;
    }
    listAllClientProjectsForClientMerged(clientFilter)
      .then((rows) => setListProjectsFilter(rows.filter((p) => isActiveTimeManagerProjectRow(p))))
      .catch(() => setListProjectsFilter([]));
  }, [clientFilter]);
  useEffect(() => {
    loadClients();
  }, [loadClients]);
  useEffect(() => {
    if (clientsErr)
      pushToast({ message: clientsErr, variant: 'warning' });
  }, [clientsErr, pushToast]);
  useEffect(() => {
    if (listErr)
      pushToast({ message: listErr, variant: 'error' });
  }, [listErr, pushToast]);
  useEffect(() => {
    if (aggStatsErr)
      pushToast({ message: aggStatsErr, variant: 'warning' });
  }, [aggStatsErr, pushToast]);
  useEffect(() => {
    const controller = new AbortController();
    void loadList({ signal: controller.signal });
    return () => controller.abort();
  }, [loadList]);
  const goToCreate = useCallback(() => {
    if (readOnly)
      return;
    navigate(getInvoiceCreateUrl());
  }, [readOnly, navigate]);
  const openInvoiceDetail = useCallback((id: string) => {
    navigate(getInvoiceDetailUrl(id, accountingEmbed ? { variant: 'accounting' } : undefined));
  }, [navigate, accountingEmbed]);
  const deleteInvoiceById = useCallback(async (inv: InvoiceDto) => {
    const isCanceled = inv.status === 'canceled';
    if (!await showConfirm({
      title: isCanceled
        ? t('timeTrackingPage.invoices.confirm.deleteCanceledTitle')
        : t('timeTrackingPage.invoices.confirm.deleteDraftTitle'),
      message: isCanceled
        ? t('timeTrackingPage.invoices.confirm.deleteCanceledMessage')
        : t('timeTrackingPage.invoices.confirm.deleteDraftMessage'),
      variant: 'danger',
      confirmLabel: t('timeTrackingPage.invoices.confirm.deleteConfirm'),
    }))
      return false;
    setActionBusy(true);
    try {
      await deleteDraftInvoice(inv.id);
      loadList();
      void loadAggStats();
      notifyReportsInvalidated();
      return true;
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
      return false;
    }
    finally {
      setActionBusy(false);
    }
  }, [loadAggStats, loadList, showAlert, showConfirm, t]);
  useEffect(() => {
    const oid = searchParams.get(OPEN_INVOICE_DETAIL_QUERY)?.trim();
    if (!oid)
      return;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete(OPEN_INVOICE_DETAIL_QUERY);
      return p;
    }, { replace: true });
    navigate(getInvoiceDetailUrl(oid, accountingEmbed ? { variant: 'accounting' } : undefined), { replace: true });
  }, [searchParams, setSearchParams, navigate, accountingEmbed]);
  const invoicesSubTab = searchParams.get('invTab') === 'registry'
    ? 'registry'
    : searchParams.get('invTab') === 'statistics'
      ? 'statistics'
      : 'list';
  const selectInvoicesSubTab = useCallback((tab: 'list' | 'registry' | 'statistics') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'registry')
        next.set('invTab', 'registry');
      else if (tab === 'statistics')
        next.set('invTab', 'statistics');
      else
        next.delete('invTab');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  return (<div className={`tt-inv${accountingEmbed ? ' tt-inv--accounting' : ''}`}>
    <div className="tt-reports__type-block">
      {!accountingEmbed && (
        <p className="tt-reports__type-block-title" id="tt-inv-page-title">{t('timeTrackingPage.invoices.title')}</p>
      )}
      <nav className="tt-reports__type-nav" role="tablist" aria-labelledby="tt-inv-page-title">
        <button
          type="button"
          role="tab"
          aria-selected={invoicesSubTab === 'list'}
          className={`tt-reports__type-tab${invoicesSubTab === 'list' ? ' tt-reports__type-tab--active' : ''}`}
          onClick={() => selectInvoicesSubTab('list')}
        >
          {t('timeTrackingPage.invoices.tabs.list')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={invoicesSubTab === 'registry'}
          className={`tt-reports__type-tab${invoicesSubTab === 'registry' ? ' tt-reports__type-tab--active' : ''}`}
          onClick={() => selectInvoicesSubTab('registry')}
        >
          {t('timeTrackingPage.invoices.tabs.registry')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={invoicesSubTab === 'statistics'}
          className={`tt-reports__type-tab${invoicesSubTab === 'statistics' ? ' tt-reports__type-tab--active' : ''}`}
          onClick={() => selectInvoicesSubTab('statistics')}
        >
          {t('timeTrackingPage.invoices.tabs.statistics')}
        </button>
      </nav>
      {invoicesSubTab === 'list' && (
        <div className="tt-inv__head-row">
          <p className="tt-inv__lede" id={accountingEmbed ? 'tt-inv-page-title' : undefined}>
            {accountingEmbed
              ? t('timeTrackingPage.invoices.introReadonly')
              : t('timeTrackingPage.invoices.introFull')}
          </p>
          {!readOnly && (
            <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={goToCreate}>
              <IcoPlus /> {t('timeTrackingPage.invoices.newInvoice')}
            </button>
          )}
          {readOnly && (
            <span className="tt-inv__readonly-badge" role="status">{t('timeTrackingPage.invoices.readonlyBadge')}</span>
          )}
        </div>
      )}
      {invoicesSubTab === 'registry' && (
        <p className="tt-inv__lede">{t('timeTrackingPage.invoices.registry.intro')}</p>
      )}
      {invoicesSubTab === 'statistics' && (
        <p className="tt-inv__lede">{t('timeTrackingPage.invoices.statistics.intro')}</p>
      )}
    </div>

    {invoicesSubTab === 'registry' ? (
      <InvoiceRegistryPanel readOnly={readOnly} />
    ) : invoicesSubTab === 'statistics' ? (
      <InvoiceRegistryStatisticsPanel />
    ) : (<>

    {!listErr && (aggStatsLoading || listStatsFromAgg) && (<div className="tt-reports__summary" aria-label={t('timeTrackingPage.invoices.summary.aria')}>
      {aggStatsLoading || !listStatsFromAgg ? (<div className="tt-reports__summary-card tt-reports__summary-card--full">
        <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.label')}</span>
        <span className="tt-reports__summary-value" style={{ fontSize: '0.95rem' }}>{aggStatsLoading ? t('timeTrackingPage.common.loading') : '—'}</span>
      </div>) : (<>
        <div className="tt-reports__summary-card tt-inv__summary-card--accent">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.active')}</span>
          <span className="tt-reports__summary-value">{listStatsFromAgg.open}</span>
        </div>
        <div className="tt-reports__summary-card">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.drafts')}</span>
          <span className="tt-reports__summary-value">{listStatsFromAgg.drafts}</span>
        </div>
        <div className="tt-reports__summary-card tt-inv__summary-card--success">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.paid')}</span>
          <span className="tt-reports__summary-value">{listStatsFromAgg.paid}</span>
        </div>
        {listStatsFromAgg.overdue > 0 && (<div className="tt-reports__summary-card tt-inv__summary-card--danger">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.overdue')}</span>
          <span className="tt-reports__summary-value">{listStatsFromAgg.overdue}</span>
        </div>)}
        {listStatsFromAgg.canceled > 0 && (<div className="tt-reports__summary-card tt-inv__summary-card--muted">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.canceled')}</span>
          <span className="tt-reports__summary-value">{listStatsFromAgg.canceled}</span>
        </div>)}
        {aggStats != null && (<div className="tt-reports__summary-card tt-inv__summary-card--accent">
          <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.withBalance')}</span>
          <span className="tt-reports__summary-value">{aggStats.unpaidInvoicesCount}</span>
        </div>)}
        {aggStats != null && (aggStats.openBalanceDue > 0 || aggStats.unpaidInvoicesCount > 0) && (() => {
          const curKeys = Object.keys(aggStats.byCurrency);
          const singleCur = curKeys.length === 1 ? curKeys[0] : null;
          return (<div className="tt-reports__summary-card">
            <span className="tt-reports__summary-label">{t('timeTrackingPage.invoices.summary.totalBalance')}</span>
            <span className="tt-reports__summary-value" style={{ fontSize: '0.95rem' }}>
              {singleCur != null
                ? fmtMoney(aggStats.openBalanceDue, singleCur, locale)
                : aggStats.openBalanceDue.toLocaleString(localeTag(locale), { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
            {singleCur == null && curKeys.length > 1 ? (<p className="tt-inv__list-hint" style={{ margin: '0.35rem 0 0', maxWidth: '14rem' }}>
              {t('timeTrackingPage.invoices.summary.multiCurrencyHint')}
            </p>) : null}
          </div>);
        })()}
        {aggStats?.isCapped ? (<p className="tt-inv__list-hint" role="note" style={{ flexBasis: '100%', margin: '0.25rem 0 0' }}>
          {t('timeTrackingPage.invoices.summary.cappedHint').replace('{cap}', String(aggStats.cappedAt ?? 50000))}
        </p>) : null}
      </>)}
    </div>)}

    <div className="tt-reports__content">
      <div className="tt-reports__content-header tt-inv__filter-header">
        <div className="tt-reports__breakdown-bar-wrap">
          <span className="tt-reports__breakdown-label">{t('timeTrackingPage.invoices.filters.listTitle')}</span>
          {!listLoading && items.length > 0 && (<span className="tt-inv__list-hint">
            {t('timeTrackingPage.invoices.filters.pageHint').replace('{page}', String(invoiceListPage)).replace('{count}', String(items.length))}
            {invoiceListTotalCount != null
              ? t('timeTrackingPage.invoices.filters.totalKnown').replace('{total}', String(invoiceListTotalCount))
              : items.length === INV_PAGE
                ? t('timeTrackingPage.invoices.filters.totalUnknown')
                : ''}
          </span>)}
        </div>
        <div className="tt-reports__content-actions tt-inv__filter-actions">
          {!listErr && Object.keys(invoiceListPartnerBillingGateOpts(projectFilter, listDateFrom, listDateTo)).length > 0 && (<p className="tt-inv__list-hint tt-inv__billing-gate-hint" style={{ width: '100%', flexBasis: '100%', margin: '0 0 0.35rem' }}>
            {t('timeTrackingPage.invoices.filters.billingGateHint')}
          </p>)}
          <div className="tt-reports__sort-wrap">
            <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-client-btn">{t('timeTrackingPage.invoices.filters.client')}</label>
            <SearchableSelect className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-inv-filter-client-btn" portalDropdown portalZIndex={10050} portalMinWidth={420} placeholder={t('timeTrackingPage.invoices.filters.client')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.notFound')} value={clientFilter} items={clientFilterSearchItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => changeClientFilter(o.id)} aria-label={t('timeTrackingPage.invoices.filters.clientFilterAria')} />
          </div>
          <div className="tt-reports__sort-wrap">
            <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-status">{t('timeTrackingPage.invoices.filters.status')}</label>
            <InvoicesSelectDropdown id="tt-inv-filter-status" variant="filter" value={statusFilter} options={statusFilterOptions} onChange={changeStatusFilter} aria-label={t('timeTrackingPage.invoices.filters.statusFilterAria')} />
          </div>
          <div className="tt-reports__sort-wrap">
            <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-project-btn">{t('timeTrackingPage.invoices.filters.project')}</label>
            <SearchableSelect className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-inv-filter-project-btn" portalDropdown portalZIndex={10050} portalMinWidth={720} placeholder={t('timeTrackingPage.invoices.filters.allProjects')} emptyListText={t('timeTrackingPage.common.noProjects')} noMatchText={t('timeTrackingPage.common.notFound')} value={projectFilter} items={projectFilterSearchItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => changeProjectFilter(o.id)} aria-label={t('timeTrackingPage.invoices.filters.projectFilterAria')} />
          </div>
          <div className="tt-reports__sort-wrap tt-inv__filter-dates">
            <span className="tt-reports__sort-label">{t('timeTrackingPage.invoices.filters.issueDate')}</span>
            <div className="tt-inv__filter-dates-row">
              <DatePicker value={listDateFrom} max={listDateTo || undefined} onChange={changeListDateFrom} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title={t('timeTrackingPage.invoices.filters.issueDateFrom')} showChevron />
              {listDateFrom ? (<button type="button" className="tt-inv__date-clear" onClick={() => changeListDateFrom('')} aria-label={t('timeTrackingPage.invoices.filters.clearDateFrom')} title={t('timeTrackingPage.invoices.filters.reset')}>
                ×
              </button>) : null}
              <span className="tt-inv__date-sep" aria-hidden>
                —
              </span>
              <DatePicker value={listDateTo} min={listDateFrom || undefined} onChange={changeListDateTo} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title={t('timeTrackingPage.invoices.filters.issueDateTo')} showChevron />
              {listDateTo ? (<button type="button" className="tt-inv__date-clear" onClick={() => changeListDateTo('')} aria-label={t('timeTrackingPage.invoices.filters.clearDateTo')} title={t('timeTrackingPage.invoices.filters.reset')}>
                ×
              </button>) : null}
            </div>
          </div>
          <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => {
            loadList();
            void loadAggStats();
          }} disabled={listLoading} title={t('timeTrackingPage.invoices.filters.refreshTitle')}>
            <IcoRefresh /> {t('timeTrackingPage.common.refresh')}
          </button>
        </div>
      </div>

      <div className="tt-reports__table-wrap tt-inv__table-outer">
        {listLoading ? (<div className="tt-inv__loading" role="status" aria-live="polite" aria-busy="true">
          <div className="tt-inv__loading-spinner" />
          <span>{t('timeTrackingPage.invoices.list.loading')}</span>
        </div>) : items.length === 0 && partnerListBlocked ? (<div className="tt-inv__empty tt-inv__empty--gate">
          <IcoInvoiceEmpty />
          <h3 className="tt-inv__empty-title">{t('timeTrackingPage.invoices.empty.gateTitle')}</h3>
          <p className="tt-inv__empty-text">
            {t('timeTrackingPage.invoices.empty.gateText')}
          </p>
          <p className="tt-inv__empty-actions">
            <Link className="tt-reports__btn tt-reports__btn--outline" to={`${routes.timeTracking}?tab=reports`}>
              {t('timeTrackingPage.invoices.empty.reportsLink')}
            </Link>
            {projectFilter.trim() !== '' ? (
              <Link className="tt-reports__btn tt-reports__btn--outline" to={getProjectDetailUrl(projectFilter.trim())}>
                {t('timeTrackingPage.invoices.empty.projectCardLink')}
              </Link>
            ) : null}
            {!readOnly && (
              <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={goToCreate}>
                <IcoPlus /> {t('timeTrackingPage.invoices.newInvoice')}
              </button>
            )}
          </p>
        </div>) : items.length === 0 ? (<div className="tt-inv__empty">
          <IcoInvoiceEmpty />
          <h3 className="tt-inv__empty-title">{t('timeTrackingPage.invoices.empty.title')}</h3>
          <p className="tt-inv__empty-text">
            {readOnly
              ? t('timeTrackingPage.invoices.empty.textReadonly')
              : t('timeTrackingPage.invoices.empty.textFull')}
          </p>
          {!readOnly && (
            <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={goToCreate}>
              <IcoPlus /> {t('timeTrackingPage.invoices.newInvoice')}
            </button>
          )}
          {readOnly && (
            <Link className="tt-reports__btn tt-reports__btn--outline" to={routes.timeTracking}>
              {t('timeTrackingPage.invoices.empty.timeTrackingLink')}
            </Link>
          )}
        </div>) : (<div className="tt-inv__table-scroll">
          <table className="tt-reports__table tt-inv__data-table">
            <thead>
              <tr>
                <th scope="col">{t('timeTrackingPage.invoices.list.columns.number')}</th>
                <th scope="col">{t('timeTrackingPage.invoices.list.columns.client')}</th>
                <th scope="col">{t('timeTrackingPage.invoices.list.columns.issueDate')}</th>
                <th scope="col">{t('timeTrackingPage.invoices.list.columns.dueDate')}</th>
                <th scope="col" className="tt-inv__th-num">{t('timeTrackingPage.invoices.list.columns.amount')}</th>
                <th scope="col" className="tt-inv__th-num">{t('timeTrackingPage.invoices.list.columns.balance')}</th>
                <th scope="col">{t('timeTrackingPage.invoices.list.columns.status')}</th>
                <th scope="col" className="tt-inv__th-action" aria-label={t('timeTrackingPage.invoices.list.columns.action')} />
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => {
                const badgeClass = INVOICE_STATUS_BADGE_CLASS[inv.status] ?? 'tt-inv__badge--neutral';
                const canDelete = !readOnly && invoiceCanDeleteDraft(inv.status as InvoiceUiStatus);
                return (<tr key={inv.id} className="tt-inv__row" tabIndex={0} onClick={() => openInvoiceDetail(inv.id)} onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openInvoiceDetail(inv.id);
                  }
                }}>
                  <td className="tt-inv__td-strong">{inv.invoiceNumber}</td>
                  <td>{clientNameById.get(inv.clientId) ?? inv.clientId}</td>
                  <td>{fmtDisplayDate(inv.issueDate, locale)}</td>
                  <td>{fmtDisplayDate(inv.dueDate, locale)}</td>
                  <td className="tt-inv__td-num">{fmtMoney(inv.totalAmount, inv.currency, locale)}</td>
                  <td className="tt-inv__td-num">{fmtMoney(inv.balanceDue, inv.currency, locale)}</td>
                  <td>
                    <span className={`tt-inv__badge ${badgeClass}`}>
                      {ttInvoiceStatusLabel(inv.status, t)}
                    </span>
                  </td>
                  <td className="tt-inv__td-action">
                    <div className="tt-inv__row-actions">
                      {canDelete ? (
                        <button
                          type="button"
                          className="tt-inv__row-delete"
                          disabled={actionBusy}
                          title={inv.status === 'canceled'
                            ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                            : t('timeTrackingPage.invoices.detail.deleteDraft')}
                          aria-label={inv.status === 'canceled'
                            ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                            : t('timeTrackingPage.invoices.detail.deleteDraft')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteInvoiceById(inv);
                          }}
                        >
                          <IcoTrash />
                        </button>
                      ) : null}
                      <span className="tt-inv__row-cta" aria-hidden>
                        <IcoChevRight />
                      </span>
                    </div>
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
          {showInvoicePager && (<div className="tt-list-pagination tt-inv__list-pager">
            <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={listLoading || invoiceListPage <= 1} onClick={() => setInvoiceListPage((p) => Math.max(1, p - 1))}>
              {t('timeTrackingPage.timesheet.back')}
            </button>
            <span className="tt-list-pagination__meta">{t('timeTrackingPage.invoices.list.pageLabel').replace('{page}', String(invoiceListPage))}</span>
            <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={invoiceNextDisabled} onClick={() => setInvoiceListPage((p) => p + 1)}>
              {t('timeTrackingPage.timesheet.forward')}
            </button>
          </div>)}
        </div>)}
      </div>
    </div>

    </>)}
  </div>);
}
