import { getInvoice } from '@entities/time-tracking';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import type { InvoiceLegalPageOverrides } from './invoiceLegalPageModel';
import type { InvoicePreviewPackInput } from './invoicePreviewPackShared';
import { formatTimeReportAmount } from './invoiceTimeReportModel';

export type IssuedInvoiceFacts = {
    currency: string;
    totalAmount: number;
    taxAmount: number;
    lines: ReadonlyArray<{ lineKind?: string | null; lineTotal?: number | string | null }>;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function reconcileWithIssuedInvoice(
    model: InvoiceCoverLetterModel,
    legal: InvoiceLegalPageOverrides | undefined,
    facts: IssuedInvoiceFacts,
): { model: InvoiceCoverLetterModel; legal: InvoiceLegalPageOverrides } {
    const ccy = (facts.currency || 'USD').trim().toUpperCase() || 'USD';
    const total = round2(Number(facts.totalAmount) || 0);
    if (!(total > 0))
        return { model, legal: legal ?? {} };
    const expenses = round2(facts.lines
        .filter((line) => String(line.lineKind ?? '').toLowerCase() === 'expense')
        .reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0));
    const vat = round2(Number(facts.taxAmount) || 0);
    const totalText = formatTimeReportAmount(total, ccy);
    const oldTotal = (model.totalFormatted ?? '').trim();
    const paragraph = model.invoiceParagraphOverride;
    return {
        model: {
            ...model,
            totalFormatted: totalText,
            servicesAmountFormatted: formatTimeReportAmount(round2(total - expenses - vat), ccy),
            invoiceParagraphOverride: typeof paragraph === 'string' && oldTotal && oldTotal !== totalText
                ? paragraph.split(oldTotal).join(totalText)
                : paragraph,
        },
        legal: {
            ...(legal ?? {}),
            extraExpensesAmount: formatTimeReportAmount(expenses, ccy),
            ...(vat > 0 ? { vatAmount: formatTimeReportAmount(vat, ccy) } : {}),
        },
    };
}

export async function withIssuedInvoiceTotals(input: InvoicePreviewPackInput): Promise<InvoicePreviewPackInput> {
    if (input.session?.mode !== 'existing')
        return input;
    try {
        const inv = await getInvoice(input.session.invoiceId, false);
        const fixed = reconcileWithIssuedInvoice(input.model, input.legalOverrides, {
            currency: String(inv.currency ?? ''),
            totalAmount: Number(inv.totalAmount),
            taxAmount: Number(inv.taxAmount),
            lines: inv.lines ?? [],
        });
        return { ...input, model: fixed.model, legalOverrides: fixed.legal };
    }
    catch {
        return input;
    }
}
