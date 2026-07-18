import {
    createInvoice,
    fetchPartnerInvoicePreview,
    type InvoiceDto,
    type PartnerReportConfirmationRequest,
} from '@entities/time-tracking';

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sliceIsoDate(iso: string): string {
    return String(iso ?? '').trim().slice(0, 10);
}

export function findInvoiceForPartnerConfirmedRow(
    r: PartnerReportConfirmationRequest,
    invoices: readonly InvoiceDto[],
): InvoiceDto | null {
    const active = invoices.filter((inv) => {
        const st = String(inv.status ?? '').trim().toLowerCase();
        return st !== 'canceled' && st !== 'cancelled';
    });
    const reqId = String(r.id ?? '').trim();
    if (reqId) {
        const byReq = active.find((inv) => String(inv.partnerConfirmationRequestId ?? '').trim() === reqId);
        if (byReq)
            return byReq;
    }
    const snap = String(r.snapshotId ?? '').trim();
    if (snap) {
        const bySnap = active.find((inv) => String(inv.partnerConfirmationSnapshotId ?? '').trim() === snap);
        if (bySnap)
            return bySnap;
    }
    const pf = sliceIsoDate(r.dateFrom);
    const pt = sliceIsoDate(r.dateTo);
    const projectId = String(r.projectId ?? '').trim();
    if (!projectId || !pf || !pt)
        return null;
    return active.find((inv) => {
        if (String(inv.projectId ?? '').trim() !== projectId)
            return false;
        return sliceIsoDate(String(inv.partnerBillingPeriodFrom ?? '')) === pf
            && sliceIsoDate(String(inv.partnerBillingPeriodTo ?? '')) === pt;
    }) ?? null;
}

export class PartnerConfirmedInvoiceNoLinesError extends Error {
    constructor() {
        super('NO_UNBILLED_LINES');
        this.name = 'PartnerConfirmedInvoiceNoLinesError';
    }
}

export class PartnerConfirmedInvoiceMismatchError extends Error {
    readonly expectedSubtotal: number;
    readonly currency: string;

    constructor(expectedSubtotal: number, currency: string, message?: string) {
        super(message || 'INVOICE_SUBTOTAL_MISMATCH');
        this.name = 'PartnerConfirmedInvoiceMismatchError';
        this.expectedSubtotal = expectedSubtotal;
        this.currency = currency;
    }
}

export async function generateInvoiceFromPartnerConfirmedReport(args: {
    row: PartnerReportConfirmationRequest;
    clientId: string;
    currency?: string | null;
}): Promise<InvoiceDto> {
    const { row, clientId } = args;
    const projectId = String(row.projectId ?? '').trim();
    const dateFrom = sliceIsoDate(row.dateFrom);
    const dateTo = sliceIsoDate(row.dateTo);
    if (!clientId.trim() || !projectId || !dateFrom || !dateTo)
        throw new Error('INVALID_PARTNER_CONFIRMED_ROW');

    const issueDate = todayIso();
    const preview = await fetchPartnerInvoicePreview({
        projectId,
        dateFrom,
        dateTo,
        clientId: clientId.trim(),
        currency: args.currency?.trim() || undefined,
        issueDate,
    });

    const timeEntryIds = preview.timeEntryIds;
    const expenseIds = preview.expenseIds;
    const hasPackage = preview.packageFeeSubtotal > 1e-9;
    if (timeEntryIds.length === 0 && expenseIds.length === 0 && !hasPackage)
        throw new PartnerConfirmedInvoiceNoLinesError();

    try {
        return await createInvoice({
            clientId: clientId.trim(),
            projectId,
            issueDate,
            dueDate: addDaysIso(30),
            currency: preview.currency,
            // Align with confirmed report total (pre-tax). Tax/discount can be edited on the draft.
            taxPercent: 0,
            tax2Percent: 0,
            discountPercent: 0,
            timeEntryIds,
            expenseIds,
            partnerBillingPeriodFrom: dateFrom,
            partnerBillingPeriodTo: dateTo,
            partnerConfirmationRequestId: String(row.id ?? '').trim() || undefined,
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('INVOICE_SUBTOTAL_MISMATCH') || msg.includes('не совпала')) {
            throw new PartnerConfirmedInvoiceMismatchError(
                preview.expectedSubtotal,
                preview.currency,
                msg,
            );
        }
        throw e;
    }
}
