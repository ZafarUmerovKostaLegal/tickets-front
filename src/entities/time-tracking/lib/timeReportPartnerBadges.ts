/** Отметки строк сводного отчёта времени для подтверждённых партнёром периодов и выставленных счетов */

export type TimeReportPartnerRowBadge = 'none' | 'confirmed' | 'invoiced';

/** Минимальный набор полей подтверждения (см. `PartnerReportConfirmationRequest`). */
export type TimeReportPartnerConfSlice = {
    projectId: string;
    dateFrom: string;
    dateTo: string;
    snapshotId: string;
    invoiceId?: string;
};

/** Минимальный набор полей счёта для сопоставления с подтверждением. */
export type TimeReportInvoicePartnerSlice = {
    id: string;
    projectId?: string | null;
    status?: string;
    partnerConfirmationSnapshotId?: string | null;
    partnerBillingPeriodFrom?: string | null;
    partnerBillingPeriodTo?: string | null;
};

function sliceIso(d: string): string {
    return String(d ?? '').trim().slice(0, 10);
}

/** Пересечение двух включительных календарных интервалов. */
export function reportDateRangesOverlap(a1: string, a2: string, b1: string, b2: string): boolean {
    const x1 = sliceIso(a1);
    const x2 = sliceIso(a2);
    const y1 = sliceIso(b1);
    const y2 = sliceIso(b2);
    if (!x1 || !x2 || !y1 || !y2)
        return false;
    return x1 <= y2 && y1 <= x2;
}

function invoiceMatchesConfirmation(inv: TimeReportInvoicePartnerSlice, conf: TimeReportPartnerConfSlice): boolean {
    const pid = String(inv.projectId ?? '').trim();
    if (!pid || pid !== String(conf.projectId ?? '').trim())
        return false;
    const stRaw = String(inv.status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    const st = stRaw === 'cancelled' ? 'canceled' : stRaw;
    if (st === 'canceled' || st === 'draft')
        return false;
    const invSnap = String(inv.partnerConfirmationSnapshotId ?? '').trim();
    if (invSnap && invSnap === String(conf.snapshotId ?? '').trim())
        return true;
    const linked = String(conf.invoiceId ?? '').trim();
    if (linked && linked === String(inv.id ?? '').trim())
        return true;
    const pf = sliceIso(String(inv.partnerBillingPeriodFrom ?? ''));
    const pt = sliceIso(String(inv.partnerBillingPeriodTo ?? ''));
    if (!pf || !pt)
        return false;
    return reportDateRangesOverlap(pf, pt, conf.dateFrom, conf.dateTo);
}

export function badgeForProjectInReportWindow(opts: {
    projectId: string;
    windowFrom: string;
    windowTo: string;
    confirmations: readonly TimeReportPartnerConfSlice[];
    invoices: readonly TimeReportInvoicePartnerSlice[];
}): TimeReportPartnerRowBadge {
    const pid = String(opts.projectId ?? '').trim();
    if (!pid)
        return 'none';
    const relevant = opts.confirmations.filter((c) => String(c.projectId ?? '').trim() === pid
        && reportDateRangesOverlap(c.dateFrom, c.dateTo, opts.windowFrom, opts.windowTo));
    if (relevant.length === 0)
        return 'none';
    for (const c of relevant) {
        for (const inv of opts.invoices) {
            if (invoiceMatchesConfirmation(inv, c))
                return 'invoiced';
        }
    }
    return 'confirmed';
}

/** Агрегация для разреза «Клиент»: берём максимум по статусам проектов клиента */
export function maxPartnerBadge(a: TimeReportPartnerRowBadge, b: TimeReportPartnerRowBadge): TimeReportPartnerRowBadge {
    const rk = (x: TimeReportPartnerRowBadge) => (x === 'invoiced' ? 2 : x === 'confirmed' ? 1 : 0);
    return rk(b) > rk(a) ? b : a;
}

export function buildClientPartnerBadgeMap(opts: {
    projectRows: readonly { client_id: string; project_id: string }[];
    windowFrom: string;
    windowTo: string;
    confirmations: readonly TimeReportPartnerConfSlice[];
    invoices: readonly TimeReportInvoicePartnerSlice[];
}): Map<string, TimeReportPartnerRowBadge> {
    const byClient = new Map<string, TimeReportPartnerRowBadge>();
    for (const row of opts.projectRows) {
        const cid = String(row.client_id ?? '').trim();
        const pid = String(row.project_id ?? '').trim();
        if (!cid || !pid)
            continue;
        const badge = badgeForProjectInReportWindow({
            projectId: pid,
            windowFrom: opts.windowFrom,
            windowTo: opts.windowTo,
            confirmations: opts.confirmations,
            invoices: opts.invoices,
        });
        if (badge === 'none')
            continue;
        byClient.set(cid, maxPartnerBadge(byClient.get(cid) ?? 'none', badge));
    }
    return byClient;
}
