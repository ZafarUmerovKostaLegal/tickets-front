import {
    createInvoice,
    fetchUnbilledExpenses,
    fetchUnbilledTimeEntries,
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
    const snap = String(r.snapshotId ?? '').trim();
    if (snap) {
        const bySnap = invoices.find((inv) => String(inv.partnerConfirmationSnapshotId ?? '').trim() === snap);
        if (bySnap)
            return bySnap;
    }
    const pf = sliceIsoDate(r.dateFrom);
    const pt = sliceIsoDate(r.dateTo);
    const projectId = String(r.projectId ?? '').trim();
    if (!projectId || !pf || !pt)
        return null;
    return invoices.find((inv) => {
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

export async function generateInvoiceFromPartnerConfirmedReport(args: {
    row: PartnerReportConfirmationRequest;
    clientId: string;
}): Promise<InvoiceDto> {
    const { row, clientId } = args;
    const projectId = String(row.projectId ?? '').trim();
    const dateFrom = sliceIsoDate(row.dateFrom);
    const dateTo = sliceIsoDate(row.dateTo);
    if (!clientId.trim() || !projectId || !dateFrom || !dateTo)
        throw new Error('INVALID_PARTNER_CONFIRMED_ROW');

    const [timeEntries, expenses] = await Promise.all([
        fetchUnbilledTimeEntries({ projectId, dateFrom, dateTo }),
        fetchUnbilledExpenses({ projectId, dateFrom, dateTo }),
    ]);

    const timeEntryIds = timeEntries.map((x) => x.id);
    const expenseIds = expenses.map((x) => x.id);
    if (timeEntryIds.length === 0 && expenseIds.length === 0)
        throw new PartnerConfirmedInvoiceNoLinesError();

    return createInvoice({
        clientId: clientId.trim(),
        projectId,
        issueDate: todayIso(),
        dueDate: addDaysIso(30),
        timeEntryIds,
        expenseIds,
        partnerBillingPeriodFrom: dateFrom,
        partnerBillingPeriodTo: dateTo,
    });
}
