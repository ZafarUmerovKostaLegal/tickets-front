import { apiFetch } from '@shared/api';
import { throwIfNotOk, dashNum } from './httpShared';

export type InvoiceUiStatus = 'draft' | 'sent' | 'viewed' | 'partial_paid' | 'paid' | 'canceled' | 'overdue';
export type InvoiceLineDto = {
    id: string;
    sortOrder: number;
    lineKind: string;
    description: string | null;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
    timeEntryId: string | null;
    expenseRequestId: string | null;

    timeEntryWorkDate?: string | null;

    timeAuthorAuthUserId?: number | null;

    expenseDate?: string | null;
    sourceCurrency?: string | null;
    sourceAmount?: number | null;
    fxRate?: number | null;
};
export type InvoicePaymentDto = {
    id: string;
    amount: number;
    paymentMethod: string | null;
    note: string | null;
    recordedByAuthUserId: number;
    paidAt: string;
    createdAt: string;
};
export type InvoiceDto = {
    id: string;
    clientId: string;
    projectId: string | null;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    status: InvoiceUiStatus;
    storedStatus: string;
    subtotal: number;
    discountPercent: number | null;
    taxPercent: number | null;
    tax2Percent: number | null;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    clientNote: string | null;
    internalNote: string | null;
    /** Preview polish (legal / cover / time report). */
    documentOverrides?: Record<string, unknown> | null;
    sentAt: string | null;
    lastSentAt: string | null;
    viewedAt: string | null;
    canceledAt: string | null;
    createdByAuthUserId: number;
    createdAt: string;
    updatedAt: string | null;
    lines?: InvoiceLineDto[];
    payments?: InvoicePaymentDto[];

    partnerBillingPeriodFrom?: string | null;
    partnerBillingPeriodTo?: string | null;
    partnerConfirmationSnapshotId?: string | null;
    partnerConfirmationRequestId?: string | null;

    requiresPaymentConfirmationDocument?: boolean;
    paymentConfirmationDocumentUrl?: string | null;
    paymentConfirmationRecordedAt?: string | null;
};
export type UnbilledTimeEntryDto = {
    id: string;
    authUserId: number;
    workDate: string;
    hours: number;
    billableHours?: number;
    roundedHours?: number;
    durationSeconds?: number;
    description: string | null;
    billableAmount: number;
    currency: string;
    sourceCurrency?: string;
    packageCovered?: boolean;
    coveredHours?: number | null;
    overageHours?: number | null;
};
export type UnbilledExpenseEntryDto = {
    id: string;
    expenseDate: string;
    description: string | null;
    equivalentAmount: number;
    status: string;
};
export type PartnerInvoicePreviewDto = {
    currency: string;
    expectedSubtotal: number;
    timeSubtotal: number;
    expenseSubtotal: number;
    packageFeeSubtotal: number;
    timeEntryIds: string[];
    expenseIds: string[];
    lines: Array<{
        lineKind: string;
        description: string;
        quantity: number;
        unitAmount: number;
        lineTotal: number;
        sourceCurrency: string;
        sourceAmount: number;
        fxRate: number;
        timeEntryId?: string | null;
        expenseRequestId?: string | null;
        packageMonth?: string | null;
    }>;
    fxUsed: Array<{
        sourceAmount: number;
        sourceCurrency: string;
        targetCurrency: string;
        fxRate: number;
        convertedAmount: number;
    }>;
    projectCurrency: string;
    droppedDuplicateCount: number;
};
export type InvoiceListParams = {
    clientId?: string;
    projectId?: string;
    status?: InvoiceUiStatus | string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    
    includeTotalCount?: boolean;

    partnerBillingProjectId?: string;
    partnerBillingPeriodFrom?: string;
    partnerBillingPeriodTo?: string;
};
export type InvoicesListResponse = {
    items: InvoiceDto[];
    limit: number;
    offset: number;
    totalCount?: number;

    partnerConfirmationBlocked?: boolean;
};
export type InvoicesStatsCurrencyRow = {
    count: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
};
export type InvoicesAggregatedStats = {
    totalInvoices: number;
    byEffectiveStatus: Record<string, number>;
    byCurrency: Record<string, InvoicesStatsCurrencyRow>;
    totals: {
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
    };
    unpaidInvoicesCount: number;
    openBalanceDue: number;
    isCapped: boolean;
    cappedAt?: number;
};
export type InvoiceLineCreateInput = {
    lineKind: 'manual' | 'time' | 'expense';
    description?: string | null;
    quantity?: number | null;
    unitAmount?: number | null;
    lineTotal?: number | null;
    timeEntryId?: string | null;
    expenseRequestId?: string | null;
};
export type InvoiceCreateInput = {
    clientId: string;
    projectId?: string | null;
    issueDate: string;
    dueDate: string;
    invoiceNumber?: string | null;
    currency?: string | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    discountAmount?: number | null;
    clientNote?: string | null;
    internalNote?: string | null;
    timeEntryIds?: string[];
    expenseIds?: string[];
    lines?: InvoiceLineCreateInput[];

    partnerBillingPeriodFrom?: string;
    partnerBillingPeriodTo?: string;
    partnerConfirmationRequestId?: string;
    /** Client-facing total; closes selected time/expenses but bills this amount. */
    billedAmount?: number | null;
    /** Service line on the legal invoice page (with billedAmount). */
    serviceDescription?: string | null;
};
export type InvoicePatchInput = {
    issueDate?: string;
    dueDate?: string;
    invoiceNumber?: string | null;
    clientNote?: string | null;
    internalNote?: string | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    discountAmount?: number | null;
    projectId?: string | null;
    lines?: Record<string, unknown>[] | null;
    /** Preview document overrides; `null` clears stored overrides. */
    documentOverrides?: Record<string, unknown> | null;
};
export type InvoicePaymentInput = {
    amount?: number | string | null;
    paidAt?: string | null;
    paymentMethod?: string | null;
    note?: string | null;
};
export type InvoicePaymentConfirmationInput = {
    documentUrl?: string;
    document_url?: string;
};
export type InvoiceAuditEntryDto = {
    id: string;
    action: string;
    detail: string | null;
    actorAuthUserId: number;
    createdAt: string;
};
export function buildInvoiceListQs(p: InvoiceListParams): string {
    const qs = new URLSearchParams();
    if (p.clientId)
        qs.set('clientId', p.clientId);
    if (p.projectId)
        qs.set('projectId', p.projectId);
    if (p.status)
        qs.set('status', p.status);
    if (p.dateFrom)
        qs.set('dateFrom', p.dateFrom);
    if (p.dateTo)
        qs.set('dateTo', p.dateTo);
    if (p.limit != null)
        qs.set('limit', String(p.limit));
    if (p.offset != null)
        qs.set('offset', String(p.offset));
    if (p.includeTotalCount)
        qs.set('includeTotalCount', 'true');
    if (p.partnerBillingProjectId?.trim())
        qs.set('partnerBillingProjectId', p.partnerBillingProjectId.trim());
    if (p.partnerBillingPeriodFrom?.trim())
        qs.set('partnerBillingPeriodFrom', p.partnerBillingPeriodFrom.trim().slice(0, 10));
    if (p.partnerBillingPeriodTo?.trim())
        qs.set('partnerBillingPeriodTo', p.partnerBillingPeriodTo.trim().slice(0, 10));
    const s = qs.toString();
    return s ? `?${s}` : '';
}
export function buildInvoiceStatsQs(p: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>): string {
    const qs = new URLSearchParams();
    if (p.clientId)
        qs.set('clientId', p.clientId);
    if (p.projectId)
        qs.set('projectId', p.projectId);
    if (p.status)
        qs.set('status', p.status);
    if (p.dateFrom)
        qs.set('dateFrom', p.dateFrom);
    if (p.dateTo)
        qs.set('dateTo', p.dateTo);
    if (p.partnerBillingProjectId?.trim())
        qs.set('partnerBillingProjectId', p.partnerBillingProjectId.trim());
    if (p.partnerBillingPeriodFrom?.trim())
        qs.set('partnerBillingPeriodFrom', p.partnerBillingPeriodFrom.trim().slice(0, 10));
    if (p.partnerBillingPeriodTo?.trim())
        qs.set('partnerBillingPeriodTo', p.partnerBillingPeriodTo.trim().slice(0, 10));
    const s = qs.toString();
    return s ? `?${s}` : '';
}
export function parseInvoicesAggregatedStats(raw: unknown): InvoicesAggregatedStats {
    const empty: InvoicesAggregatedStats = {
        totalInvoices: 0,
        byEffectiveStatus: {},
        byCurrency: {},
        totals: { totalAmount: 0, amountPaid: 0, balanceDue: 0 },
        unpaidInvoicesCount: 0,
        openBalanceDue: 0,
        isCapped: false,
    };
    if (!raw || typeof raw !== 'object')
        return empty;
    const o = raw as Record<string, unknown>;
    const byEff = o.byEffectiveStatus ?? o.by_effective_status;
    const byCur = o.byCurrency ?? o.by_currency;
    const totalsRaw = o.totals;
    const out: InvoicesAggregatedStats = {
        ...empty,
        totalInvoices: typeof o.totalInvoices === 'number' ? o.totalInvoices : Number(o.totalInvoices ?? o.total_invoices) || 0,
        unpaidInvoicesCount: typeof o.unpaidInvoicesCount === 'number'
            ? o.unpaidInvoicesCount
            : Number(o.unpaidInvoicesCount ?? o.unpaid_invoices_count) || 0,
        openBalanceDue: dashNum(o.openBalanceDue ?? o.open_balance_due),
        isCapped: o.isCapped === true || o.is_capped === true,
        cappedAt: typeof o.cappedAt === 'number' ? o.cappedAt : (typeof o.capped_at === 'number' ? o.capped_at : undefined),
    };
    if (byEff && typeof byEff === 'object' && !Array.isArray(byEff)) {
        const m: Record<string, number> = {};
        for (const [k, v] of Object.entries(byEff as Record<string, unknown>))
            m[k] = typeof v === 'number' ? v : Number(v) || 0;
        out.byEffectiveStatus = m;
    }
    if (byCur && typeof byCur === 'object' && !Array.isArray(byCur)) {
        const cur: Record<string, InvoicesStatsCurrencyRow> = {};
        for (const [code, row] of Object.entries(byCur as Record<string, unknown>)) {
            if (!row || typeof row !== 'object')
                continue;
            const r = row as Record<string, unknown>;
            cur[code] = {
                count: typeof r.count === 'number' ? r.count : Number(r.count) || 0,
                totalAmount: dashNum(r.totalAmount ?? r.total_amount),
                amountPaid: dashNum(r.amountPaid ?? r.amount_paid),
                balanceDue: dashNum(r.balanceDue ?? r.balance_due),
            };
        }
        out.byCurrency = cur;
    }
    if (totalsRaw && typeof totalsRaw === 'object') {
        const t = totalsRaw as Record<string, unknown>;
        out.totals = {
            totalAmount: dashNum(t.totalAmount ?? t.total_amount),
            amountPaid: dashNum(t.amountPaid ?? t.amount_paid),
            balanceDue: dashNum(t.balanceDue ?? t.balance_due),
        };
    }
    return out;
}
export async function fetchUnbilledTimeEntries(params: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}): Promise<UnbilledTimeEntryDto[]> {
    const qs = new URLSearchParams({
        projectId: params.projectId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
    });
    const res = await apiFetch(`/api/v1/time-tracking/invoices/unbilled-time?${qs}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return res.json() as Promise<UnbilledTimeEntryDto[]>;
}
export async function fetchUnbilledExpenses(params: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}): Promise<UnbilledExpenseEntryDto[]> {
    const qs = new URLSearchParams({
        projectId: params.projectId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
    });
    const res = await apiFetch(`/api/v1/time-tracking/invoices/unbilled-expenses?${qs}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return res.json() as Promise<UnbilledExpenseEntryDto[]>;
}

export type EnsureInvoiceFxRatesInput = {
    dates: string[];
    currency?: string;
    rates?: Array<{
        fromCurrency: string;
        toCurrency: string;
        rateDate: string;
        rate: number;
    }>;
};

export type EnsureInvoiceFxRatesResult = {
    ok: boolean;
    dates: string[];
    currency: string;
};

/** Seed time_tracking_fx_rates from CBU (client-fetched rates preferred). */
export async function ensureInvoiceFxRates(body: EnsureInvoiceFxRatesInput): Promise<EnsureInvoiceFxRatesResult> {
    const dates = [...new Set(
        (body.dates ?? [])
            .map((d) => String(d ?? '').trim().slice(0, 10))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    )];
    const rates = Array.isArray(body.rates) ? body.rates.filter((r) =>
        r
        && /^\d{4}-\d{2}-\d{2}$/.test(String(r.rateDate ?? '').slice(0, 10))
        && Number.isFinite(Number(r.rate))
        && Number(r.rate) > 0
        && String(r.fromCurrency ?? '').trim()
        && String(r.toCurrency ?? '').trim(),
    ) : [];
    if (dates.length === 0 && rates.length === 0)
        return { ok: true, dates: [], currency: (body.currency ?? 'USD').trim().toUpperCase() || 'USD' };
    const payload: Record<string, unknown> = {};
    if (dates.length)
        payload.dates = dates;
    if (rates.length)
        payload.rates = rates.map((r) => ({
            fromCurrency: String(r.fromCurrency).trim().toUpperCase(),
            toCurrency: String(r.toCurrency).trim().toUpperCase(),
            rateDate: String(r.rateDate).trim().slice(0, 10),
            rate: Number(r.rate),
        }));
    const ccy = body.currency?.trim().toUpperCase();
    if (ccy)
        payload.currency = ccy;
    const res = await apiFetch('/api/v1/time-tracking/invoices/fx-rates/ensure', {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    const raw = await res.json() as Record<string, unknown>;
    return {
        ok: raw.ok !== false,
        dates: Array.isArray(raw.dates) ? raw.dates.map(String) : dates,
        currency: String(raw.currency ?? ccy ?? 'USD'),
    };
}

/**
 * Ask the backend to seed time_tracking_fx_rates for billing dates.
 * Prefer server-side CBU fetch (one POST) — avoids browser /cbu-rates + direct cbu.uz spam.
 * Optionally attach client-fetched rates when already cached.
 */
export async function ensureInvoiceFxRatesForBilling(opts: {
    dateFrom?: string | null;
    dateTo?: string | null;
    issueDate?: string | null;
    /** Extra rate dates (e.g. last day of previous month for custom-billed FX). */
    extraDates?: readonly string[] | null;
    expenseDates?: readonly string[] | null;
    currency?: string | null;
}): Promise<void> {
    const dates = [...new Set([
        opts.dateFrom,
        opts.dateTo,
        opts.issueDate,
        ...(opts.extraDates ?? []),
        ...(opts.expenseDates ?? []),
    ]
        .map((d) => String(d ?? '').trim().slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
    if (dates.length === 0)
        return;

    const currency = opts.currency?.trim().toUpperCase() || undefined;

    // Reuse in-memory CBU cache if present (expenses form may have warmed it).
    // Do not trigger new gateway/direct CBU calls here — backend ensure seeds from CBU.
    let rates: Array<{
        fromCurrency: string;
        toCurrency: string;
        rateDate: string;
        rate: number;
    }> = [];
    try {
        const { cbuParsedToInvoiceFxRates, peekCachedCbuParsedForDate } = await import('@entities/expenses/model/cbuRates');
        if (typeof peekCachedCbuParsedForDate === 'function') {
            for (const d of dates) {
                const parsed = peekCachedCbuParsedForDate(d);
                if (parsed)
                    rates.push(...cbuParsedToInvoiceFxRates(parsed, d));
            }
        }
    }
    catch {
        rates = [];
    }

    await ensureInvoiceFxRates({
        dates,
        currency,
        ...(rates.length > 0 ? { rates } : {}),
    });
}

export async function fetchPartnerInvoicePreview(params: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    currency?: string;
    issueDate?: string;
    clientId?: string;
}): Promise<PartnerInvoicePreviewDto> {
    const qs = new URLSearchParams({
        projectId: params.projectId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
    });
    if (params.currency?.trim())
        qs.set('currency', params.currency.trim().toUpperCase());
    if (params.issueDate?.trim())
        qs.set('issueDate', params.issueDate.trim().slice(0, 10));
    if (params.clientId?.trim())
        qs.set('clientId', params.clientId.trim());
    const res = await apiFetch(
        `/api/v1/time-tracking/invoices/from-partner-period/preview?${qs}`,
        invoiceApiFetchInit,
    );
    await throwIfNotOk(res);
    const raw = await res.json() as Record<string, unknown>;
    return {
        currency: String(raw.currency ?? 'USD'),
        expectedSubtotal: dashNum(raw.expectedSubtotal ?? raw.expected_subtotal),
        timeSubtotal: dashNum(raw.timeSubtotal ?? raw.time_subtotal),
        expenseSubtotal: dashNum(raw.expenseSubtotal ?? raw.expense_subtotal),
        packageFeeSubtotal: dashNum(raw.packageFeeSubtotal ?? raw.package_fee_subtotal),
        timeEntryIds: Array.isArray(raw.timeEntryIds)
            ? (raw.timeEntryIds as unknown[]).map(String)
            : Array.isArray(raw.time_entry_ids)
                ? (raw.time_entry_ids as unknown[]).map(String)
                : [],
        expenseIds: Array.isArray(raw.expenseIds)
            ? (raw.expenseIds as unknown[]).map(String)
            : Array.isArray(raw.expense_ids)
                ? (raw.expense_ids as unknown[]).map(String)
                : [],
        lines: Array.isArray(raw.lines) ? raw.lines as PartnerInvoicePreviewDto['lines'] : [],
        fxUsed: Array.isArray(raw.fxUsed)
            ? raw.fxUsed as PartnerInvoicePreviewDto['fxUsed']
            : Array.isArray(raw.fx_used)
                ? raw.fx_used as PartnerInvoicePreviewDto['fxUsed']
                : [],
        projectCurrency: String(raw.projectCurrency ?? raw.project_currency ?? 'USD'),
        droppedDuplicateCount: dashNum(raw.droppedDuplicateCount ?? raw.dropped_duplicate_count),
    };
}
export function readPartnerConfirmationBlocked(o: Record<string, unknown>): boolean {
    const v = o.partnerConfirmationBlocked ?? o.partner_confirmation_blocked;
    return v === true || v === 'true';
}

const invoiceApiFetchInit: RequestInit = { cache: 'no-store' };

export async function listInvoices(params?: InvoiceListParams, signal?: AbortSignal): Promise<InvoicesListResponse> {
    const normalizeItem = (row: unknown): InvoiceDto => {
        try {
            return normalizeInvoiceDto(row);
        }
        catch {
            return row as InvoiceDto;
        }
    };
    const res = await apiFetch(`/api/v1/time-tracking/invoices${buildInvoiceListQs(params ?? {})}`, {
        ...invoiceApiFetchInit,
        signal,
    });
    await throwIfNotOk(res);
    const raw = await res.json();
    if (Array.isArray(raw)) {
        return {
            items: raw.map(normalizeItem),
            limit: params?.limit ?? raw.length,
            offset: params?.offset ?? 0,
            partnerConfirmationBlocked: false,
        };
    }
    if (!raw || typeof raw !== 'object')
        return { items: [], limit: params?.limit ?? 0, offset: params?.offset ?? 0, partnerConfirmationBlocked: false };
    const o = raw as Record<string, unknown>;
    const itemsRaw = o.items;
    const itemsRawArr = Array.isArray(itemsRaw) ? itemsRaw : [];
    const items = itemsRawArr.map(normalizeItem);
    const limit = typeof o.limit === 'number' ? o.limit : Number(o.limit) || (params?.limit ?? 0);
    const offset = typeof o.offset === 'number' ? o.offset : Number(o.offset) || (params?.offset ?? 0);
    const tcRaw = o.totalCount ?? o.total_count;
    const totalCount = tcRaw != null && String(tcRaw).trim() !== '' && Number.isFinite(Number(tcRaw))
        ? Number(tcRaw)
        : undefined;
    const partnerConfirmationBlocked = readPartnerConfirmationBlocked(o);
    return {
        items,
        limit,
        offset,
        ...(totalCount != null ? { totalCount } : {}),
        ...(partnerConfirmationBlocked ? { partnerConfirmationBlocked: true } : {}),
    };
}
export async function getInvoicesAggregatedStats(params?: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>, signal?: AbortSignal): Promise<InvoicesAggregatedStats> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/stats${buildInvoiceStatsQs(params ?? {})}`, {
        ...invoiceApiFetchInit,
        signal,
    });
    await throwIfNotOk(res);
    const raw = await res.json();
    return parseInvoicesAggregatedStats(raw);
}

export const INVOICE_AGGR_BALANCE_EPS = 1e-6;
export const INVOICE_AGGR_PAGE = 500;
export const INVOICE_AGGR_MAX_OFFSET = 250_000;

export async function fetchAllInvoices(params?: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>, signal?: AbortSignal): Promise<InvoiceDto[]> {
    const p = params ?? {};
    const all: InvoiceDto[] = [];
    let offset = 0;
    for (;;) {
        const r = await listInvoices({
            ...p,
            limit: INVOICE_AGGR_PAGE,
            offset,
            includeTotalCount: false,
        }, signal);
        all.push(...r.items);
        if (r.items.length < INVOICE_AGGR_PAGE)
            break;
        offset += INVOICE_AGGR_PAGE;
        if (offset > INVOICE_AGGR_MAX_OFFSET)
            break;
    }
    return all;
}

export async function aggregateInvoicesMoneyExcludingCanceled(params?: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>, signal?: AbortSignal): Promise<{
    byCurrency: Record<string, InvoicesStatsCurrencyRow>;
    unpaidInvoicesCount: number;
    openBalanceDue: number;
}> {
    const p = params ?? {};
    const byCurrency: Record<string, InvoicesStatsCurrencyRow> = {};
    let unpaidInvoicesCount = 0;
    let openBalanceDue = 0;
    const invoices = await fetchAllInvoices(p, signal);
    for (const inv of invoices) {
        const st = String(inv.status ?? '').toLowerCase();
        if (st === 'canceled' || st === 'cancelled')
            continue;
        const cur = (inv.currency && inv.currency.trim()) ? inv.currency.trim() : 'UZS';
        const prev = byCurrency[cur] ?? {
            count: 0,
            totalAmount: 0,
            amountPaid: 0,
            balanceDue: 0,
        };
        prev.count += 1;
        prev.totalAmount += Number(inv.totalAmount) || 0;
        prev.amountPaid += Number(inv.amountPaid) || 0;
        prev.balanceDue += Number(inv.balanceDue) || 0;
        byCurrency[cur] = prev;
        const bd = Number(inv.balanceDue) || 0;
        if (bd > INVOICE_AGGR_BALANCE_EPS) {
            unpaidInvoicesCount += 1;
            openBalanceDue += bd;
        }
    }
    return { byCurrency, unpaidInvoicesCount, openBalanceDue };
}

export function normalizeInvoiceLineDto(raw: unknown, fallbackIdx: number): InvoiceLineDto {
    const r = (raw != null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const pickStr = (...keys: string[]): string => {
        for (const k of keys) {
            const v = r[k];
            if (v == null || v === '')
                continue;
            const s = String(v).trim();
            if (s.length)
                return s;
        }
        return '';
    };
    const pickNum = (...keys: string[]): number => {
        for (const k of keys) {
            const v = r[k];
            if (typeof v === 'number' && Number.isFinite(v))
                return v;
            if (typeof v === 'string' && v.trim() !== '') {
                const n = Number(v.replace(',', '.'));
                if (Number.isFinite(n))
                    return n;
            }
        }
        return 0;
    };
    const id = pickStr('id', 'lineId', 'line_id');
    const lk = pickStr('lineKind', 'line_kind', 'kind', 'lineType', 'line_type').toLowerCase();
    const descRaw = r.description ?? r.line_description ?? r.lineDescription;
    let description: string | null = null;
    if (typeof descRaw === 'string')
        description = descRaw.trim() || null;
    else if (descRaw != null)
        description = String(descRaw).trim() || null;
    const timeEntryPick = pickStr('timeEntryId', 'time_entry_id', 'timeEntryID') || null;
    const expensePick = pickStr('expenseRequestId', 'expense_request_id', 'expenseId', 'expense_id') || null;

    const wdRaw = pickStr('timeEntryWorkDate', 'time_entry_work_date');
    const wdSlice = wdRaw.slice(0, 10);
    const timeEntryWorkDate = /^\d{4}-\d{2}-\d{2}$/.test(wdSlice) ? wdSlice : undefined;

    const expDateRaw = pickStr(
        'expenseDate',
        'expense_date',
        'expenseExpenseDate',
        'expense_expense_date',
        'expenseRequestDate',
        'expense_request_date',
        'incurred_date',
        'incurredDate',
    );
    const expSlice = expDateRaw.slice(0, 10);
    const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(expSlice) ? expSlice : undefined;

    let timeAuthorAuthUserId: number | undefined = undefined;
    for (const k of ['timeAuthorAuthUserId', 'time_author_auth_user_id'] as const) {
        const v = r[k];
        if (typeof v === 'number' && Number.isFinite(v)) {
            timeAuthorAuthUserId = Math.trunc(v);
            break;
        }
        if (typeof v === 'string' && v.trim() !== '') {
            const n = Number(v.trim());
            if (Number.isFinite(n)) {
                timeAuthorAuthUserId = Math.trunc(n);
                break;
            }
        }
    }

    const lineKindExplicit = lk && lk !== '' ? lk : 'other';

    let lineKindResolved = lineKindExplicit;
    if (timeEntryPick || lineKindExplicit === 'time')
        lineKindResolved = 'time';
    else if (expensePick || lineKindExplicit === 'expense')
        lineKindResolved = 'expense';
    else if (lineKindExplicit === 'manual')
        lineKindResolved = 'manual';

    const sortRaw = r.sortOrder ?? r.sort_order ?? fallbackIdx;
    const sourceCurrency = pickStr('sourceCurrency', 'source_currency') || null;
    const sourceAmountRaw = r.sourceAmount ?? r.source_amount;
    const sourceAmount = sourceAmountRaw != null && String(sourceAmountRaw).trim() !== ''
        ? pickNum('sourceAmount', 'source_amount')
        : null;
    const fxRateRaw = r.fxRate ?? r.fx_rate;
    const fxRate = fxRateRaw != null && String(fxRateRaw).trim() !== ''
        ? pickNum('fxRate', 'fx_rate')
        : null;

    return {
        id: id.length ? id : `line-${fallbackIdx}`,
        sortOrder: typeof sortRaw === 'number' && Number.isFinite(sortRaw) ? sortRaw : Number(sortRaw) || fallbackIdx,
        lineKind: lineKindResolved,
        description,
        quantity: pickNum('quantity', 'qty', 'hours_quantity'),
        unitAmount: pickNum('unitAmount', 'unit_amount', 'rate', 'hourly_rate'),
        lineTotal: pickNum('lineTotal', 'line_total', 'total', 'amount', 'billable_amount'),
        timeEntryId: timeEntryPick,
        expenseRequestId: expensePick,
        ...(timeEntryWorkDate !== undefined ? { timeEntryWorkDate } : {}),
        ...(timeAuthorAuthUserId !== undefined ? { timeAuthorAuthUserId } : {}),
        ...(expenseDate !== undefined ? { expenseDate } : {}),
        ...(sourceCurrency ? { sourceCurrency } : {}),
        ...(sourceAmount != null ? { sourceAmount } : {}),
        ...(fxRate != null ? { fxRate } : {}),
    };
}

export function pickInvoicePartnerStr(o: Record<string, unknown>, keys: readonly string[]): string | undefined {
    for (const k of keys) {
        const v = o[k];
        if (v == null || v === '')
            continue;
        const s = String(v).trim();
        if (s)
            return s;
    }
    return undefined;
}

export function pickInvoicePartnerDateSlice(o: Record<string, unknown>, keys: readonly string[]): string | undefined {
    const raw = pickInvoicePartnerStr(o, keys);
    const s = raw ? raw.trim().slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

export const INV_MONEY_TOLERANCE = 0.03;

export function mergeInvoiceDtoAfterPayment(posted: InvoiceDto, fetched: InvoiceDto): InvoiceDto {
    const pa = Number(posted.amountPaid);
    const fa = Number(fetched.amountPaid);
    const pp = posted.payments?.length ?? 0;
    const fp = fetched.payments?.length ?? 0;
    if (fa > pa + INV_MONEY_TOLERANCE || fp > pp)
        return fetched;
    if (pa > fa + INV_MONEY_TOLERANCE || pp > fp)
        return posted;
    const rank = (s: string) => (s === 'paid' ? 3 : s === 'partial_paid' ? 2 : s === 'overdue' ? 1 : 0);
    const pr = rank(String(posted.status));
    const fr = rank(String(fetched.status));
    if (fr > pr)
        return fetched;
    if (pr > fr)
        return posted;
    return posted;
}

export function coalesceInvoiceMoney(...vals: unknown[]): number {
    for (const v of vals) {
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
        if (typeof v === 'string' && v.trim() !== '') {
            const n = Number(String(v).replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.'));
            if (Number.isFinite(n))
                return n;
        }
    }
    return 0;
}

export function normalizeInvoicePaymentsArray(o: Record<string, unknown>): InvoicePaymentDto[] {
    const paymentsSrc = o.payments
        ?? o.invoice_payments
        ?? o.invoicePayments
        ?? o.InvoicePayments;
    const arr = Array.isArray(paymentsSrc) ? paymentsSrc : [];
    return arr.map((row, idx): InvoicePaymentDto => {
        const r = (row != null && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        const idRaw = r.id ?? r.payment_id ?? r.paymentId;
        const id = typeof idRaw === 'string' && idRaw.trim()
            ? idRaw.trim()
            : typeof idRaw === 'number' && Number.isFinite(idRaw)
                ? String(Math.trunc(idRaw))
                : `payment-${idx}`;
        let recordedByAuthUserId = 0;
        for (const k of ['recordedByAuthUserId', 'recorded_by_auth_user_id', 'authUserId', 'auth_user_id'] as const) {
            const v = r[k];
            if (typeof v === 'number' && Number.isFinite(v)) {
                recordedByAuthUserId = Math.trunc(v);
                break;
            }
            if (typeof v === 'string' && v.trim() !== '') {
                const n = Number(v.trim());
                if (Number.isFinite(n)) {
                    recordedByAuthUserId = Math.trunc(n);
                    break;
                }
            }
        }
        const pickPaymentStr = (...keys: string[]): string => {
            for (const k of keys) {
                const v = r[k];
                if (v == null || v === '')
                    continue;
                const s = String(v).trim();
                if (s.length)
                    return s;
            }
            return '';
        };
        const paidAt = pickPaymentStr('paidAt', 'paid_at');
        const createdAt = pickPaymentStr('createdAt', 'created_at');
        const pmRaw = r.paymentMethod ?? r.payment_method;
        const paymentMethod = pmRaw == null ? null : (String(pmRaw).trim() || null);
        const noteRaw = r.note ?? r.description ?? null;
        const note = noteRaw != null ? (String(noteRaw).trim() || null) : null;
        const amount = coalesceInvoiceMoney(r.amount, r.payment_amount, r.paymentAmount);
        return {
            id,
            amount,
            paymentMethod,
            note,
            recordedByAuthUserId,
            paidAt,
            createdAt,
        };
    });
}

export function normalizeInvoiceDto(raw: unknown): InvoiceDto {
    if (!raw || typeof raw !== 'object')
        throw new Error('Invoice API: в ответе нет объекта счёта');
    const invoice = raw as InvoiceDto;
    const o = raw as Record<string, unknown>;
    const linesSrc = o.lines
        ?? o.line_items
        ?? o.lineItems
        ?? o.LineItems
        ?? o.invoice_lines
        ?? o.invoiceLines;
    const linesArr = Array.isArray(linesSrc) ? linesSrc : [];
    const lines = linesArr.map((row, idx) => normalizeInvoiceLineDto(row, idx));
    const pf = pickInvoicePartnerDateSlice(o, ['partnerBillingPeriodFrom', 'partner_billing_period_from']);
    const pt = pickInvoicePartnerDateSlice(o, ['partnerBillingPeriodTo', 'partner_billing_period_to']);
    const pcs = pickInvoicePartnerStr(o, ['partnerConfirmationSnapshotId', 'partner_confirmation_snapshot_id', 'reportSnapshotId', 'report_snapshot_id']);
    const pcr = pickInvoicePartnerStr(o, ['partnerConfirmationRequestId', 'partner_confirmation_request_id']);
    const rpcdRaw = o.requiresPaymentConfirmationDocument ?? o.requires_payment_confirmation_document;
    const requiresPaymentConfirmationDocument = rpcdRaw === true || rpcdRaw === 'true'
        ? true
        : rpcdRaw === false || rpcdRaw === 'false'
            ? false
            : undefined;
    const pcDocUrl = pickInvoicePartnerStr(o, ['paymentConfirmationDocumentUrl', 'payment_confirmation_document_url']);
    const pcRecAt = pickInvoicePartnerStr(o, ['paymentConfirmationRecordedAt', 'payment_confirmation_recorded_at']);

    let documentOverrides: Record<string, unknown> | null | undefined;
    const docOvrRaw = o.documentOverrides ?? o.document_overrides;
    if (docOvrRaw === null) {
        documentOverrides = null;
    }
    else if (docOvrRaw != null && typeof docOvrRaw === 'object' && !Array.isArray(docOvrRaw)) {
        documentOverrides = docOvrRaw as Record<string, unknown>;
    }

    const paymentsNorm = normalizeInvoicePaymentsArray(o);
    const paidFromPayments = paymentsNorm.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
    const totalAmount = coalesceInvoiceMoney(o.totalAmount, o.total_amount, invoice.totalAmount);
    let amountPaid = coalesceInvoiceMoney(o.amountPaid, o.amount_paid, invoice.amountPaid);
    if (paidFromPayments > 1e-9)
        amountPaid = Math.max(amountPaid, paidFromPayments);
    let balanceDue = coalesceInvoiceMoney(o.balanceDue, o.balance_due, invoice.balanceDue);
    const impliedBal = Math.max(0, totalAmount - amountPaid);
    if (totalAmount > 1e-9 && Math.abs(balanceDue - impliedBal) > INV_MONEY_TOLERANCE)
        balanceDue = impliedBal;

    let statusPick: InvoiceUiStatus = invoice.status;
    const effRaw = o.status ?? o.effective_status ?? o.effectiveStatus;
    if (typeof effRaw === 'string' && effRaw.trim())
        statusPick = effRaw.trim() as InvoiceUiStatus;
    let storedPick = invoice.storedStatus;
    const stRaw = o.storedStatus ?? o.stored_status;
    if (typeof stRaw === 'string' && stRaw.trim())
        storedPick = stRaw.trim();

    return {
        ...invoice,
        lines,
        status: statusPick,
        storedStatus: storedPick,
        totalAmount,
        amountPaid,
        balanceDue,
        ...(paymentsNorm.length > 0 ? { payments: paymentsNorm } : {}),
        ...(pf ? { partnerBillingPeriodFrom: pf } : {}),
        ...(pt ? { partnerBillingPeriodTo: pt } : {}),
        ...(pcs ? { partnerConfirmationSnapshotId: pcs } : {}),
        ...(pcr ? { partnerConfirmationRequestId: pcr } : {}),
        ...(requiresPaymentConfirmationDocument !== undefined ? { requiresPaymentConfirmationDocument } : {}),
        ...(pcDocUrl ? { paymentConfirmationDocumentUrl: pcDocUrl } : {}),
        ...(pcRecAt ? { paymentConfirmationRecordedAt: pcRecAt } : {}),
        ...(documentOverrides !== undefined ? { documentOverrides } : {}),
    };
}

export async function createInvoice(body: InvoiceCreateInput): Promise<InvoiceDto> {
    const res = await apiFetch('/api/v1/time-tracking/invoices', {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function getInvoice(id: string, includePayments = true): Promise<InvoiceDto> {
    const qs = includePayments ? '?includePayments=true' : '?includePayments=false';
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}${qs}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function getInvoiceAudit(id: string): Promise<InvoiceAuditEntryDto[]> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/audit`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return res.json() as Promise<InvoiceAuditEntryDto[]>;
}
export async function patchInvoice(id: string, body: InvoicePatchInput): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}`, {
        ...invoiceApiFetchInit,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function sendInvoice(id: string): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/send`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}

export type InvoiceAccountingLastPageNotifyInput = {
    pdfBase64: string;
    pdfFileName?: string | null;
    clientName?: string | null;
};

export type InvoiceAccountingLastPageNotifyResult = {
    sent: boolean;
    recipients: string[];
    skippedReason: string | null;
};

export async function notifyInvoiceAccountingLastPage(
    invoiceId: string,
    body: InvoiceAccountingLastPageNotifyInput,
): Promise<InvoiceAccountingLastPageNotifyResult> {
    const payload: Record<string, unknown> = {
        pdfBase64: String(body.pdfBase64 ?? '').trim(),
    };
    const pdfFileName = body.pdfFileName != null ? String(body.pdfFileName).trim() : '';
    if (pdfFileName)
        payload.pdfFileName = pdfFileName;
    const clientName = body.clientName != null ? String(body.clientName).trim() : '';
    if (clientName)
        payload.clientName = clientName;

    const res = await apiFetch(
        `/api/v1/time-tracking/invoices/${encodeURIComponent(invoiceId)}/notify-accounting-last-page`,
        {
            ...invoiceApiFetchInit,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
    );
    await throwIfNotOk(res);
    const raw = await res.json();
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const recipients = Array.isArray(o.recipients)
        ? o.recipients.map((x) => String(x).trim()).filter(Boolean)
        : [];
    return {
        sent: o.sent === true,
        recipients,
        skippedReason: o.skippedReason != null ? String(o.skippedReason) : null,
    };
}

export type InvoiceOutlookDraftInput = {
    toEmail: string;
    toName?: string | null;
    subject: string;
    bodyHtml?: string | null;
    bodyText?: string | null;
    pdfBase64: string;
    pdfFileName?: string | null;
};

export type InvoiceOutlookDraftResult = {
    webLink: string;
    messageId: string | null;
};

export async function createInvoiceOutlookDraft(
    invoiceId: string,
    body: InvoiceOutlookDraftInput,
): Promise<InvoiceOutlookDraftResult> {
    const payload: Record<string, unknown> = {
        toEmail: String(body.toEmail ?? '').trim(),
        subject: String(body.subject ?? '').trim(),
        pdfBase64: String(body.pdfBase64 ?? '').trim(),
    };
    const toName = body.toName != null ? String(body.toName).trim() : '';
    if (toName)
        payload.toName = toName;
    if (body.bodyHtml != null && String(body.bodyHtml).trim() !== '')
        payload.bodyHtml = String(body.bodyHtml);
    if (body.bodyText != null && String(body.bodyText).trim() !== '')
        payload.bodyText = String(body.bodyText);
    if (body.pdfFileName != null && String(body.pdfFileName).trim() !== '')
        payload.pdfFileName = String(body.pdfFileName).trim();

    const res = await apiFetch(
        `/api/v1/time-tracking/invoices/${encodeURIComponent(invoiceId)}/outlook-draft`,
        {
            ...invoiceApiFetchInit,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
    );
    await throwIfNotOk(res);
    const raw = await res.json();
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    let webLink = typeof o.webLink === 'string' ? o.webLink.trim() : '';
    const messageId = o.messageId != null ? String(o.messageId) : null;
    // Client-side safety: Graph webLink opens drafts in read mode; force compose.
    if (messageId && (!webLink || webLink.includes('/deeplink/read/'))) {
        const q = encodeURIComponent(messageId);
        webLink = `https://outlook.office.com/mail/deeplink/compose/${q}?ItemID=${q}&exvsurl=1`;
    }
    else if (webLink.includes('/deeplink/read/')) {
        webLink = webLink.replace('/deeplink/read/', '/deeplink/compose/');
    }
    if (!webLink)
        throw new Error('Outlook draft response missing webLink');
    return {
        webLink,
        messageId,
    };
}

export type InvoiceOutlookDraftDeliveryState = 'pending' | 'sent' | 'missing';

export type InvoiceOutlookDraftStatusResult = {
    state: InvoiceOutlookDraftDeliveryState;
    sentDateTime: string | null;
};

export async function getInvoiceOutlookDraftStatus(
    invoiceId: string,
    opts: { messageId: string; subject?: string | null; createdAfter?: string | null },
): Promise<InvoiceOutlookDraftStatusResult> {
    const messageId = String(opts.messageId ?? '').trim();
    if (!messageId)
        throw new Error('messageId is required');
    const qs = new URLSearchParams();
    qs.set('messageId', messageId);
    const subject = opts.subject != null ? String(opts.subject).trim() : '';
    if (subject)
        qs.set('subject', subject);
    const createdAfter = opts.createdAfter != null ? String(opts.createdAfter).trim() : '';
    if (createdAfter)
        qs.set('createdAfter', createdAfter);

    const res = await apiFetch(
        `/api/v1/time-tracking/invoices/${encodeURIComponent(invoiceId)}/outlook-draft-status?${qs.toString()}`,
        { ...invoiceApiFetchInit, method: 'GET' },
    );
    await throwIfNotOk(res);
    const raw = await res.json();
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const stateRaw = typeof o.state === 'string' ? o.state.trim().toLowerCase() : '';
    const state: InvoiceOutlookDraftDeliveryState =
        stateRaw === 'sent' || stateRaw === 'missing' || stateRaw === 'pending'
            ? stateRaw
            : 'pending';
    return {
        state,
        sentDateTime: typeof o.sentDateTime === 'string' ? o.sentDateTime : null,
    };
}

export async function markInvoiceViewed(id: string): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/mark-viewed`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function registerInvoicePayment(id: string, body: InvoicePaymentInput = {}): Promise<InvoiceDto> {
    const payload: Record<string, unknown> = {};
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
        payload.amount = body.amount;
    }
    if (body.paidAt != null && String(body.paidAt).trim() !== '') {
        payload.paidAt = body.paidAt;
    }
    if (body.paymentMethod != null && String(body.paymentMethod).trim() !== '') {
        payload.paymentMethod = body.paymentMethod;
    }
    if (body.note != null && String(body.note).trim() !== '') {
        payload.note = body.note;
    }
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/payments`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function submitInvoicePaymentConfirmation(id: string, body: InvoicePaymentConfirmationInput): Promise<InvoiceDto> {
    const documentUrl = String(body.documentUrl ?? body.document_url ?? '').trim();
    if (!documentUrl)
        throw new Error('Не указана ссылка на документ подтверждения оплаты.');
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/payment-confirmation`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl, document_url: documentUrl }),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function cancelInvoice(id: string): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/cancel`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function deleteDraftInvoice(id: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}`, {
        ...invoiceApiFetchInit,
        method: 'DELETE',
    });
    await throwIfNotOk(res);
}
