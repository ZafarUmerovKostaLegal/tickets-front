import {
    createInvoice,
    ensureInvoiceFxRatesForBilling,
    fetchPartnerInvoicePreview,
    fetchUnbilledExpenses,
    fetchUnbilledTimeEntries,
    patchInvoice,
    type InvoiceDto,
    type PartnerReportConfirmationRequest,
    type TimeManagerClientProjectRow,
    type TimeTrackingUserRow,
    type UnbilledExpenseEntryDto,
    type UnbilledTimeEntryDto,
} from '@entities/time-tracking';
import {
    buildCombinedReportSnapshot,
    buildCombinedShares,
    formatCombinedShareNote,
    type CombinedExpenseLine,
    type CombinedTimeLine,
} from './combinedInvoice';
import { assertNoApprovedUnpaidProjectExpenses } from './projectUnpaidExpenses';

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

export function partnerInvoiceHasMoney(inv: Pick<InvoiceDto, 'totalAmount' | 'subtotal'>): boolean {
    const total = Number(inv.totalAmount ?? 0);
    const sub = Number(inv.subtotal ?? 0);
    const n = Number.isFinite(total) ? total : 0;
    const s = Number.isFinite(sub) ? sub : 0;
    return Math.abs(n) > 0.01 || Math.abs(s) > 0.01;
}

export function findInvoiceForPartnerConfirmedRow(
    r: PartnerReportConfirmationRequest,
    invoices: readonly InvoiceDto[],
): InvoiceDto | null {
    const active = invoices.filter((inv) => {
        const st = String(inv.status ?? '').trim().toLowerCase();
        return st !== 'canceled' && st !== 'cancelled' && partnerInvoiceHasMoney(inv);
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

export class PartnerConfirmedCombinedCurrencyError extends Error {
    constructor() {
        super('COMBINED_CURRENCY_MISMATCH');
        this.name = 'PartnerConfirmedCombinedCurrencyError';
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

export function invoiceCreatedBeforeAllSignatures(note: string | null | undefined): boolean {
    return /счёт сформирован до подписей|generated before all required partner signatures/i.test(String(note ?? ''));
}

export function pendingPartnerDisplayNames(
    row: PartnerReportConfirmationRequest,
    nameById: ReadonlyMap<number, string>,
): string {
    return row.pendingPartnerAuthUserIds
        .map((id) => nameById.get(id)?.trim() || `#${id}`)
        .filter(Boolean)
        .join(', ');
}

function isPartnerSignatureGateError(message: string): boolean {
    return /fully.?confirm|partner.?confirm|подпис|подтвержд/i.test(message);
}

export async function generateInvoiceFromPartnerConfirmedReport(args: {
    row: PartnerReportConfirmationRequest;
    clientId: string;
    currency?: string | null;
    /** Create the invoice even if some required partners have not signed. */
    allowUnsignedPartners?: boolean;
}): Promise<InvoiceDto> {
    const { row, clientId } = args;
    const projectId = String(row.projectId ?? '').trim();
    const dateFrom = sliceIsoDate(row.dateFrom);
    const dateTo = sliceIsoDate(row.dateTo);
    if (!clientId.trim() || !projectId || !dateFrom || !dateTo)
        throw new Error('INVALID_PARTNER_CONFIRMED_ROW');

    await assertNoApprovedUnpaidProjectExpenses(projectId);

    const issueDate = todayIso();
    // Prefetch CBU FX by billing period (expense/work dates) — never by invoice issue date alone.
    await ensureInvoiceFxRatesForBilling({
        dateFrom,
        dateTo,
        currency: args.currency?.trim() || undefined,
    });
    // The backend builds partner-confirmed invoice lines strictly from the confirmed report
    // snapshot; the preview is only used here to detect an empty period up-front.
    const preview = await fetchPartnerInvoicePreview({
        projectId,
        dateFrom,
        dateTo,
        clientId: clientId.trim(),
        currency: args.currency?.trim() || undefined,
        issueDate,
        partnerConfirmationRequestId: String(row.id ?? '').trim() || undefined,
    });

    const hasTime = preview.timeEntryIds.length > 0 || (preview.lines ?? []).some((l) => l.lineKind === 'time');
    const hasExpense = preview.expenseIds.length > 0;
    const hasPackage = preview.packageFeeSubtotal > 1e-9;
    if (!hasTime && !hasExpense && !hasPackage)
        throw new PartnerConfirmedInvoiceNoLinesError();

    const unsignedNote = args.allowUnsignedPartners
        ? 'Invoice exception: generated before all required partner signatures.'
        : null;
    const requestId = String(row.id ?? '').trim() || undefined;
    const body = {
        clientId: clientId.trim(),
        projectId,
        issueDate,
        dueDate: addDaysIso(30),
        currency: preview.currency,
        taxPercent: 0,
        tax2Percent: 0,
        discountPercent: 0,
        timeEntryIds: preview.timeEntryIds,
        expenseIds: preview.expenseIds,
        partnerBillingPeriodFrom: dateFrom,
        partnerBillingPeriodTo: dateTo,
        partnerConfirmationRequestId: requestId,
        ...(args.allowUnsignedPartners
            ? { skipPartnerInvoiceConfirmation: true, deferPartnerConfirmation: true }
            : {}),
        ...(unsignedNote ? { internalNote: unsignedNote } : {}),
    };

    const create = async (omitRequestId: boolean) => createInvoice(
        omitRequestId ? { ...body, partnerConfirmationRequestId: undefined } : body,
    );

    try {
        return await create(false);
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
        if (args.allowUnsignedPartners && isPartnerSignatureGateError(msg)) {
            try {
                return await create(true);
            }
            catch (retry) {
                const retryMsg = retry instanceof Error ? retry.message : String(retry);
                if (retryMsg.includes('INVOICE_SUBTOTAL_MISMATCH') || retryMsg.includes('не совпала')) {
                    throw new PartnerConfirmedInvoiceMismatchError(
                        preview.expectedSubtotal,
                        preview.currency,
                        retryMsg,
                    );
                }
                throw retry;
            }
        }
        throw e;
    }
}

export async function generateCombinedInvoiceFromConfirmedReports(args: {
    rows: PartnerReportConfirmationRequest[];
    payerClientId: string;
    projectMeta: Array<{ id: string; name: string; clientId: string; clientName: string }>;
    users: TimeTrackingUserRow[];
}): Promise<InvoiceDto> {
    const payerClientId = args.payerClientId.trim();
    if (!payerClientId || args.rows.length < 2)
        throw new Error('INVALID_COMBINED_SELECTION');

    const time: CombinedTimeLine[] = [];
    const expenses: CombinedExpenseLine[] = [];
    const seenTime = new Set<string>();
    const seenExpense = new Set<string>();
    let currency = '';
    let dateFrom = '';
    let dateTo = '';

    for (const row of args.rows) {
        const projectId = String(row.projectId ?? '').trim();
        const from = sliceIsoDate(row.dateFrom);
        const to = sliceIsoDate(row.dateTo);
        if (!projectId || !from || !to)
            continue;
        dateFrom = !dateFrom || from < dateFrom ? from : dateFrom;
        dateTo = !dateTo || to > dateTo ? to : dateTo;
        await assertNoApprovedUnpaidProjectExpenses(projectId);
        const clientId = args.projectMeta.find((project) => project.id === projectId)?.clientId || payerClientId;
        const preview = await fetchPartnerInvoicePreview({
            projectId,
            dateFrom: from,
            dateTo: to,
            clientId,
            issueDate: todayIso(),
            partnerConfirmationRequestId: String(row.id ?? '').trim() || undefined,
        });
        const nextCurrency = preview.currency?.trim() || 'USD';
        if (!currency)
            currency = nextCurrency;
        else if (currency !== nextCurrency)
            throw new PartnerConfirmedCombinedCurrencyError();
        const timeIds = new Set(preview.timeEntryIds);
        const expenseIds = new Set(preview.expenseIds);
        const [timeRows, expenseRows] = await Promise.all([
            fetchUnbilledTimeEntries({ projectId, dateFrom: from, dateTo: to }),
            fetchUnbilledExpenses({ projectId, dateFrom: from, dateTo: to }),
        ]);
        let addedTime = 0;
        let addedExpenses = 0;
        for (const line of timeRows) {
            if (timeIds.size > 0 && !timeIds.has(line.id))
                continue;
            if (seenTime.has(line.id))
                continue;
            seenTime.add(line.id);
            time.push({ ...line, projectId });
            addedTime += 1;
        }
        for (const line of expenseRows) {
            if (expenseIds.size > 0 && !expenseIds.has(line.id))
                continue;
            if (seenExpense.has(line.id))
                continue;
            seenExpense.add(line.id);
            expenses.push({ ...line, projectId });
            addedExpenses += 1;
        }
        if (addedTime === 0) {
            for (const line of preview.lines) {
                if (line.lineKind !== 'time')
                    continue;
                const id = String(line.timeEntryId ?? '').trim();
                if (!id || seenTime.has(id))
                    continue;
                seenTime.add(id);
                const synthetic: UnbilledTimeEntryDto & { projectId: string } = {
                    id,
                    authUserId: 0,
                    workDate: from,
                    hours: line.quantity,
                    billableHours: line.quantity,
                    description: line.description,
                    billableAmount: line.lineTotal,
                    currency: nextCurrency,
                    projectId,
                };
                time.push(synthetic);
            }
        }
        if (addedExpenses === 0) {
            for (const line of preview.lines) {
                if (line.lineKind === 'time')
                    continue;
                const id = String(line.expenseRequestId ?? '').trim();
                if (!id || seenExpense.has(id))
                    continue;
                seenExpense.add(id);
                const synthetic: UnbilledExpenseEntryDto & { projectId: string } = {
                    id,
                    expenseDate: from,
                    description: line.description,
                    equivalentAmount: line.lineTotal,
                    status: 'approved',
                    projectId,
                };
                expenses.push(synthetic);
            }
        }
    }

    if (time.length === 0 && expenses.length === 0)
        throw new PartnerConfirmedInvoiceNoLinesError();

    const projects = args.projectMeta.map((project) => ({
        id: project.id,
        name: project.name,
        client_id: project.clientId,
    } as TimeManagerClientProjectRow));
    const clientNameById = new Map(args.projectMeta.map((project) => [project.clientId, project.clientName]));
    const shares = buildCombinedShares(projects, clientNameById, time, expenses, 'hours');
    const totalHours = time.reduce((sum, line) => sum + (line.billableHours ?? line.hours), 0);
    const totalFees = time.reduce((sum, line) => sum + line.billableAmount, 0);
    const totalExpenses = expenses.reduce((sum, line) => sum + line.equivalentAmount, 0);
    const feeTitle = `Fees for services in the period from ${dateFrom} till ${dateTo} under confirmed partner reports`;
    const shareNote = formatCombinedShareNote(shares);
    const issueDate = todayIso();
    await ensureInvoiceFxRatesForBilling({
        dateFrom,
        dateTo,
        issueDate,
        expenseDates: expenses.map((line) => sliceIsoDate(line.expenseDate)).filter(Boolean),
        currency,
    });
    const snapshot = buildCombinedReportSnapshot({
        feeTitle,
        currency,
        projects,
        time,
        expenses,
        shares,
        users: args.users,
        totalHours,
        totalFees,
        totalExpenses,
    });
    const created = await createInvoice({
        clientId: payerClientId,
        issueDate,
        dueDate: addDaysIso(30),
        currency,
        skipPartnerInvoiceConfirmation: true,
        deferPartnerConfirmation: true,
        partnerBillingPeriodFrom: dateFrom,
        partnerBillingPeriodTo: dateTo,
        timeEntryIds: time.map((line) => line.id),
        expenseIds: expenses.map((line) => line.id),
        billedAmount: Math.round((totalFees + totalExpenses) * 100) / 100,
        serviceDescription: feeTitle,
        clientNote: shareNote,
        internalNote: `Hours split\n${shareNote}`,
        taxPercent: 0,
        tax2Percent: 0,
        discountPercent: 0,
    });
    await patchInvoice(created.id, {
        documentOverrides: {
            v: 1,
            reportLayout: 'combined',
            combinedReport: snapshot,
        },
    });
    return created;
}
