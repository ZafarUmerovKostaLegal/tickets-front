import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes, getProjectDetailUrl } from '@shared/config';
import { buildInvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '@pages/invoice-preview/lib/invoicePreviewDownload';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { useAppDialog, useAppToast } from '@shared/ui';
import { useI18n, ttInvoiceSendActionLabel, ttInvoiceStatusLabel, type TimeTrackingT } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import type { AppLocale } from '@shared/i18n/types';
import { listInvoices, getInvoicesAggregatedStats, aggregateInvoicesMoneyExcludingCanceled, getInvoice, createInvoice, patchInvoice, sendInvoice, createInvoiceOutlookDraft, getInvoiceOutlookDraftStatus, markInvoiceViewed, registerInvoicePayment, submitInvoicePaymentConfirmation, cancelInvoice, deleteDraftInvoice, fetchUnbilledTimeEntries, fetchUnbilledExpenses, listPartnerReportConfirmationsConfirmed, listAllTimeManagerClientsMerged, listAllClientProjectsMerged, listAllClientProjectsForClientMerged, listAllClientProjectsForPicker, isForbiddenError, getTimeManagerClient, INVOICE_STATUS_BADGE_CLASS, invoiceCanSend, invoiceCanMarkViewed, invoiceCanRegisterPayment, invoiceCanCancel, invoiceCanDeleteDraft, invoiceCanPatchDraft, writeInvoicePreviewSession, readInvoicePreviewSession, OPEN_INVOICE_DETAIL_QUERY, isInvoicePreviewSessionCreate, mergeInvoiceDtoAfterPayment, type InvoiceDto, type InvoiceLineDto, type TimeManagerClientRow, type TimeManagerClientProjectRow, type UnbilledTimeEntryDto, type UnbilledExpenseEntryDto, type InvoicePatchInput, type InvoiceUiStatus, type InvoicesAggregatedStats, type InvoicePreviewMeta, type PartnerReportConfirmationRequest, } from '@entities/time-tracking';
import { collectClientIdsFromProjects, isActiveTimeManagerClientRow, isActiveTimeManagerProjectRow } from '@entities/time-tracking/lib/projectTimeEntry';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { formatHM } from '@shared/lib/formatTrackingHours';
import { InvoiceSendContactModal } from './InvoiceSendContactModal';
import { InvoiceRegistryPanel } from './InvoiceRegistryPanel';
import { InvoiceRegistryStatisticsPanel } from './InvoiceRegistryStatisticsPanel';

function fmtMoney(n: number, cur: string, locale: AppLocale): string {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `${x.toLocaleString(localeTag(locale), { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Outlook compose in a centered popup (not a new browser tab). */
function openOutlookComposePopup(url: string): Window | null {
  const href = String(url ?? '').trim();
  if (!href || typeof window === 'undefined')
    return null;
  const availW = window.screen?.availWidth || window.innerWidth || 1200;
  const availH = window.screen?.availHeight || window.innerHeight || 900;
  const width = Math.min(1100, Math.max(720, Math.floor(availW * 0.72)));
  const height = Math.min(900, Math.max(640, Math.floor(availH * 0.85)));
  const left = Math.max(0, Math.floor((availW - width) / 2) + (window.screenLeft || window.screenX || 0));
  const top = Math.max(0, Math.floor((availH - height) / 2) + (window.screenTop || window.screenY || 0));
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'scrollbars=yes',
    'resizable=yes',
  ].join(',');
  const popup = window.open(href, 'kostaOutlookInvoiceCompose', features);
  // Soft noopener: do not keep a strong reference chain to the app window.
  try {
    if (popup)
      popup.opener = null;
  }
  catch {
    /* ignore cross-origin */
  }
  return popup;
}
function invoiceLineKindSlug(ln: InvoiceLineDto): string {
  const k = (ln.lineKind ?? '').toLowerCase().trim();
  if (k === 'time' || Boolean(ln.timeEntryId))
    return 'time';
  if (k === 'expense' || Boolean(ln.expenseRequestId))
    return 'expense';
  if (k === 'manual')
    return 'manual';
  return 'other';
}
function invoiceLineKindLabel(ln: InvoiceLineDto, t: TimeTrackingT): string {
  switch (invoiceLineKindSlug(ln)) {
    case 'time':
      return t('timeTrackingPage.invoices.lineTypes.time');
    case 'expense':
      return t('timeTrackingPage.invoices.lineTypes.expense');
    case 'manual':
      return t('timeTrackingPage.invoices.lineTypes.manual');
    default:
      return (ln.lineKind && ln.lineKind.trim()) || '—';
  }
}
function fmtDisplayDate(iso: string, locale: AppLocale): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso))
    return iso || '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime()))
    return iso;
  return d.toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', year: 'numeric' });
}
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
async function invoicePreviewMetaForExisting(inv: InvoiceDto, clientLabel: string): Promise<InvoicePreviewMeta> {
  const meta: InvoicePreviewMeta = {
    clientLabel,
    invoiceNumber: inv.invoiceNumber,
    issueDateIso: inv.issueDate.slice(0, 10),
    dueDateIso: inv.dueDate.slice(0, 10),
  };
  if (!inv.projectId?.trim())
    return meta;
  try {
    const rows = await listAllClientProjectsForClientMerged(inv.clientId);
    const p = rows.find((r) => r.id === inv.projectId);
    if (p)
      meta.projectLabel = (p.code ? `${p.name} (${p.code})` : p.name).trim();
  }
  catch {
  }
  return meta;
}
function parseMoneyRu(raw: string): number {
  const t = raw.replace(/\s/g, '').replace(/\u00a0/g, '').trim();
  if (!t)
    return NaN;
  if (t.includes(',') && t.includes('.')) {
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      return Number.parseFloat(t.replace(/\./g, '').replace(',', '.'));
    }
    return Number.parseFloat(t.replace(/,/g, ''));
  }
  if (t.includes(','))
    return Number.parseFloat(t.replace(',', '.'));
  return Number.parseFloat(t);
}

function buildPaidAtForPaymentApi(raw: string): string | undefined {
  const t = raw.trim();
  if (!t)
    return undefined;
  if (/^\d{2}\.\d{2}\.\d{4}/.test(t))
    return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()))
    return d.toISOString();
  return t;
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
function parseOptionalPercentField(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t)
    return undefined;
  const n = Number.parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(n))
    return undefined;
  return n;
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
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function lastOfMonthIso(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}
function notifyReportsInvalidated() {
  window.dispatchEvent(new Event('tt-reports-invalidate'));
}
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
  const resumeLoadProjectIdRef = useRef<string | null>(null);
  const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
  const [activeProjectsAll, setActiveProjectsAll] = useState<TimeManagerClientProjectRow[]>([]);
  const [clientIdsWithActiveProjects, setClientIdsWithActiveProjects] = useState<Set<string>>(() => new Set());
  const [confirmedReportsForCreate, setConfirmedReportsForCreate] = useState<PartnerReportConfirmationRequest[]>([]);
  const [confirmedProjectIdsForCreate, setConfirmedProjectIdsForCreate] = useState<Set<string>>(() => new Set());
  const [confirmedClientIdsForCreate, setConfirmedClientIdsForCreate] = useState<Set<string>>(() => new Set());
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
  const INV_PAGE = TIME_TRACKING_LIST_PAGE_SIZE;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
  const [unbilledPartnerBlockReason, setUnbilledPartnerBlockReason] = useState<string | null>(null);
  const [unbilledLoading, setUnbilledLoading] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payAt, setPayAt] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paymentConfirmDocUrl, setPaymentConfirmDocUrl] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [sendContactOpen, setSendContactOpen] = useState(false);
  const [outlookSendWait, setOutlookSendWait] = useState<{ invoiceId: string; label: string } | null>(null);
  const outlookWaitAbortRef = useRef<AbortController | null>(null);
  const [detailExportBusy, setDetailExportBusy] = useState<'pdf' | 'word' | null>(null);
  const [draftIssueDate, setDraftIssueDate] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftTaxPct, setDraftTaxPct] = useState('');
  const [draftTax2Pct, setDraftTax2Pct] = useState('');
  const [draftDiscPct, setDraftDiscPct] = useState('');
  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(String(c.id), c.name));
    return m;
  }, [clients]);
  const clientsForCreate = useMemo(
    () => clients.filter((c) => clientIdsWithActiveProjects.has(c.id) && confirmedClientIdsForCreate.has(c.id)),
    [clients, clientIdsWithActiveProjects, confirmedClientIdsForCreate],
  );
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
  const loadList = useCallback((opts?: {
    silent?: boolean;

    invoiceResponsePatch?: InvoiceDto;
  }) => {
    const silent = Boolean(opts?.silent);
    const invoiceResponsePatch = opts?.invoiceResponsePatch;
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
    })
      .then((r) => {
        let rows = r.items;
        if (invoiceResponsePatch)
          rows = applyInvoiceMutationToListRows(rows, invoiceResponsePatch);
        setItems(rows);
        setPartnerListBlocked(r.partnerConfirmationBlocked === true);
        setInvoiceListTotalCount(typeof r.totalCount === 'number' ? r.totalCount : null);
      })
      .catch((e: unknown) => {
        setItems([]);
        setPartnerListBlocked(false);
        setInvoiceListTotalCount(null);
        setListErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noInvoiceAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
      })
      .finally(() => {
        if (!silent)
          setListLoading(false);
      });
  }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo, invoiceListPage, INV_PAGE, t]);
  const loadAggStats = useCallback(() => {
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
      getInvoicesAggregatedStats(filterBase),
      aggregateInvoicesMoneyExcludingCanceled(filterBase),
    ])
      .then(([s, ex]) => {
        setAggStats({
          ...s,
          byCurrency: ex.byCurrency,
          unpaidInvoicesCount: ex.unpaidInvoicesCount,
          openBalanceDue: ex.openBalanceDue,
        });
      })
      .catch((e: unknown) => {
        setAggStats(null);
        setAggStatsErr(isForbiddenError(e) ? t('timeTrackingPage.invoices.errors.noStatsAccess') : (e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic')));
      })
      .finally(() => {
        setAggStatsLoading(false);
      });
  }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo, t]);
  useEffect(() => {
    setInvoiceListPage(1);
  }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo]);
  useEffect(() => {
    setUnbilledPartnerBlockReason(null);
  }, [unbilledFrom, unbilledTo, createProjectId]);
  useEffect(() => {
    void loadAggStats();
  }, [loadAggStats]);
  useEffect(() => {
    setProjectFilter('');
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
    if (listErr)
      pushToast({ message: listErr, variant: 'error' });
  }, [listErr, pushToast]);
  useEffect(() => {
    if (aggStatsErr)
      pushToast({ message: aggStatsErr, variant: 'warning' });
  }, [aggStatsErr, pushToast]);
  useEffect(() => {
    loadList();
  }, [loadList]);
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
  useEffect(() => {
    setPaymentConfirmDocUrl('');
  }, [detailId]);
  useEffect(() => {
    if (!detail || detail.status !== 'draft')
      return;
    setDraftIssueDate((detail.issueDate ?? '').slice(0, 10));
    setDraftDueDate((detail.dueDate ?? '').slice(0, 10));
    setDraftTaxPct(detail.taxPercent != null ? String(detail.taxPercent) : '');
    setDraftTax2Pct(detail.tax2Percent != null ? String(detail.tax2Percent) : '');
    setDraftDiscPct(detail.discountPercent != null ? String(detail.discountPercent) : '');
  }, [detail]);
  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    void getInvoice(id, true)
      .then((inv) => setDetail(inv))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);
  const closeDetail = useCallback(() => {
    setDetailId(null);
    setDetail(null);
  }, []);
  const deleteInvoiceById = useCallback(async (inv: InvoiceDto, opts?: { closeIfDetail?: boolean }) => {
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
      if (opts?.closeIfDetail)
        closeDetail();
      else if (detailId === inv.id)
        closeDetail();
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
  }, [closeDetail, detailId, loadAggStats, loadList, showAlert, showConfirm, t]);
  const refreshDetail = useCallback(async (id: string) => {
    const inv = await getInvoice(id, true);
    setDetail(inv);
    await loadList({ silent: true });
    void loadAggStats();
    notifyReportsInvalidated();
  }, [loadList, loadAggStats]);

  useEffect(() => () => {
    outlookWaitAbortRef.current?.abort();
  }, []);

  const trackOutlookSendAndMarkInvoice = useCallback(async (opts: {
    invoiceId: string;
    messageId: string;
    subject: string;
    label: string;
  }) => {
    outlookWaitAbortRef.current?.abort();
    const ac = new AbortController();
    outlookWaitAbortRef.current = ac;
    setOutlookSendWait({ invoiceId: opts.invoiceId, label: opts.label });
    pushToast({
      message: t('timeTrackingPage.invoices.sendDialog.outlookWaitingSend').replace('{invoice}', opts.label),
      variant: 'info',
    });

    const createdAfter = new Date(Date.now() - 120_000).toISOString();
    const startedAt = Date.now();
    let missingSince: number | null = null;
    const maxMs = 15 * 60_000;
    const missingGraceMs = 90_000;
    const pollMs = 3000;

    const sleep = (ms: number) => new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => resolve(), ms);
      ac.signal.addEventListener('abort', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });

    try {
      while (!ac.signal.aborted && Date.now() - startedAt < maxMs) {
        const st = await getInvoiceOutlookDraftStatus(opts.invoiceId, {
          messageId: opts.messageId,
          subject: opts.subject,
          createdAfter,
        });
        if (ac.signal.aborted)
          return;
        if (st.state === 'sent') {
          await sendInvoice(opts.invoiceId);
          await refreshDetail(opts.invoiceId);
          pushToast({
            message: t('timeTrackingPage.invoices.sendDialog.outlookSentStatusUpdated').replace('{invoice}', opts.label),
            variant: 'info',
          });
          return;
        }
        if (st.state === 'missing') {
          if (missingSince == null)
            missingSince = Date.now();
          else if (Date.now() - missingSince >= missingGraceMs) {
            pushToast({
              message: t('timeTrackingPage.invoices.sendDialog.outlookDraftDiscarded').replace('{invoice}', opts.label),
              variant: 'warning',
            });
            return;
          }
        }
        else {
          missingSince = null;
        }
        await sleep(pollMs);
      }
      if (!ac.signal.aborted) {
        pushToast({
          message: t('timeTrackingPage.invoices.sendDialog.outlookWaitTimeout').replace('{invoice}', opts.label),
          variant: 'warning',
        });
      }
    }
    catch (e) {
      if (ac.signal.aborted)
        return;
      const msg = e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic');
      pushToast({ message: msg, variant: 'error' });
    }
    finally {
      if (outlookWaitAbortRef.current === ac) {
        outlookWaitAbortRef.current = null;
        setOutlookSendWait(null);
      }
    }
  }, [pushToast, refreshDetail, t]);
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
      setUnbilledTime(timeRows);
      setUnbilledExp(expRows);
      if (!opts?.preserveSelections) {
        setSelTime(new Set());
        setSelExp(new Set());
      }
      else {
        const timeIds = new Set(timeRows.map((r) => r.id));
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
  }, [createProjectId, unbilledFrom, unbilledTo, requireFullyConfirmedPeriod, showAlert, t]);
  useEffect(() => {
    if (readOnly)
      return;
    if (searchParams.get('invoice_resume') !== '1')
      return;
    const snap = readInvoicePreviewSession();
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('invoice_resume');
      return p;
    }, { replace: true });
    if (!isInvoicePreviewSessionCreate(snap))
      return;
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
    setCreateOpen(true);
    resumeLoadProjectIdRef.current = f.createProjectId.trim() !== '' ? f.createProjectId : null;
  }, [readOnly, searchParams, setSearchParams]);
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
  useEffect(() => {
    const oid = searchParams.get(OPEN_INVOICE_DETAIL_QUERY)?.trim();
    if (!oid)
      return;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete(OPEN_INVOICE_DETAIL_QUERY);
      return p;
    }, { replace: true });
    openDetail(oid);
  }, [searchParams, setSearchParams, openDetail]);
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
  const openExistingInvoicePreview = useCallback((inv: InvoiceDto) => {
    void (async () => {
      try {
        const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
        const meta = await invoicePreviewMetaForExisting(inv, clientLabel);
        writeInvoicePreviewSession({
          v: 1,
          mode: 'existing',
          invoiceId: inv.id,
          meta,
        });
        navigate(routes.timeTrackingInvoicePreview);
      }
      catch (e) {
        await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.previewFailed') });
      }
    })();
  }, [clientNameById, navigate, showAlert, t]);
  const handleDetailDownloadPdf = useCallback(async (inv: InvoiceDto) => {
    setDetailExportBusy('pdf');
    try {
      const client = await getTimeManagerClient(inv.clientId);
      const model = buildInvoiceCoverLetterModel({
        issueDateIso: inv.issueDate.slice(0, 10),
        clientName: client.name,
        clientAddress: client.address,
        contactName: client.contact_name ?? null,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
      });
      const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
      const meta = await invoicePreviewMetaForExisting(inv, clientLabel);
      const previewSession = { v: 1 as const, mode: 'existing' as const, invoiceId: inv.id, meta };

      const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
      const blob = await buildInvoicePreviewPdfBlob({ model, session: previewSession });
      const base = buildInvoicePreviewExportBasename({
        invoiceNumber: inv.invoiceNumber,
        clientLabel: clientNameById.get(inv.clientId) ?? inv.clientId,
        issueDateIso: inv.issueDate.slice(0, 10),
      });
      triggerBrowserDownload(blob, `${base}.pdf`);
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.pdfFailed') });
    }
    finally {
      setDetailExportBusy(null);
    }
  }, [clientNameById, showAlert, t]);
  const handleDetailDownloadWord = useCallback(async (inv: InvoiceDto) => {
    setDetailExportBusy('word');
    try {
      const client = await getTimeManagerClient(inv.clientId);
      const model = buildInvoiceCoverLetterModel({
        issueDateIso: inv.issueDate.slice(0, 10),
        clientName: client.name,
        clientAddress: client.address,
        contactName: client.contact_name ?? null,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
      });
      const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
      const meta = await invoicePreviewMetaForExisting(inv, clientLabel);
      const previewSession = { v: 1 as const, mode: 'existing' as const, invoiceId: inv.id, meta };

      const { buildInvoicePreviewDocxBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewDocx');
      const blob = await buildInvoicePreviewDocxBlob({ model, session: previewSession });
      const base = buildInvoicePreviewExportBasename({
        invoiceNumber: inv.invoiceNumber,
        clientLabel: clientNameById.get(inv.clientId) ?? inv.clientId,
        issueDateIso: inv.issueDate.slice(0, 10),
      });
      triggerBrowserDownload(blob, `${base}.docx`);
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.wordFailed') });
    }
    finally {
      setDetailExportBusy(null);
    }
  }, [clientNameById, showAlert, t]);
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
      await createInvoice({
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
      setCreateOpen(false);
      setCreateInvoiceNumber('');
      setSelTime(new Set());
      setSelExp(new Set());
      loadList();
      void loadAggStats();
      notifyReportsInvalidated();
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
  }, [createClientId, createProjectId, issueDate, dueDate, createInvoiceNumber, selTime, selExp, unbilledFrom, unbilledTo, requireFullyConfirmedPeriod, loadList, loadAggStats, showAlert, t]);
  const handlePayment = useCallback(async () => {
    if (!detailId || !detail)
      return;
    const trimmedAmount = String(payAmount).replace(/\s/g, '').replace(/\u00a0/g, '').trim();
    let amountPayload: number | string | undefined;
    if (trimmedAmount !== '') {
      const n = parseMoneyRu(trimmedAmount);
      if (!Number.isFinite(n) || n <= 0) {
        await showAlert({ message: t('timeTrackingPage.invoices.errors.invalidAmount') });
        return;
      }
      amountPayload = /,/.test(trimmedAmount) ? trimmedAmount.replace(/\s/g, '') : n;
    }
    const paidAtPayload = buildPaidAtForPaymentApi(String(payAt));
    setActionBusy(true);
    try {
      const posted = await registerInvoicePayment(detailId, {
        ...(amountPayload !== undefined ? { amount: amountPayload } : {}),
        ...(paidAtPayload !== undefined ? { paidAt: paidAtPayload } : {}),
        paymentMethod: payMethod.trim() || null,
        note: payNote.trim() || null,
      });
      let next: InvoiceDto = posted;
      try {
        const refreshed = await getInvoice(detailId, true);
        next = mergeInvoiceDtoAfterPayment(posted, refreshed);
      }
      catch {
        next = posted;
      }
      setDetail(next);
      setPayOpen(false);
      await loadList({ silent: true, invoiceResponsePatch: next });
      void loadAggStats();
      notifyReportsInvalidated();
      if (next.requiresPaymentConfirmationDocument === true)
        pushToast({ message: t('timeTrackingPage.invoices.payment.documentRequired'), variant: 'warning' });
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
    }
    finally {
      setActionBusy(false);
    }
  }, [detailId, detail, payAmount, payAt, payMethod, payNote, loadList, loadAggStats, showAlert, pushToast, t]);
  const handleFullPaymentNow = useCallback(async () => {
    if (!detailId || !detail)
      return;
    const due = Number(detail.balanceDue);
    if (!Number.isFinite(due) || due <= 1e-9)
      return;
    setActionBusy(true);
    try {
      const posted = await registerInvoicePayment(detailId, {});
      let next: InvoiceDto = posted;
      try {
        const refreshed = await getInvoice(detailId, true);
        next = mergeInvoiceDtoAfterPayment(posted, refreshed);
      }
      catch {
        next = posted;
      }
      setDetail(next);
      setPayOpen(false);
      await loadList({ silent: true, invoiceResponsePatch: next });
      void loadAggStats();
      notifyReportsInvalidated();
      if (next.requiresPaymentConfirmationDocument === true)
        pushToast({ message: t('timeTrackingPage.invoices.payment.documentRequired'), variant: 'warning' });
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
    }
    finally {
      setActionBusy(false);
    }
  }, [detailId, detail, loadList, loadAggStats, showAlert, pushToast, t]);
  const handleSubmitPaymentConfirmation = useCallback(async () => {
    if (!detailId)
      return;
    const url = paymentConfirmDocUrl.trim();
    if (!url) {
      await showAlert({ message: t('timeTrackingPage.invoices.payment.documentLinkRequired') });
      return;
    }
    setActionBusy(true);
    try {
      const posted = await submitInvoicePaymentConfirmation(detailId, { documentUrl: url });
      let next: InvoiceDto = posted;
      try {
        const refreshed = await getInvoice(detailId, true);
        next = mergeInvoiceDtoAfterPayment(posted, refreshed);
      }
      catch {
        next = posted;
      }
      setDetail(next);
      setPaymentConfirmDocUrl(next.paymentConfirmationDocumentUrl?.trim() ?? url);
      await loadList({ silent: true, invoiceResponsePatch: next });
      void loadAggStats();
      notifyReportsInvalidated();
      pushToast({ message: t('timeTrackingPage.invoices.payment.saved'), variant: 'info' });
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
    }
    finally {
      setActionBusy(false);
    }
  }, [detailId, paymentConfirmDocUrl, loadList, loadAggStats, showAlert, pushToast, t]);
  const handleSaveDraft = useCallback(async () => {
    if (!detail || detail.status !== 'draft')
      return;
    const cn = (document.getElementById('inv-client-note') as HTMLTextAreaElement)?.value ?? '';
    const inn = (document.getElementById('inv-int-note') as HTMLTextAreaElement)?.value ?? '';
    const issue = draftIssueDate.trim() || (detail.issueDate ?? '').slice(0, 10);
    const due = draftDueDate.trim() || (detail.dueDate ?? '').slice(0, 10);
    if (!issue || !due) {
      await showAlert({ message: t('timeTrackingPage.invoices.errors.datesRequired') });
      return;
    }
    const body: InvoicePatchInput = {
      issueDate: issue,
      dueDate: due,
      clientNote: cn || null,
      internalNote: inn || null,
    };
    const t1 = parseOptionalPercentField(draftTaxPct);
    const t2 = parseOptionalPercentField(draftTax2Pct);
    const d = parseOptionalPercentField(draftDiscPct);
    if (t1 !== undefined)
      body.taxPercent = t1;
    if (t2 !== undefined)
      body.tax2Percent = t2;
    if (d !== undefined)
      body.discountPercent = d;
    setActionBusy(true);
    try {
      await patchInvoice(detail.id, body);
      await refreshDetail(detail.id);
    }
    catch (e) {
      await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
    }
    finally {
      setActionBusy(false);
    }
  }, [detail, draftIssueDate, draftDueDate, draftTaxPct, draftTax2Pct, draftDiscPct, refreshDetail, showAlert, t]);
  function openCreateModal() {
    if (readOnly)
      return;
    setCreateOpen(true);
    setCreateClientId('');
    setCreateProjectId('');
    setCreateInvoiceNumber('');
    setUnbilledTime([]);
    setUnbilledExp([]);
    setUnbilledPartnerBlockReason(null);
  }
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
            <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={openCreateModal}>
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
            <SearchableSelect className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-inv-filter-client-btn" portalDropdown portalZIndex={10050} portalMinWidth={420} placeholder={t('timeTrackingPage.invoices.filters.client')} emptyListText={t('timeTrackingPage.common.noClients')} noMatchText={t('timeTrackingPage.common.notFound')} value={clientFilter} items={clientFilterSearchItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => setClientFilter(o.id)} aria-label={t('timeTrackingPage.invoices.filters.clientFilterAria')} />
          </div>
          <div className="tt-reports__sort-wrap">
            <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-status">{t('timeTrackingPage.invoices.filters.status')}</label>
            <InvoicesSelectDropdown id="tt-inv-filter-status" variant="filter" value={statusFilter} options={statusFilterOptions} onChange={setStatusFilter} aria-label={t('timeTrackingPage.invoices.filters.statusFilterAria')} />
          </div>
          <div className="tt-reports__sort-wrap">
            <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-project-btn">{t('timeTrackingPage.invoices.filters.project')}</label>
            <SearchableSelect className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-inv-filter-project-btn" portalDropdown portalZIndex={10050} portalMinWidth={720} placeholder={t('timeTrackingPage.invoices.filters.allProjects')} emptyListText={t('timeTrackingPage.common.noProjects')} noMatchText={t('timeTrackingPage.common.notFound')} value={projectFilter} items={projectFilterSearchItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => setProjectFilter(o.id)} aria-label={t('timeTrackingPage.invoices.filters.projectFilterAria')} />
          </div>
          <div className="tt-reports__sort-wrap tt-inv__filter-dates">
            <span className="tt-reports__sort-label">{t('timeTrackingPage.invoices.filters.issueDate')}</span>
            <div className="tt-inv__filter-dates-row">
              <DatePicker value={listDateFrom} max={listDateTo || undefined} onChange={(iso) => setListDateFrom(iso)} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title={t('timeTrackingPage.invoices.filters.issueDateFrom')} showChevron />
              {listDateFrom ? (<button type="button" className="tt-inv__date-clear" onClick={() => setListDateFrom('')} aria-label={t('timeTrackingPage.invoices.filters.clearDateFrom')} title={t('timeTrackingPage.invoices.filters.reset')}>
                ×
              </button>) : null}
              <span className="tt-inv__date-sep" aria-hidden>
                —
              </span>
              <DatePicker value={listDateTo} min={listDateFrom || undefined} onChange={(iso) => setListDateTo(iso)} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title={t('timeTrackingPage.invoices.filters.issueDateTo')} showChevron />
              {listDateTo ? (<button type="button" className="tt-inv__date-clear" onClick={() => setListDateTo('')} aria-label={t('timeTrackingPage.invoices.filters.clearDateTo')} title={t('timeTrackingPage.invoices.filters.reset')}>
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
              <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={openCreateModal}>
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
            <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={openCreateModal}>
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
                return (<tr key={inv.id} className="tt-inv__row" tabIndex={0} onClick={() => openDetail(inv.id)} onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(inv.id);
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

    {createOpen && !readOnly && (<div className="tt-inv-overlay" role="dialog" aria-modal="true" aria-labelledby="tt-inv-create-title">
      <div className="tt-inv-dialog tt-inv-dialog--wide">
        <div className="tt-inv-dialog__head">
          <div className="tt-inv-dialog__head-main">
            <h3 id="tt-inv-create-title">{t('timeTrackingPage.invoices.createDialog.title')}</h3>
            <p className="tt-inv-dialog__sub">{t('timeTrackingPage.invoices.createDialog.subtitle')}</p>
          </div>
          <button type="button" className="tt-inv-dialog__x" onClick={() => !createBusy && setCreateOpen(false)} aria-label={t('timeTrackingPage.common.close')}>×</button>
        </div>
        <div className="tt-inv-dialog__body">
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

          {unbilledPartnerBlockReason ? (<div className="tt-inv-dialog__section tt-inv-dialog__partner-gate" role="alert">
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
          </div>) : null}

          {unbilledTime.length > 0 && (<div className="tt-inv-dialog__subsection">
            <h4 className="tt-inv__section-title">
              {t('timeTrackingPage.invoices.createDialog.timeSection').replace('{count}', String(unbilledTime.length))}
            </h4>
            <div className="tt-reports__table-wrap tt-inv-dialog__scroll-table">
              <table className="tt-inv-mini tt-inv-mini--in-dialog">
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
                    return (<tr key={x.id}>
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
                      <td>{x.description ?? '—'}</td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>)}

          {unbilledExp.length > 0 && (<div className="tt-inv-dialog__subsection">
            <h4 className="tt-inv__section-title">{t('timeTrackingPage.invoices.createDialog.expensesSection').replace('{count}', String(unbilledExp.length))}</h4>
            <div className="tt-reports__table-wrap tt-inv-dialog__scroll-table">
              <table className="tt-inv-mini tt-inv-mini--in-dialog">
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
                  {unbilledExp.map((x) => (<tr key={x.id}>
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
                  </tr>))}
                </tbody>
              </table>
            </div>
          </div>)}
        </div>
        <div className="tt-inv-dialog__foot">
          <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => void openInvoicePreview()} disabled={createBusy} title={t('timeTrackingPage.invoices.createDialog.previewTitle')}>
            {t('timeTrackingPage.invoices.createDialog.preview')}
          </button>
          <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>{t('timeTrackingPage.common.cancel')}</button>
          <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handleCreate()} disabled={createBusy}>
            {createBusy ? t('timeTrackingPage.invoices.createDialog.creating') : t('timeTrackingPage.invoices.createDialog.createDraft')}
          </button>
        </div>
      </div>
    </div>)}

    {detailId && (<div className="tt-inv-overlay" role="dialog" aria-modal="true" aria-labelledby="tt-inv-detail-title">
      <div className="tt-inv-dialog tt-inv-dialog--wide">
        <div className="tt-inv-dialog__head">
          <div className="tt-inv-dialog__head-main">
            <h3 id="tt-inv-detail-title">{detailLoading ? t('timeTrackingPage.invoices.detail.loading') : (detail?.invoiceNumber ?? t('timeTrackingPage.invoices.detail.defaultTitle'))}</h3>
            {!detailLoading && detail && (<p className="tt-inv-dialog__sub">{clientNameById.get(detail.clientId) ?? detail.clientId}</p>)}
          </div>
          <button type="button" className="tt-inv-dialog__x" onClick={closeDetail} aria-label={t('timeTrackingPage.common.close')}>×</button>
        </div>
        <div className="tt-inv-dialog__body">
          {!detail || detailLoading ? (<p className="tt-inv__muted">{t('timeTrackingPage.invoices.detail.loadingCard')}</p>) : (<>
            <div className="tt-inv-detail-meta">
              <div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.status')}</span>
                <span className="tt-inv-detail-meta__v">
                  <span className={`tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`}>
                    {ttInvoiceStatusLabel(detail.status, t)}
                  </span>
                </span>
              </div>
              {detail.storedStatus !== detail.status && (<div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.inDb')}</span>
                <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--mono">{detail.storedStatus}</span>
              </div>)}
              <div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.issueDate')}</span>
                <span className="tt-inv-detail-meta__v">{fmtDisplayDate(detail.issueDate, locale)}</span>
              </div>
              <div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.dueDate')}</span>
                <span className="tt-inv-detail-meta__v">{fmtDisplayDate(detail.dueDate, locale)}</span>
              </div>
              <div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.amount')}</span>
                <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num">{fmtMoney(detail.totalAmount, detail.currency, locale)}</span>
              </div>
              <div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.paid')}</span>
                <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num">{fmtMoney(detail.amountPaid, detail.currency, locale)}</span>
              </div>
              <div className="tt-inv-detail-meta__item">
                <span className="tt-inv-detail-meta__k">{t('timeTrackingPage.invoices.detail.balance')}</span>
                <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num tt-inv-detail-meta__v--strong">{fmtMoney(detail.balanceDue, detail.currency, locale)}</span>
              </div>
            </div>
            {(detail.requiresPaymentConfirmationDocument === true || Boolean(detail.paymentConfirmationDocumentUrl?.trim())) && (<div className="tt-inv-pay-confirm" role="region" aria-label={t('timeTrackingPage.invoices.detail.paymentConfirmRegion')}>
              {detail.requiresPaymentConfirmationDocument === true && !readOnly ? (<>
                <h4 className="tt-inv__section-title">{t('timeTrackingPage.invoices.detail.paymentConfirmTitle')}</h4>
                <p className="tt-inv-pay-confirm__hint">
                  {t('timeTrackingPage.invoices.detail.paymentConfirmHint')}
                </p>
                <label>
                  {t('timeTrackingPage.invoices.detail.paymentConfirmDocLabel')}
                  <input className="tt-inv__input" value={paymentConfirmDocUrl} onChange={(e) => setPaymentConfirmDocUrl(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.paymentConfirmDocPlaceholder')} autoComplete="off" />
                </label>
                <div className="tt-inv-actions tt-inv-pay-confirm__actions">
                  <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleSubmitPaymentConfirmation()}>
                    {t('timeTrackingPage.invoices.detail.savePaymentConfirm')}
                  </button>
                </div>
              </>) : null}
              {detail.requiresPaymentConfirmationDocument === true && readOnly ? (
                <p className="tt-inv-pay-confirm__hint tt-inv__muted">
                  {t('timeTrackingPage.invoices.detail.paymentConfirmReadonly')}
                </p>
              ) : null}
              {detail.paymentConfirmationDocumentUrl?.trim() ? (() => {
                const u = detail.paymentConfirmationDocumentUrl!.trim();
                const recRaw = detail.paymentConfirmationRecordedAt?.trim();
                let recLabel = '';
                if (recRaw) {
                  const d = new Date(recRaw);
                  recLabel = Number.isNaN(d.getTime())
                    ? recRaw
                    : d.toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' });
                }
                return (<p className="tt-inv-pay-confirm__saved">
                  {t('timeTrackingPage.invoices.detail.paymentConfirmRecorded')}{recLabel ? ` · ${recLabel}` : ''}
                  {' · '}
                  {/^https?:\/\//i.test(u)
                    ? (<a href={u} target="_blank" rel="noopener noreferrer">{u}</a>)
                    : <code>{u}</code>}
                </p>);
              })() : null}
            </div>)}

            <div className="tt-inv-detail-export" role="group" aria-label={t('timeTrackingPage.invoices.detail.exportAria')}>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => openExistingInvoicePreview(detail)} title={t('timeTrackingPage.invoices.detail.previewTitle')}>
                {t('timeTrackingPage.invoices.detail.preview')}
              </button>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => void handleDetailDownloadPdf(detail)}>
                {detailExportBusy === 'pdf' ? t('timeTrackingPage.invoices.detail.preparingPdf') : t('timeTrackingPage.invoices.detail.downloadPdf')}
              </button>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => void handleDetailDownloadWord(detail)}>
                {detailExportBusy === 'word' ? t('timeTrackingPage.invoices.detail.preparingWord') : t('timeTrackingPage.invoices.detail.downloadWord')}
              </button>
            </div>
            {outlookSendWait && outlookSendWait.invoiceId === detail.id && (
              <p className="tt-inv-outlook-wait" role="status">
                {t('timeTrackingPage.invoices.sendDialog.outlookWaitingBanner').replace('{invoice}', outlookSendWait.label)}
              </p>
            )}
            {!readOnly && (<div className="tt-inv-actions">
              {invoiceCanSend(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy || Boolean(outlookSendWait && outlookSendWait.invoiceId === detail.id)} onClick={() => setSendContactOpen(true)}>
                {outlookSendWait && outlookSendWait.invoiceId === detail.id
                  ? t('timeTrackingPage.invoices.sendDialog.outlookWaitingShort')
                  : ttInvoiceSendActionLabel(detail.status as InvoiceUiStatus, t)}
              </button>)}
              {invoiceCanMarkViewed(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
                setActionBusy(true);
                try {
                  await markInvoiceViewed(detail.id);
                  await refreshDetail(detail.id);
                }
                catch (e) {
                  await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
                }
                finally {
                  setActionBusy(false);
                }
              }}>
                {t('timeTrackingPage.invoices.detail.markViewed')}
              </button>)}
              {invoiceCanRegisterPayment(detail.status as InvoiceUiStatus, detail.balanceDue) && (<>
                <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleFullPaymentNow()}>
                  {t('timeTrackingPage.invoices.detail.fullPayment')}
                </button>
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={() => {
                  setPayAmount(detail.balanceDue > 1e-9 ? String(detail.balanceDue).replace('.', ',') : '');
                  setPayAt('');
                  setPayOpen(true);
                }}>
                  {t('timeTrackingPage.invoices.detail.partialPayment')}
                </button>
              </>)}
              {invoiceCanCancel(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
                if (!await showConfirm({
                  title: t('timeTrackingPage.invoices.confirm.cancelTitle'),
                  message: t('timeTrackingPage.invoices.confirm.cancelMessage'),
                  variant: 'danger',
                  confirmLabel: t('timeTrackingPage.invoices.confirm.cancelConfirm'),
                }))
                  return;
                setActionBusy(true);
                try {
                  await cancelInvoice(detail.id);
                  await refreshDetail(detail.id);
                }
                catch (e) {
                  await showAlert({ message: e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic') });
                }
                finally {
                  setActionBusy(false);
                }
              }}>
                {t('timeTrackingPage.invoices.detail.cancelInvoice')}
              </button>)}
              {invoiceCanDeleteDraft(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={() => {
                void deleteInvoiceById(detail, { closeIfDetail: true });
              }}>
                {detail.status === 'canceled'
                  ? t('timeTrackingPage.invoices.detail.deleteCanceled')
                  : t('timeTrackingPage.invoices.detail.deleteDraft')}
              </button>)}
            </div>)}

            {!readOnly && invoiceCanPatchDraft(detail.status as InvoiceUiStatus) && (<div className="tt-inv-draft">
              <p className="tt-inv-draft__hint">{t('timeTrackingPage.invoices.detail.draftEditHint')}</p>
              <div className="tt-inv-dialog__grid tt-inv-dialog__grid--draft-invoice">
                <div className="tt-inv-dialog__field">
                  <span id="inv-draft-issue-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.detail.issueDate')}</span>
                  <DatePicker id="inv-draft-issue" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={draftIssueDate} max={draftDueDate || undefined} onChange={(iso) => setDraftIssueDate(iso)} portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.detail.issueDate')} showChevron aria-labelledby="inv-draft-issue-lbl" />
                </div>
                <div className="tt-inv-dialog__field">
                  <span id="inv-draft-due-lbl" className="tt-inv-dialog__label">{t('timeTrackingPage.invoices.detail.dueDate')}</span>
                  <DatePicker id="inv-draft-due" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={draftDueDate} min={draftIssueDate || undefined} onChange={(iso) => setDraftDueDate(iso)} portal portalZIndex={12100} emptyLabel={t('timeTrackingPage.invoices.filters.dateEmpty')} title={t('timeTrackingPage.invoices.detail.dueDate')} showChevron aria-labelledby="inv-draft-due-lbl" />
                </div>
                <div className="tt-inv-dialog__field">
                  <label className="tt-inv-dialog__label" htmlFor="inv-tax1">{t('timeTrackingPage.invoices.detail.tax1')}</label>
                  <input id="inv-tax1" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftTaxPct} onChange={(e) => setDraftTaxPct(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.taxPlaceholder')} />
                </div>
                <div className="tt-inv-dialog__field">
                  <label className="tt-inv-dialog__label" htmlFor="inv-tax2">{t('timeTrackingPage.invoices.detail.tax2')}</label>
                  <input id="inv-tax2" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftTax2Pct} onChange={(e) => setDraftTax2Pct(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.optionalPlaceholder')} />
                </div>
                <div className="tt-inv-dialog__field">
                  <label className="tt-inv-dialog__label" htmlFor="inv-disc">{t('timeTrackingPage.invoices.detail.discount')}</label>
                  <input id="inv-disc" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftDiscPct} onChange={(e) => setDraftDiscPct(e.target.value)} placeholder={t('timeTrackingPage.invoices.detail.optionalPlaceholder')} />
                </div>
              </div>
              <div className="tt-inv-draft__notes">
                <label htmlFor="inv-client-note">
                  {t('timeTrackingPage.invoices.detail.clientNote')}
                  <textarea className="tt-inv__textarea" rows={3} defaultValue={detail.clientNote ?? ''} id="inv-client-note" />
                </label>
                <label htmlFor="inv-int-note">
                  {t('timeTrackingPage.invoices.detail.internalNote')}
                  <textarea className="tt-inv__textarea" rows={3} defaultValue={detail.internalNote ?? ''} id="inv-int-note" />
                </label>
              </div>
              <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleSaveDraft()}>
                {t('timeTrackingPage.invoices.detail.saveDraft')}
              </button>
            </div>)}

            {!readOnly && payOpen && (<div className="tt-inv-pay">
              <h4 className="tt-inv__section-title">{t('timeTrackingPage.invoices.payment.title')}</h4>
              <p className="tt-inv-pay__hint">
                {t('timeTrackingPage.invoices.payment.hint')}
              </p>
              <label>
                {t('timeTrackingPage.invoices.payment.amountLabel')}
                <input className="tt-inv__input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={t('timeTrackingPage.invoices.payment.amountPlaceholder')} />
              </label>
              <label>
                {t('timeTrackingPage.invoices.payment.paidAtLabel')}
                <input type="text" className="tt-inv__input" value={payAt} onChange={(e) => setPayAt(e.target.value)} placeholder={t('timeTrackingPage.invoices.payment.paidAtPlaceholder')} />
              </label>
              <label>
                {t('timeTrackingPage.invoices.payment.methodLabel')}
                <input className="tt-inv__input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
              </label>
              <label>
                {t('timeTrackingPage.invoices.payment.noteLabel')}
                <input className="tt-inv__input" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </label>
              <div className="tt-inv-actions">
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setPayOpen(false)} disabled={actionBusy}>{t('timeTrackingPage.common.cancel')}</button>
                <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handlePayment()} disabled={actionBusy}>{t('timeTrackingPage.invoices.payment.recordPayment')}</button>
              </div>
            </div>)}

            <div className="tt-inv-detail__section-divider" role="presentation" aria-hidden />
            <h4 className="tt-inv__section-title">{t('timeTrackingPage.invoices.detail.linesTitle')}</h4>
            <div className="tt-reports__table-wrap tt-inv-dialog__scroll-table">
              <table className="tt-inv-mini tt-inv-mini--in-dialog">
                <thead>
                  <tr>
                    <th>{t('timeTrackingPage.invoices.detail.linesKind')}</th>
                    <th>{t('timeTrackingPage.invoices.detail.linesDescription')}</th>
                    <th>{t('timeTrackingPage.invoices.detail.linesQty')}</th>
                    <th>{t('timeTrackingPage.invoices.detail.linesPrice')}</th>
                    <th>{t('timeTrackingPage.invoices.detail.linesAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines ?? []).map((ln) => (<tr key={ln.id}>
                    <td>
                      <span className={`tt-inv-line-kind tt-inv-line-kind--${invoiceLineKindSlug(ln)}`}>
                        {invoiceLineKindLabel(ln, t)}
                      </span>
                    </td>
                    <td>{ln.description ?? '—'}</td>
                    <td>{ln.quantity}</td>
                    <td>{ln.unitAmount}</td>
                    <td>
                      {fmtMoney(ln.lineTotal, detail.currency, locale)}
                      {ln.sourceCurrency && ln.sourceCurrency !== detail.currency && ln.sourceAmount != null
                          ? ` (${fmtMoney(ln.sourceAmount, ln.sourceCurrency, locale)})`
                          : ''}
                    </td>
                  </tr>))}
                </tbody>
              </table>
            </div>

            {(detail.payments ?? []).length > 0 && (<>
              <h4 className="tt-inv__section-title">{t('timeTrackingPage.invoices.detail.paymentsTitle')}</h4>
              <ul className="tt-inv-payments">
                {detail.payments!.map((p) => (<li key={p.id}>{fmtMoney(p.amount, detail.currency, locale)} — {p.paidAt}</li>))}
              </ul>
            </>)}
          </>)}
        </div>
      </div>
    </div>)}
    {sendContactOpen && detail && !readOnly && (
      <InvoiceSendContactModal
        clientId={detail.clientId}
        clientName={clientNameById.get(detail.clientId) ?? detail.clientId}
        invoiceLabel={detail.invoiceNumber || detail.id}
        onClose={() => {
          if (!actionBusy)
            setSendContactOpen(false);
        }}
        onConfirm={async (contact) => {
          setActionBusy(true);
          try {
            const client = await getTimeManagerClient(detail.clientId);
            const model = buildInvoiceCoverLetterModel({
              issueDateIso: detail.issueDate.slice(0, 10),
              clientName: client.name,
              clientAddress: client.address,
              contactName: client.contact_name ?? null,
              totalAmount: detail.totalAmount,
              currency: detail.currency,
            });
            const clientLabel = (clientNameById.get(detail.clientId) ?? detail.clientId).trim();
            const meta = await invoicePreviewMetaForExisting(detail, clientLabel);
            const previewSession = { v: 1 as const, mode: 'existing' as const, invoiceId: detail.id, meta };
            const { buildInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewPdf');
            const blob = await buildInvoicePreviewPdfBlob({ model, session: previewSession });
            const pdfBase64 = await blobToBase64(blob);
            const invoiceLabel = detail.invoiceNumber || detail.id;
            const amountLabel = fmtMoney(detail.totalAmount, detail.currency, locale);
            const nameSuffix = contact.name
              ? t('timeTrackingPage.invoices.sendDialog.nameSuffix').replace('{name}', contact.name)
              : '';
            const subject = t('timeTrackingPage.invoices.sendDialog.mailSubject').replace('{invoice}', invoiceLabel);
            const bodyHtml = t('timeTrackingPage.invoices.sendDialog.mailBodyHtml')
              .replaceAll('{nameSuffix}', escapeHtml(nameSuffix))
              .replaceAll('{invoice}', escapeHtml(invoiceLabel))
              .replaceAll('{amount}', escapeHtml(amountLabel));
            const bodyText = t('timeTrackingPage.invoices.sendDialog.mailBodyText')
              .replaceAll('{nameSuffix}', nameSuffix)
              .replaceAll('{invoice}', invoiceLabel)
              .replaceAll('{amount}', amountLabel);
            const pdfFileName = `${buildInvoicePreviewExportBasename({
              invoiceNumber: detail.invoiceNumber,
              clientLabel,
              issueDateIso: detail.issueDate.slice(0, 10),
            })}.pdf`;

            const draft = await createInvoiceOutlookDraft(detail.id, {
              toEmail: contact.email,
              toName: contact.name || null,
              subject,
              bodyHtml,
              bodyText,
              pdfBase64,
              pdfFileName,
            });

            const opened = openOutlookComposePopup(draft.webLink);
            if (!opened)
              await showAlert({ message: t('timeTrackingPage.invoices.errors.outlookOpenFailed') });

            // Close modal right away — do not hang on "Готовим письмо…" while user sends in Outlook.
            setSendContactOpen(false);

            const messageId = (draft.messageId || '').trim();
            if (!messageId) {
              // Cannot track Graph message — fall back to marking sent after draft open.
              await sendInvoice(detail.id);
              await refreshDetail(detail.id);
              pushToast({
                message: t('timeTrackingPage.invoices.sendDialog.outlookSentStatusUpdated').replace('{invoice}', invoiceLabel),
                variant: 'info',
              });
              return;
            }

            void trackOutlookSendAndMarkInvoice({
              invoiceId: detail.id,
              messageId,
              subject,
              label: invoiceLabel,
            });
          }
          catch (e) {
            const msg = e instanceof Error ? e.message : t('timeTrackingPage.invoices.errors.generic');
            const lower = msg.toLowerCase();
            if (lower.includes('не подключ') || lower.includes('not connected') || lower.includes('mail.readwrite'))
              await showAlert({ message: t('timeTrackingPage.invoices.errors.outlookNotConnected') });
            else
              await showAlert({ message: msg || t('timeTrackingPage.invoices.errors.outlookDraftFailed') });
            throw e;
          }
          finally {
            setActionBusy(false);
          }
        }}
      />
    )}
  </div>);
}
