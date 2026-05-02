import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { buildInvoicePreviewExportBasename, triggerBrowserDownload } from '@pages/invoice-preview/lib/invoicePreviewDownload';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { DatePicker } from '@shared/ui/DatePicker';
import { useAppDialog, useAppToast } from '@shared/ui';
import { listInvoices, getInvoicesAggregatedStats, getInvoice, getInvoiceAudit, createInvoice, patchInvoice, sendInvoice, markInvoiceViewed, registerInvoicePayment, cancelInvoice, deleteDraftInvoice, fetchUnbilledTimeEntries, fetchUnbilledExpenses, listAllTimeManagerClientsMerged, listAllClientProjectsForClientMerged, listAllClientProjectsForPicker, isForbiddenError, INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS, invoiceCanSend, invoiceCanMarkViewed, invoiceCanRegisterPayment, invoiceCanCancel, invoiceCanDeleteDraft, invoiceCanPatchDraft, invoiceSendActionLabel, writeInvoicePreviewSession, readInvoicePreviewSession, OPEN_INVOICE_DETAIL_QUERY, isInvoicePreviewSessionCreate, type InvoiceDto, type InvoiceLineDto, type InvoiceAuditEntryDto, type TimeManagerClientRow, type TimeManagerClientProjectRow, type UnbilledTimeEntryDto, type UnbilledExpenseEntryDto, type InvoicePatchInput, type InvoiceUiStatus, type InvoicesAggregatedStats, } from '@entities/time-tracking';
import { TIME_TRACKING_LIST_PAGE_SIZE } from '@entities/time-tracking/model/timeTrackingListPageSize';
import { formatHM } from '@shared/lib/formatTrackingHours';
function fmtMoney(n: number, cur: string): string {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
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
function invoiceLineKindLabel(ln: InvoiceLineDto): string {
    switch (invoiceLineKindSlug(ln)) {
        case 'time':
            return 'Время';
        case 'expense':
            return 'Расход';
        case 'manual':
            return 'Вручную';
        default:
            return (ln.lineKind && ln.lineKind.trim()) || '—';
    }
}
function fmtDisplayDate(iso: string): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso))
        return iso || '—';
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDatetimeLocalInput(d = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>);
const IcoRefresh = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>);
const IcoChevRight = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M9 18l6-6-6-6"/>
  </svg>);
const IcoChevDown = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 9l6 6 6-6"/>
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>
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
export function InvoicesPanel() {
    const { showAlert, showConfirm } = useAppDialog();
    const { pushToast } = useAppToast();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const resumeLoadProjectIdRef = useRef<string | null>(null);
    const [clients, setClients] = useState<TimeManagerClientRow[]>([]);
    const [clientsErr, setClientsErr] = useState<string | null>(null);
    const [items, setItems] = useState<InvoiceDto[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listErr, setListErr] = useState<string | null>(null);
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
    const [unbilledTime, setUnbilledTime] = useState<UnbilledTimeEntryDto[]>([]);
    const [unbilledExp, setUnbilledExp] = useState<UnbilledExpenseEntryDto[]>([]);
    const [selTime, setSelTime] = useState<Set<string>>(() => new Set());
    const [selExp, setSelExp] = useState<Set<string>>(() => new Set());
    const [unbilledLoading, setUnbilledLoading] = useState(false);
    const [createBusy, setCreateBusy] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [payAt, setPayAt] = useState(() => formatDatetimeLocalInput());
    const [payMethod, setPayMethod] = useState('');
    const [payNote, setPayNote] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [detailExportBusy, setDetailExportBusy] = useState<'pdf' | 'word' | null>(null);
    const [auditEntries, setAuditEntries] = useState<InvoiceAuditEntryDto[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditErr, setAuditErr] = useState<string | null>(null);
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
    const clientFilterSearchItems = useMemo(() => [{ id: '', name: 'Все клиенты', search: 'все клиенты' }, ...clients.map((c) => ({
        id: c.id,
        name: c.name,
        search: `${c.name} ${c.id}`.trim().toLowerCase(),
    }))], [clients]);
    const statusFilterOptions = useMemo(() => [
        { value: '', label: 'Все статусы' },
        ...(['draft', 'sent', 'viewed', 'partial_paid', 'paid', 'canceled', 'overdue'] as const).map((s) => ({
            value: s,
            label: INVOICE_STATUS_LABELS[s],
        })),
    ], []);
    const projectFilterSearchItems = useMemo(() => {
        const allOpt = { id: '', name: 'Все проекты', search: 'все проекты' };
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
    }, [clientFilter, listProjectsFilter, clientNameById]);
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
        listAllTimeManagerClientsMerged()
            .then((rows) => {
            setClients(rows);
            setClientsErr(null);
        })
            .catch((e: unknown) => {
            setClients([]);
            setClientsErr(isForbiddenError(e) ? 'Нет доступа к списку клиентов.' : (e instanceof Error ? e.message : 'Ошибка'));
        });
    }, []);
    const loadList = useCallback((opts?: {
        silent?: boolean;
    }) => {
        const silent = Boolean(opts?.silent);
        if (!silent)
            setListLoading(true);
        setListErr(null);
        return listInvoices({
            status: statusFilter || undefined,
            clientId: clientFilter || undefined,
            projectId: projectFilter || undefined,
            dateFrom: listDateFrom || undefined,
            dateTo: listDateTo || undefined,
            limit: INV_PAGE,
            offset: (invoiceListPage - 1) * INV_PAGE,
            includeTotalCount: true,
        })
            .then((r) => {
            setItems(r.items);
            setInvoiceListTotalCount(typeof r.totalCount === 'number' ? r.totalCount : null);
        })
            .catch((e: unknown) => {
            setItems([]);
            setInvoiceListTotalCount(null);
            setListErr(isForbiddenError(e) ? 'Нет доступа к счетам (нужна роль просмотра отчётов).' : (e instanceof Error ? e.message : 'Ошибка'));
        })
            .finally(() => {
            if (!silent)
                setListLoading(false);
        });
    }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo, invoiceListPage, INV_PAGE]);
    const loadAggStats = useCallback(() => {
        setAggStatsLoading(true);
        setAggStatsErr(null);
        return getInvoicesAggregatedStats({
            status: statusFilter || undefined,
            clientId: clientFilter || undefined,
            projectId: projectFilter || undefined,
            dateFrom: listDateFrom || undefined,
            dateTo: listDateTo || undefined,
        })
            .then((s) => {
            setAggStats(s);
        })
            .catch((e: unknown) => {
            setAggStats(null);
            setAggStatsErr(isForbiddenError(e) ? 'Нет доступа к сводке счетов.' : (e instanceof Error ? e.message : 'Ошибка'));
        })
            .finally(() => {
            setAggStatsLoading(false);
        });
    }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo]);
    useEffect(() => {
        setInvoiceListPage(1);
    }, [statusFilter, clientFilter, projectFilter, listDateFrom, listDateTo]);
    useEffect(() => {
        void loadAggStats();
    }, [loadAggStats]);
    useEffect(() => {
        setProjectFilter('');
        if (!clientFilter) {
            listAllClientProjectsForPicker()
                .then(setListProjectsFilter)
                .catch(() => setListProjectsFilter([]));
            return;
        }
        listAllClientProjectsForClientMerged(clientFilter)
            .then(setListProjectsFilter)
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
        if (auditErr)
            pushToast({ message: auditErr, variant: 'warning' });
    }, [auditErr, pushToast]);
    useEffect(() => {
        loadList();
    }, [loadList]);
    useEffect(() => {
        if (!createClientId) {
            setProjects([]);
            return;
        }
        listAllClientProjectsForClientMerged(createClientId)
            .then(setProjects)
            .catch(() => setProjects([]));
    }, [createClientId]);
    useEffect(() => {
        if (!detailId) {
            setAuditEntries([]);
            setAuditErr(null);
            setAuditLoading(false);
            return;
        }
        let canceled = false;
        setAuditLoading(true);
        setAuditErr(null);
        void getInvoiceAudit(detailId)
            .then((rows) => {
            if (!canceled)
                setAuditEntries(rows);
        })
            .catch((e) => {
            if (!canceled) {
                setAuditEntries([]);
                setAuditErr(e instanceof Error ? e.message : 'Не удалось загрузить аудит');
            }
        })
            .finally(() => {
            if (!canceled)
                setAuditLoading(false);
        });
        return () => {
            canceled = true;
        };
    }, [detailId, detail?.updatedAt, detail?.status]);
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
    const refreshDetail = useCallback(async (id: string) => {
        const inv = await getInvoice(id, true);
        setDetail(inv);
        await loadList({ silent: true });
        void loadAggStats();
        notifyReportsInvalidated();
    }, [loadList, loadAggStats]);
    const loadUnbilled = useCallback(async (opts?: { preserveSelections?: boolean }) => {
        if (!createProjectId) {
            await showAlert({ message: 'Выберите проект — невыставленные строки запрашиваются по projectId.' });
            return;
        }
        setUnbilledLoading(true);
        try {
            const [t, e] = await Promise.all([
                fetchUnbilledTimeEntries({ projectId: createProjectId, dateFrom: unbilledFrom, dateTo: unbilledTo }),
                fetchUnbilledExpenses({ projectId: createProjectId, dateFrom: unbilledFrom, dateTo: unbilledTo }),
            ]);
            setUnbilledTime(t);
            setUnbilledExp(e);
            if (!opts?.preserveSelections) {
                setSelTime(new Set());
                setSelExp(new Set());
            }
            else {
                const timeIds = new Set(t.map((r) => r.id));
                const expIds = new Set(e.map((r) => r.id));
                setSelTime((prev) => new Set([...prev].filter((id) => timeIds.has(id))));
                setSelExp((prev) => new Set([...prev].filter((id) => expIds.has(id))));
            }
        }
        catch (err) {
            await showAlert({ message: err instanceof Error ? err.message : 'Не удалось загрузить невыставленное' });
        }
        finally {
            setUnbilledLoading(false);
        }
    }, [createProjectId, unbilledFrom, unbilledTo, showAlert]);
    useEffect(() => {
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
        setSelTime(new Set(f.selTime));
        setSelExp(new Set(f.selExp));
        setCreateOpen(true);
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
            },
            meta: {
                ...(clientLabel ? { clientLabel } : {}),
                ...(projectLabel ? { projectLabel } : {}),
            },
        });
        navigate(routes.timeTrackingInvoicePreview);
    }, [clients, createClientId, createProjectId, unbilledFrom, unbilledTo, issueDate, dueDate, selTime, selExp, projects, navigate]);
    const openExistingInvoicePreview = useCallback((inv: InvoiceDto) => {
        const clientLabel = (clientNameById.get(inv.clientId) ?? inv.clientId).trim();
        writeInvoicePreviewSession({
            v: 1,
            mode: 'existing',
            invoiceId: inv.id,
            meta: {
                clientLabel,
                invoiceNumber: inv.invoiceNumber,
                issueDateIso: inv.issueDate.slice(0, 10),
            },
        });
        navigate(routes.timeTrackingInvoicePreview);
    }, [clientNameById, navigate]);
    const handleDetailDownloadPdf = useCallback(async (inv: InvoiceDto) => {
        setDetailExportBusy('pdf');
        try {
            const { buildBlankInvoicePreviewPdfBlob } = await import('@pages/invoice-preview/lib/buildBlankInvoicePreviewPdf');
            const blob = await buildBlankInvoicePreviewPdfBlob();
            const base = buildInvoicePreviewExportBasename({
                invoiceNumber: inv.invoiceNumber,
                clientLabel: clientNameById.get(inv.clientId) ?? inv.clientId,
                issueDateIso: inv.issueDate.slice(0, 10),
            });
            triggerBrowserDownload(blob, `${base}.pdf`);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось сформировать PDF' });
        }
        finally {
            setDetailExportBusy(null);
        }
    }, [clientNameById, showAlert]);
    const handleDetailDownloadWord = useCallback(async (inv: InvoiceDto) => {
        setDetailExportBusy('word');
        try {
            const { buildBlankInvoicePreviewDocxBlob } = await import('@pages/invoice-preview/lib/buildInvoicePreviewDocx');
            const blob = await buildBlankInvoicePreviewDocxBlob();
            const base = buildInvoicePreviewExportBasename({
                invoiceNumber: inv.invoiceNumber,
                clientLabel: clientNameById.get(inv.clientId) ?? inv.clientId,
                issueDateIso: inv.issueDate.slice(0, 10),
            });
            triggerBrowserDownload(blob, `${base}.docx`);
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Не удалось сформировать Word' });
        }
        finally {
            setDetailExportBusy(null);
        }
    }, [clientNameById, showAlert]);
    const handleCreate = useCallback(async () => {
        if (!createClientId) {
            await showAlert({ message: 'Выберите клиента' });
            return;
        }
        if (selTime.size === 0 && selExp.size === 0) {
            await showAlert({ message: 'Отметьте хотя бы одну запись времени или расход' });
            return;
        }
        setCreateBusy(true);
        try {
            await createInvoice({
                clientId: createClientId,
                projectId: createProjectId || null,
                issueDate,
                dueDate,
                timeEntryIds: [...selTime],
                expenseIds: [...selExp],
            });
            setCreateOpen(false);
            setSelTime(new Set());
            setSelExp(new Set());
            loadList();
            void loadAggStats();
            notifyReportsInvalidated();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка создания счёта' });
        }
        finally {
            setCreateBusy(false);
        }
    }, [createClientId, createProjectId, issueDate, dueDate, selTime, selExp, loadList, loadAggStats, showAlert]);
    const handlePayment = useCallback(async () => {
        if (!detailId || !detail)
            return;
        const trimmedAmount = String(payAmount).trim();
        let amount: number | undefined;
        if (trimmedAmount !== '') {
            const n = parseMoneyRu(String(payAmount));
            if (!Number.isFinite(n) || n <= 0) {
                await showAlert({ message: 'Некорректная сумма. Очистите поле, чтобы списать весь остаток, или введите число (например 216 или 216,50).' });
                return;
            }
            amount = n;
        }
        const trimmedAt = String(payAt).trim();
        let paidAtIso: string | undefined;
        if (trimmedAt !== '') {
            const d = new Date(trimmedAt);
            if (Number.isNaN(d.getTime())) {
                await showAlert({ message: 'Некорректная дата оплаты. Очистите поле, чтобы использовать текущий момент на сервере.' });
                return;
            }
            paidAtIso = d.toISOString();
        }
        setActionBusy(true);
        try {
            const inv = await registerInvoicePayment(detailId, {
                ...(amount !== undefined ? { amount } : {}),
                ...(paidAtIso !== undefined ? { paidAt: paidAtIso } : {}),
                paymentMethod: payMethod.trim() || null,
                note: payNote.trim() || null,
            });
            setDetail(inv);
            setPayOpen(false);
            await loadList({ silent: true });
            void loadAggStats();
            notifyReportsInvalidated();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
        }
        finally {
            setActionBusy(false);
        }
    }, [detailId, detail, payAmount, payAt, payMethod, payNote, loadList, loadAggStats, showAlert]);
    const handleFullPaymentNow = useCallback(async () => {
        if (!detailId || !detail)
            return;
        const due = Number(detail.balanceDue);
        if (!Number.isFinite(due) || due <= 1e-9)
            return;
        setActionBusy(true);
        try {
            const inv = await registerInvoicePayment(detailId, {});
            setDetail(inv);
            setPayOpen(false);
            await loadList({ silent: true });
            void loadAggStats();
            notifyReportsInvalidated();
        }
        catch (e) {
            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
        }
        finally {
            setActionBusy(false);
        }
    }, [detailId, detail, loadList, loadAggStats, showAlert]);
    const handleSaveDraft = useCallback(async () => {
        if (!detail || detail.status !== 'draft')
            return;
        const cn = (document.getElementById('inv-client-note') as HTMLTextAreaElement)?.value ?? '';
        const inn = (document.getElementById('inv-int-note') as HTMLTextAreaElement)?.value ?? '';
        const issue = draftIssueDate.trim() || (detail.issueDate ?? '').slice(0, 10);
        const due = draftDueDate.trim() || (detail.dueDate ?? '').slice(0, 10);
        if (!issue || !due) {
            await showAlert({ message: 'Укажите дату счёта и срок оплаты.' });
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
            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
        }
        finally {
            setActionBusy(false);
        }
    }, [detail, draftIssueDate, draftDueDate, draftTaxPct, draftTax2Pct, draftDiscPct, refreshDetail, showAlert]);
    function openCreateModal() {
        setCreateOpen(true);
        setCreateClientId('');
        setCreateProjectId('');
        setUnbilledTime([]);
        setUnbilledExp([]);
    }
    return (<div className="tt-inv">
      <div className="tt-reports__type-block">
        <p className="tt-reports__type-block-title" id="tt-inv-page-title">Счета</p>
        <div className="tt-inv__head-row">
          <p className="tt-inv__lede">
            Выписка счетов по клиентам и проектам: черновики, отправка, оплаты и остатки — в одном списке. Выберите строку, чтобы открыть карточку.
          </p>
          <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={openCreateModal}>
            <IcoPlus /> Новый счёт
          </button>
        </div>
      </div>

      {!listErr && (aggStatsLoading || listStatsFromAgg) && (<div className="tt-reports__summary" aria-label="Сводка по фильтру счетов">
          {aggStatsLoading || !listStatsFromAgg ? (<div className="tt-reports__summary-card" style={{ gridColumn: '1 / -1' }}>
              <span className="tt-reports__summary-label">Сводка</span>
              <span className="tt-reports__summary-value" style={{ fontSize: '0.95rem' }}>{aggStatsLoading ? 'Загрузка…' : '—'}</span>
            </div>) : (<>
          <div className="tt-reports__summary-card tt-inv__summary-card--accent">
            <span className="tt-reports__summary-label">Активных</span>
            <span className="tt-reports__summary-value">{listStatsFromAgg.open}</span>
          </div>
          <div className="tt-reports__summary-card">
            <span className="tt-reports__summary-label">Черновиков</span>
            <span className="tt-reports__summary-value">{listStatsFromAgg.drafts}</span>
          </div>
          <div className="tt-reports__summary-card tt-inv__summary-card--success">
            <span className="tt-reports__summary-label">Оплачено</span>
            <span className="tt-reports__summary-value">{listStatsFromAgg.paid}</span>
          </div>
          {listStatsFromAgg.overdue > 0 && (<div className="tt-reports__summary-card tt-inv__summary-card--danger">
              <span className="tt-reports__summary-label">Просрочено</span>
              <span className="tt-reports__summary-value">{listStatsFromAgg.overdue}</span>
            </div>)}
          {listStatsFromAgg.canceled > 0 && (<div className="tt-reports__summary-card tt-inv__summary-card--muted">
              <span className="tt-reports__summary-label">Отменено</span>
              <span className="tt-reports__summary-value">{listStatsFromAgg.canceled}</span>
            </div>)}
          {aggStats != null && (<div className="tt-reports__summary-card tt-inv__summary-card--accent">
              <span className="tt-reports__summary-label">С остатком к оплате</span>
              <span className="tt-reports__summary-value">{aggStats.unpaidInvoicesCount}</span>
            </div>)}
          {aggStats != null && (aggStats.openBalanceDue > 0 || aggStats.unpaidInvoicesCount > 0) && (() => {
                const curKeys = Object.keys(aggStats.byCurrency);
                const singleCur = curKeys.length === 1 ? curKeys[0] : null;
                return (<div className="tt-reports__summary-card">
                  <span className="tt-reports__summary-label">Суммарный остаток к оплате</span>
                  <span className="tt-reports__summary-value" style={{ fontSize: '0.95rem' }}>
                    {singleCur != null
                    ? fmtMoney(aggStats.openBalanceDue, singleCur)
                    : aggStats.openBalanceDue.toLocaleString('ru-RU', { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                  {singleCur == null && curKeys.length > 1 ? (<p className="tt-inv__list-hint" style={{ margin: '0.35rem 0 0', maxWidth: '14rem' }}>
                      Сумма по всем валютам без пересчёта курса; по валютам см. таблицу ниже.
                    </p>) : null}
                </div>);
            })()}
        </>)}
        </div>)}

      {!listErr && aggStats && Object.keys(aggStats.byCurrency).length > 0 && (<div className="tt-inv__currency-table-wrap" style={{ marginBottom: '1rem' }}>
          <p className="tt-reports__breakdown-label" style={{ marginBottom: '0.5rem' }}>Суммы по валютам</p>
          <div className="tt-reports__table-wrap">
            <table className="tt-reports__table tt-inv__data-table">
              <thead>
                <tr>
                  <th scope="col">Валюта</th>
                  <th scope="col" className="tt-inv__th-num">Счетов</th>
                  <th scope="col" className="tt-inv__th-num">Сумма</th>
                  <th scope="col" className="tt-inv__th-num">Оплачено</th>
                  <th scope="col" className="tt-inv__th-num">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(aggStats.byCurrency).sort(([a], [b]) => a.localeCompare(b)).map(([cur, row]) => (<tr key={cur}>
                    <td>{cur}</td>
                    <td className="tt-inv__td-num">{row.count}</td>
                    <td className="tt-inv__td-num">{fmtMoney(row.totalAmount, cur)}</td>
                    <td className="tt-inv__td-num">{fmtMoney(row.amountPaid, cur)}</td>
                    <td className="tt-inv__td-num">{fmtMoney(row.balanceDue, cur)}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          {aggStats.isCapped ? (<p className="tt-inv__list-hint" role="note">
              Сводка ограничена ({aggStats.cappedAt ?? 50000}+ счетов); суммы ориентировочные.
            </p>) : null}
        </div>)}

      <div className="tt-reports__content">
        <div className="tt-reports__content-header tt-inv__filter-header">
          <div className="tt-reports__breakdown-bar-wrap">
            <span className="tt-reports__breakdown-label">Список счетов</span>
            {!listLoading && items.length > 0 && (<span className="tt-inv__list-hint">
                Стр. {invoiceListPage}: {items.length} на странице
                {invoiceListTotalCount != null
                ? ` · всего ${invoiceListTotalCount}`
                : items.length === INV_PAGE
                    ? ' (всего по фильтру неизвестно — см. сводку)'
                    : ''}
              </span>)}
          </div>
          <div className="tt-reports__content-actions tt-inv__filter-actions">
            <div className="tt-reports__sort-wrap">
              <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-client-btn">Клиент</label>
              <SearchableSelect className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-inv-filter-client-btn" portalDropdown portalZIndex={10050} portalMinWidth={420} placeholder="Клиент" emptyListText="Нет клиентов" noMatchText="Не найдено" value={clientFilter} items={clientFilterSearchItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => setClientFilter(o.id)} aria-label="Фильтр по клиенту"/>
            </div>
            <div className="tt-reports__sort-wrap">
              <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-status">Статус</label>
              <InvoicesSelectDropdown id="tt-inv-filter-status" variant="filter" value={statusFilter} options={statusFilterOptions} onChange={setStatusFilter} aria-label="Фильтр по статусу"/>
            </div>
            <div className="tt-reports__sort-wrap">
              <label className="tt-reports__sort-label" htmlFor="tt-inv-filter-project-btn">Проект</label>
              <SearchableSelect className="tsp-srch" buttonClassName="tsp-srch__btn" buttonId="tt-inv-filter-project-btn" portalDropdown portalZIndex={10050} portalMinWidth={720} placeholder="Все проекты" emptyListText="Нет проектов" noMatchText="Не найдено" value={projectFilter} items={projectFilterSearchItems} getOptionValue={(o) => o.id} getOptionLabel={(o) => o.name} getSearchText={(o) => o.search} onSelect={(o) => setProjectFilter(o.id)} aria-label="Фильтр по проекту: поиск по названию, коду и клиенту"/>
            </div>
            <div className="tt-reports__sort-wrap tt-inv__filter-dates">
              <span className="tt-reports__sort-label">Дата счёта</span>
              <div className="tt-inv__filter-dates-row">
                <DatePicker value={listDateFrom} max={listDateTo || undefined} onChange={(iso) => setListDateFrom(iso)} emptyLabel="дд.мм.гггг" portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title="Дата выставления, с" showChevron/>
                {listDateFrom ? (<button type="button" className="tt-inv__date-clear" onClick={() => setListDateFrom('')} aria-label="Сбросить дату «с»" title="Сбросить">
                  ×
                </button>) : null}
                <span className="tt-inv__date-sep" aria-hidden>
                  —
                </span>
                <DatePicker value={listDateTo} min={listDateFrom || undefined} onChange={(iso) => setListDateTo(iso)} emptyLabel="дд.мм.гггг" portal portalZIndex={10050} buttonClassName="tt-reports__date-picker-btn" title="Дата выставления, по" showChevron/>
                {listDateTo ? (<button type="button" className="tt-inv__date-clear" onClick={() => setListDateTo('')} aria-label="Сбросить дату «по»" title="Сбросить">
                  ×
                </button>) : null}
              </div>
            </div>
            <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => {
                loadList();
                void loadAggStats();
            }} disabled={listLoading} title="Обновить список">
              <IcoRefresh /> Обновить
            </button>
          </div>
        </div>

        <div className="tt-reports__table-wrap tt-inv__table-outer">
          {listLoading ? (<div className="tt-inv__loading" role="status" aria-live="polite" aria-busy="true">
              <div className="tt-inv__loading-spinner"/>
              <span>Загрузка счетов…</span>
            </div>) : items.length === 0 ? (<div className="tt-inv__empty">
              <IcoInvoiceEmpty />
              <h3 className="tt-inv__empty-title">Пока нет счетов</h3>
              <p className="tt-inv__empty-text">
                Создайте первый счёт из невыставленного времени и расходов по проекту или измените фильтры.
              </p>
              <button type="button" className="tt-reports__btn tt-reports__btn--accent tt-reports__btn--icon" onClick={openCreateModal}>
                <IcoPlus /> Новый счёт
              </button>
            </div>) : (<div className="tt-inv__table-scroll">
              <table className="tt-reports__table tt-inv__data-table">
                <thead>
                  <tr>
                    <th scope="col">Номер</th>
                    <th scope="col">Клиент</th>
                    <th scope="col">Дата счёта</th>
                    <th scope="col">Срок оплаты</th>
                    <th scope="col" className="tt-inv__th-num">Сумма</th>
                    <th scope="col" className="tt-inv__th-num">Остаток</th>
                    <th scope="col">Статус</th>
                    <th scope="col" className="tt-inv__th-action" aria-label="Действие"/>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => {
                const badgeClass = INVOICE_STATUS_BADGE_CLASS[inv.status] ?? 'tt-inv__badge--neutral';
                return (<tr key={inv.id} className="tt-inv__row" tabIndex={0} onClick={() => openDetail(inv.id)} onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDetail(inv.id);
                        }
                    }}>
                        <td className="tt-inv__td-strong">{inv.invoiceNumber}</td>
                        <td>{clientNameById.get(inv.clientId) ?? inv.clientId}</td>
                        <td>{fmtDisplayDate(inv.issueDate)}</td>
                        <td>{fmtDisplayDate(inv.dueDate)}</td>
                        <td className="tt-inv__td-num">{fmtMoney(inv.totalAmount, inv.currency)}</td>
                        <td className="tt-inv__td-num">{fmtMoney(inv.balanceDue, inv.currency)}</td>
                        <td>
                          <span className={`tt-inv__badge ${badgeClass}`}>
                            {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                          </span>
                        </td>
                        <td className="tt-inv__td-action">
                          <span className="tt-inv__row-cta" aria-hidden>
                            <IcoChevRight />
                          </span>
                        </td>
                      </tr>);
            })}
                </tbody>
              </table>
              {showInvoicePager && (<div className="tt-list-pagination tt-inv__list-pager">
                  <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={listLoading || invoiceListPage <= 1} onClick={() => setInvoiceListPage((p) => Math.max(1, p - 1))}>
                    Назад
                  </button>
                  <span className="tt-list-pagination__meta">Стр. {invoiceListPage}</span>
                  <button type="button" className="tt-settings__btn tt-settings__btn--outline" disabled={invoiceNextDisabled} onClick={() => setInvoiceListPage((p) => p + 1)}>
                    Вперёд
                  </button>
                </div>)}
            </div>)}
        </div>
      </div>

      {createOpen && (<div className="tt-inv-overlay" role="dialog" aria-modal="true" aria-labelledby="tt-inv-create-title">
          <div className="tt-inv-dialog tt-inv-dialog--wide">
            <div className="tt-inv-dialog__head">
              <div className="tt-inv-dialog__head-main">
                <h3 id="tt-inv-create-title">Новый счёт</h3>
                <p className="tt-inv-dialog__sub">Клиент, проект, даты и отбор невыставленных строк. Предпросмотр печатной формы — на отдельной странице.</p>
              </div>
              <button type="button" className="tt-inv-dialog__x" onClick={() => !createBusy && setCreateOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <div className="tt-inv-dialog__body">
              <div className="tt-inv-dialog__section">
                <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2">
                  <div className="tt-inv-dialog__field">
                    <label id="tt-inv-create-client-lbl" className="tt-inv-dialog__label" htmlFor="tt-inv-create-client-btn">Клиент *</label>
                    <SearchableSelect<TimeManagerClientRow> className="tsp-srch tt-inv-dialog-searchable" buttonClassName="tsp-srch__btn tt-inv-dialog-searchable__btn" buttonId="tt-inv-create-client-btn" portalDropdown portalZIndex={12050} portalMinWidth={400} placeholder={clientsErr ? 'Ошибка загрузки клиентов' : clients.length === 0 ? 'Загрузка клиентов…' : 'Выберите или найдите клиента'} emptyListText="Нет клиентов" noMatchText="Клиент не найден" value={createClientId} items={clients} getOptionValue={(c) => c.id} getOptionLabel={(c) => c.name} getSearchText={(c) => `${c.name} ${c.id}`.trim()} onSelect={(c) => {
                setCreateClientId(c.id);
                setCreateProjectId('');
            }} disabled={Boolean(clientsErr) || clients.length === 0} aria-labelledby="tt-inv-create-client-lbl"/>
                  </div>
                  <div className="tt-inv-dialog__field">
                    <label id="tt-inv-create-project-lbl" className="tt-inv-dialog__label" htmlFor="tt-inv-create-project-btn">Проект</label>
                    <SearchableSelect<TimeManagerClientProjectRow> className="tsp-srch tt-inv-dialog-searchable" buttonClassName="tsp-srch__btn tt-inv-dialog-searchable__btn" buttonId="tt-inv-create-project-btn" portalDropdown portalZIndex={12050} portalMinWidth={560} placeholder={!createClientId ? 'Сначала выберите клиента' : projects.length === 0 ? 'Нет проектов' : 'Выберите или найдите проект'} emptyListText="Нет проектов" noMatchText="Проект не найден" value={createProjectId} items={projects} getOptionValue={(p) => p.id} getOptionLabel={(p) => p.code ? `${p.name} (${p.code})` : p.name} getSearchText={(p) => `${p.name} ${p.code ?? ''} ${p.id}`.trim()} onSelect={(p) => setCreateProjectId(p.id)} disabled={!createClientId} aria-labelledby="tt-inv-create-project-lbl"/>
                  </div>
                </div>
              </div>

              <div className="tt-inv-dialog__section">
                <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2">
                  <div className="tt-inv-dialog__field">
                    <span id="tt-inv-issue-date-lbl" className="tt-inv-dialog__label">Дата счёта</span>
                    <DatePicker id="tt-inv-issue-date" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={issueDate} max={dueDate || undefined} onChange={(iso) => setIssueDate(iso)} portal portalZIndex={12100} emptyLabel="дд.мм.гггг" title="Дата счёта" showChevron aria-labelledby="tt-inv-issue-date-lbl"/>
                  </div>
                  <div className="tt-inv-dialog__field">
                    <span id="tt-inv-due-date-lbl" className="tt-inv-dialog__label">Срок оплаты</span>
                    <DatePicker id="tt-inv-due-date" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={dueDate} min={issueDate || undefined} onChange={(iso) => setDueDate(iso)} portal portalZIndex={12100} emptyLabel="дд.мм.гггг" title="Срок оплаты" showChevron aria-labelledby="tt-inv-due-date-lbl"/>
                  </div>
                </div>
              </div>

              <div className="tt-inv-dialog__section tt-inv-dialog__section--callout">
                <p className="tt-inv-dialog__section-title">Невыставленные строки</p>
                <p className="tt-inv-dialog__section-desc">
                  Выберите проект, период и нажмите «Загрузить», чтобы отобрать невыставленное время и расходы для включения в счёт.
                </p>
                <div className="tt-inv-dialog__period-bar">
                  <div className="tt-inv-dialog__field">
                    <span id="tt-inv-unbill-from-lbl" className="tt-inv-dialog__label">С</span>
                    <DatePicker id="tt-inv-unbill-from" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={unbilledFrom} max={unbilledTo || undefined} onChange={(iso) => setUnbilledFrom(iso)} portal portalZIndex={12100} emptyLabel="дд.мм.гггг" title="Период невыставленного, с" showChevron aria-labelledby="tt-inv-unbill-from-lbl"/>
                  </div>
                  <div className="tt-inv-dialog__field">
                    <span id="tt-inv-unbill-to-lbl" className="tt-inv-dialog__label">По</span>
                    <DatePicker id="tt-inv-unbill-to" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={unbilledTo} min={unbilledFrom || undefined} onChange={(iso) => setUnbilledTo(iso)} portal portalZIndex={12100} emptyLabel="дд.мм.гггг" title="Период невыставленного, по" showChevron aria-labelledby="tt-inv-unbill-to-lbl"/>
                  </div>
                  <div className="tt-inv-dialog__period-action">
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" onClick={() => void loadUnbilled()} disabled={unbilledLoading || !createProjectId} title={!createProjectId ? 'Сначала выберите проект' : 'Загрузить невыставленное время и расходы'}>
                      <IcoRefresh />
                      {unbilledLoading ? 'Загрузка…' : 'Загрузить'}
                    </button>
                  </div>
                </div>
              </div>

              {unbilledTime.length > 0 && (<div className="tt-inv-dialog__subsection">
                  <h4 className="tt-inv__section-title">
                    Время ({unbilledTime.length})
                  </h4>
                  <div className="tt-reports__table-wrap tt-inv-dialog__scroll-table">
                    <table className="tt-inv-mini tt-inv-mini--in-dialog">
                      <thead>
                        <tr>
                          <th />
                          <th>Дата</th>
                          <th title="Длительность в формате Ч:ММ">Длит.</th>
                          <th title="Часы (×1.00 ставка для строки счёта)">Часы</th>
                          <th>Сумма</th>
                          <th>Описание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unbilledTime.map((t) => {
                    const seconds = typeof t.durationSeconds === 'number' && Number.isFinite(t.durationSeconds)
                        ? t.durationSeconds
                        : Math.round(Number(t.hours) * 3600);
                    return (<tr key={t.id}>
                              <td>
                                <input type="checkbox" checked={selTime.has(t.id)} onChange={() => setSelTime((prev) => {
                            const n = new Set(prev);
                            if (n.has(t.id))
                                n.delete(t.id);
                            else
                                n.add(t.id);
                            return n;
                        })}/>
                              </td>
                              <td>{t.workDate}</td>
                              <td>{formatHM(seconds)}</td>
                              <td>{Number(t.hours).toFixed(2)}</td>
                              <td>{fmtMoney(t.billableAmount, t.currency)}</td>
                              <td>{t.description ?? '—'}</td>
                            </tr>);
                })}
                      </tbody>
                    </table>
                  </div>
                </div>)}

              {unbilledExp.length > 0 && (<div className="tt-inv-dialog__subsection">
                  <h4 className="tt-inv__section-title">Расходы ({unbilledExp.length})</h4>
                  <div className="tt-reports__table-wrap tt-inv-dialog__scroll-table">
                    <table className="tt-inv-mini tt-inv-mini--in-dialog">
                      <thead>
                        <tr>
                          <th />
                          <th>Дата</th>
                          <th>Сумма USD</th>
                          <th>Статус</th>
                          <th>Описание</th>
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
                    })}/>
                            </td>
                            <td>{String(x.expenseDate)}</td>
                            <td>{fmtMoney(x.equivalentAmount, 'USD')}</td>
                            <td>{x.status}</td>
                            <td>{x.description ?? '—'}</td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </div>)}
            </div>
            <div className="tt-inv-dialog__foot">
              <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => void openInvoicePreview()} disabled={createBusy} title="Открыть три листа A4 и скачать Word или PDF">
                Предпросмотр
              </button>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>Отмена</button>
              <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handleCreate()} disabled={createBusy}>
                {createBusy ? 'Создание…' : 'Создать черновик'}
              </button>
            </div>
          </div>
        </div>)}

      {detailId && (<div className="tt-inv-overlay" role="dialog" aria-modal="true" aria-labelledby="tt-inv-detail-title">
          <div className="tt-inv-dialog tt-inv-dialog--wide">
            <div className="tt-inv-dialog__head">
              <div className="tt-inv-dialog__head-main">
                <h3 id="tt-inv-detail-title">{detailLoading ? 'Загрузка…' : (detail?.invoiceNumber ?? 'Счёт')}</h3>
                {!detailLoading && detail && (<p className="tt-inv-dialog__sub">{clientNameById.get(detail.clientId) ?? detail.clientId}</p>)}
              </div>
              <button type="button" className="tt-inv-dialog__x" onClick={closeDetail} aria-label="Закрыть">×</button>
            </div>
            <div className="tt-inv-dialog__body">
              {!detail || detailLoading ? (<p className="tt-inv__muted">Загрузка карточки…</p>) : (<>
                  <div className="tt-inv-detail-meta">
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">Статус</span>
                      <span className="tt-inv-detail-meta__v">
                        <span className={`tt-inv__badge ${INVOICE_STATUS_BADGE_CLASS[detail.status] ?? 'tt-inv__badge--neutral'}`}>
                          {INVOICE_STATUS_LABELS[detail.status] ?? detail.status}
                        </span>
                      </span>
                    </div>
                    {detail.storedStatus !== detail.status && (<div className="tt-inv-detail-meta__item">
                        <span className="tt-inv-detail-meta__k">В БД</span>
                        <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--mono">{detail.storedStatus}</span>
                      </div>)}
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">Дата счёта</span>
                      <span className="tt-inv-detail-meta__v">{fmtDisplayDate(detail.issueDate)}</span>
                    </div>
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">Срок оплаты</span>
                      <span className="tt-inv-detail-meta__v">{fmtDisplayDate(detail.dueDate)}</span>
                    </div>
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">Сумма</span>
                      <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num">{fmtMoney(detail.totalAmount, detail.currency)}</span>
                    </div>
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">Оплачено</span>
                      <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num">{fmtMoney(detail.amountPaid, detail.currency)}</span>
                    </div>
                    <div className="tt-inv-detail-meta__item">
                      <span className="tt-inv-detail-meta__k">Остаток</span>
                      <span className="tt-inv-detail-meta__v tt-inv-detail-meta__v--num tt-inv-detail-meta__v--strong">{fmtMoney(detail.balanceDue, detail.currency)}</span>
                    </div>
                  </div>
                  <div className="tt-inv-detail-export" role="group" aria-label="Предпросмотр и экспорт">
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => openExistingInvoicePreview(detail)} title="Три страницы A4 и скачивание PDF / Word">
                      Предпросмотр
                    </button>
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => void handleDetailDownloadPdf(detail)}>
                      {detailExportBusy === 'pdf' ? 'Подготовка PDF…' : 'Скачать PDF'}
                    </button>
                    <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={Boolean(actionBusy || detailExportBusy)} onClick={() => void handleDetailDownloadWord(detail)}>
                      {detailExportBusy === 'word' ? 'Подготовка Word…' : 'Скачать Word'}
                    </button>
                  </div>
                  <div className="tt-inv-actions">
                    {invoiceCanSend(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={async () => {
                        setActionBusy(true);
                        try {
                            await sendInvoice(detail.id);
                            await refreshDetail(detail.id);
                        }
                        catch (e) {
                            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    }}>
                        {invoiceSendActionLabel(detail.status as InvoiceUiStatus)}
                      </button>)}
                    {invoiceCanMarkViewed(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
                        setActionBusy(true);
                        try {
                            await markInvoiceViewed(detail.id);
                            await refreshDetail(detail.id);
                        }
                        catch (e) {
                            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    }}>
                        Отметить просмотренным
                      </button>)}
                    {invoiceCanRegisterPayment(detail.status as InvoiceUiStatus, detail.balanceDue) && (<>
                        <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleFullPaymentNow()}>
                          Оплачено полностью
                        </button>
                        <button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={() => {
                        setPayAmount(detail.balanceDue > 1e-9 ? String(detail.balanceDue).replace('.', ',') : '');
                        setPayAt(formatDatetimeLocalInput());
                        setPayOpen(true);
                    }}>
                          Частичная оплата…
                        </button>
                      </>)}
                    {invoiceCanCancel(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
                        if (!await showConfirm({
                            title: 'Отменить счёт?',
                            message: 'Счёт будет отменён. Продолжить?',
                            variant: 'danger',
                            confirmLabel: 'Отменить счёт',
                        }))
                            return;
                        setActionBusy(true);
                        try {
                            await cancelInvoice(detail.id);
                            await refreshDetail(detail.id);
                        }
                        catch (e) {
                            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    }}>
                        Отменить счёт
                      </button>)}
                    {invoiceCanDeleteDraft(detail.status as InvoiceUiStatus) && (<button type="button" className="tt-reports__btn tt-reports__btn--outline" disabled={actionBusy} onClick={async () => {
                        if (!await showConfirm({
                            title: 'Удалить черновик?',
                            message: 'Черновик будет удалён без возможности восстановления.',
                            variant: 'danger',
                            confirmLabel: 'Удалить',
                        }))
                            return;
                        setActionBusy(true);
                        try {
                            await deleteDraftInvoice(detail.id);
                            closeDetail();
                            loadList();
                            void loadAggStats();
                            notifyReportsInvalidated();
                        }
                        catch (e) {
                            await showAlert({ message: e instanceof Error ? e.message : 'Ошибка' });
                        }
                        finally {
                            setActionBusy(false);
                        }
                    }}>
                        Удалить черновик
                      </button>)}
                  </div>

                  {invoiceCanPatchDraft(detail.status as InvoiceUiStatus) && (<div className="tt-inv-draft">
                      <p className="tt-inv-draft__hint">Редактирование только в черновике: даты, налоги и примечания — затем «Сохранить черновик».</p>
                      <div className="tt-inv-dialog__grid tt-inv-dialog__grid--draft-invoice">
                        <div className="tt-inv-dialog__field">
                          <span id="inv-draft-issue-lbl" className="tt-inv-dialog__label">Дата счёта</span>
                          <DatePicker id="inv-draft-issue" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={draftIssueDate} max={draftDueDate || undefined} onChange={(iso) => setDraftIssueDate(iso)} portal portalZIndex={12100} emptyLabel="дд.мм.гггг" title="Дата счёта" showChevron aria-labelledby="inv-draft-issue-lbl"/>
                        </div>
                        <div className="tt-inv-dialog__field">
                          <span id="inv-draft-due-lbl" className="tt-inv-dialog__label">Срок оплаты</span>
                          <DatePicker id="inv-draft-due" className="tt-inv-dialog-dp" buttonClassName="tt-inv-dialog-dp-btn" value={draftDueDate} min={draftIssueDate || undefined} onChange={(iso) => setDraftDueDate(iso)} portal portalZIndex={12100} emptyLabel="дд.мм.гггг" title="Срок оплаты" showChevron aria-labelledby="inv-draft-due-lbl"/>
                        </div>
                        <div className="tt-inv-dialog__field">
                          <label className="tt-inv-dialog__label" htmlFor="inv-tax1">Налог % (1)</label>
                          <input id="inv-tax1" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftTaxPct} onChange={(e) => setDraftTaxPct(e.target.value)} placeholder="например 20"/>
                        </div>
                        <div className="tt-inv-dialog__field">
                          <label className="tt-inv-dialog__label" htmlFor="inv-tax2">Налог % (2)</label>
                          <input id="inv-tax2" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftTax2Pct} onChange={(e) => setDraftTax2Pct(e.target.value)} placeholder="необязательно"/>
                        </div>
                        <div className="tt-inv-dialog__field">
                          <label className="tt-inv-dialog__label" htmlFor="inv-disc">Скидка %</label>
                          <input id="inv-disc" type="text" inputMode="decimal" className="tt-inv-dialog__control" value={draftDiscPct} onChange={(e) => setDraftDiscPct(e.target.value)} placeholder="необязательно"/>
                        </div>
                      </div>
                      <div className="tt-inv-draft__notes">
                        <label htmlFor="inv-client-note">
                          Примечание для клиента
                          <textarea className="tt-inv__textarea" rows={3} defaultValue={detail.clientNote ?? ''} id="inv-client-note"/>
                        </label>
                        <label htmlFor="inv-int-note">
                          Внутреннее примечание
                          <textarea className="tt-inv__textarea" rows={3} defaultValue={detail.internalNote ?? ''} id="inv-int-note"/>
                        </label>
                      </div>
                      <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={actionBusy} onClick={() => void handleSaveDraft()}>
                        Сохранить черновик
                      </button>
                    </div>)}

                  {payOpen && (<div className="tt-inv-pay">
                      <h4 className="tt-inv__section-title">Платёж</h4>
                      <p className="tt-inv-pay__hint">
                        Пустая сумма — спишется весь остаток. Пустая дата — время оплаты «сейчас» (UTC на сервере).
                      </p>
                      <label>
                        Сумма (необяз.)
                        <input className="tt-inv__input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Весь остаток, если пусто"/>
                      </label>
                      <label>
                        Дата и время (необяз.)
                        <input type="datetime-local" className="tt-inv__input" value={payAt} onChange={(e) => setPayAt(e.target.value)}/>
                      </label>
                      <label>
                        Способ (необяз.)
                        <input className="tt-inv__input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}/>
                      </label>
                      <label>
                        Комментарий
                        <input className="tt-inv__input" value={payNote} onChange={(e) => setPayNote(e.target.value)}/>
                      </label>
                      <div className="tt-inv-actions">
                        <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setPayOpen(false)} disabled={actionBusy}>Отмена</button>
                        <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void handlePayment()} disabled={actionBusy}>Записать оплату</button>
                      </div>
                    </div>)}

                  <div className="tt-inv-detail__section-divider" role="presentation" aria-hidden/>
                  <h4 className="tt-inv__section-title">Аудит</h4>
                  {auditLoading ? <p className="tt-inv__muted">Загрузка истории…</p> : null}
                  {!auditLoading && auditErr ? (<p className="tt-inv__muted">История изменений недоступна (см. уведомление).</p>) : null}
                  {!auditLoading && !auditErr && auditEntries.length === 0 ? (<p className="tt-inv__muted">Записей аудита нет.</p>) : null}
                  {!auditLoading && !auditErr && auditEntries.length > 0 ? (<ul className="tt-inv-audit">
                      {auditEntries.map((a) => (<li key={a.id} className="tt-inv-audit__item">
                          <span className="tt-inv-audit__meta">
                            {new Date(a.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })} · #{a.actorAuthUserId}
                          </span>
                          <span className="tt-inv-audit__action">{a.action}</span>
                          {a.detail ? <span className="tt-inv-audit__detail">{a.detail}</span> : null}
                        </li>))}
                    </ul>) : null}

                  <div className="tt-inv-detail__section-divider" role="presentation" aria-hidden/>
                  <h4 className="tt-inv__section-title">Строки счёта</h4>
                  <div className="tt-reports__table-wrap tt-inv-dialog__scroll-table">
                    <table className="tt-inv-mini tt-inv-mini--in-dialog">
                      <thead>
                        <tr>
                          <th>Вид</th>
                          <th>Описание</th>
                          <th>Кол-во</th>
                          <th>Цена</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.lines ?? []).map((ln) => (<tr key={ln.id}>
                            <td>
                              <span className={`tt-inv-line-kind tt-inv-line-kind--${invoiceLineKindSlug(ln)}`}>
                                {invoiceLineKindLabel(ln)}
                              </span>
                            </td>
                            <td>{ln.description ?? '—'}</td>
                            <td>{ln.quantity}</td>
                            <td>{ln.unitAmount}</td>
                            <td>{ln.lineTotal}</td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>

                  {(detail.payments ?? []).length > 0 && (<>
                      <h4 className="tt-inv__section-title">Платежи</h4>
                      <ul className="tt-inv-payments">
                        {detail.payments!.map((p) => (<li key={p.id}>{fmtMoney(p.amount, detail.currency)} — {p.paidAt}</li>))}
                      </ul>
                    </>)}
                </>)}
            </div>
          </div>
        </div>)}
    </div>);
}
