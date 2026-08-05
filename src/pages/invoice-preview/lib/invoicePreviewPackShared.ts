import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { resolveLegalFirmBankingLines, type InvoiceLegalPageOverrides } from './invoiceLegalPageModel';
import type { InvoiceTimeReportPack } from './invoiceTimeReportModel';

export const TIME_REPORT_DETAIL_ROWS = 14;
export const TIME_REPORT_SUMMARY_ROWS = 5;

function isoToday(): string {
    return new Date().toISOString().slice(0, 10);
}

export function packResolveIssueIso(session: InvoicePreviewSessionV1 | null): string {
    if (!session)
        return isoToday();
    if (session.mode === 'existing')
        return session.meta.issueDateIso?.slice(0, 10) ?? isoToday();
    return session.form.issueDate.slice(0, 10);
}

/** Billing period month anchor (prefer period end); falls back to issue date. */
export function packResolveBillingPeriodIso(session: InvoicePreviewSessionV1 | null): string {
    const issue = packResolveIssueIso(session);
    if (!session)
        return issue;
    if (session.mode === 'create') {
        const to = session.form.unbilledTo?.trim().slice(0, 10);
        const from = session.form.unbilledFrom?.trim().slice(0, 10);
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to))
            return to;
        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from))
            return from;
        return issue;
    }
    const to = session.meta.billingPeriodTo?.trim().slice(0, 10);
    const from = session.meta.billingPeriodFrom?.trim().slice(0, 10);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to))
        return to;
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from))
        return from;
    return issue;
}

export function packResolveDueIso(session: InvoicePreviewSessionV1 | null, issueIso: string): string {
    if (session?.mode === 'create')
        return session.form.dueDate.slice(0, 10);
    const metaDue = session?.meta?.dueDateIso?.slice(0, 10);
    if (metaDue && /^\d{4}-\d{2}-\d{2}$/.test(metaDue))
        return metaDue;
    return issueIso;
}

export { formatLegalRibbonDate as packUppercaseRibbonDate } from './invoiceLegalPageI18n';
export { formatLegalRibbonPeriodMonth as packUppercaseRibbonPeriodMonth } from './invoiceLegalPageI18n';

export function packInvoiceNumberDisplay(session: InvoicePreviewSessionV1 | null): string {
    const n = session?.meta.invoiceNumber?.trim();
    return n ?? 'KL-XXXX-00/00';
}

export function packCurrencyCode(model: InvoiceCoverLetterModel): string {
    const t = model.totalFormatted.trim().split(/\s+/)[0];
    return t?.replace(/[^A-Za-z]/g, '').toUpperCase() || 'EUR';
}

export function packZeroCommaAmount(model: InvoiceCoverLetterModel): string {
    return `${packCurrencyCode(model)} 0.00`;
}

export function packCaseDetailLine(
    session: InvoicePreviewSessionV1 | null,
    fallback = 'Legal services',
): string {
    return session?.meta.projectLabel?.trim() || fallback;
}

export function packFirmBankingLines(currencyCode: string): string[] {
    return resolveLegalFirmBankingLines(currencyCode, null);
}

export type InvoicePreviewPackInput = {
    model: InvoiceCoverLetterModel;
    session: InvoicePreviewSessionV1 | null;

    timeReportPack?: InvoiceTimeReportPack;
    legalOverrides?: InvoiceLegalPageOverrides;

    selectedPageNumbers?: number[];
};
