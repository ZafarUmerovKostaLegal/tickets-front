import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

export const INVOICE_PAYMENT_DISCLAIMER = (
    'The payment under this invoice shall constitute the due acceptance of the Services by '
    + 'the Client. Perfection of a separate document on acceptance of the Services is not '
    + 'required.'
);

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

export function packResolveDueIso(session: InvoicePreviewSessionV1 | null, issueIso: string): string {
    if (session?.mode === 'create')
        return session.form.dueDate.slice(0, 10);
    const metaDue = session?.meta?.dueDateIso?.slice(0, 10);
    if (metaDue && /^\d{4}-\d{2}-\d{2}$/.test(metaDue))
        return metaDue;
    return issueIso;
}

/** Дата вида MAY 15, 2026 для строки счёта */
export function packUppercaseRibbonDate(isoYmd: string): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}$/.test(isoYmd))
        return '—';
    const d = new Date(`${isoYmd}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).toUpperCase();
}

export function packInvoiceNumberDisplay(session: InvoicePreviewSessionV1 | null): string {
    const n = session?.meta.invoiceNumber?.trim();
    return n ?? 'KL-XXXX-00/00';
}

export function packCurrencyCode(model: InvoiceCoverLetterModel): string {
    const t = model.totalFormatted.trim().split(/\s+/)[0];
    return t?.replace(/[^A-Za-z]/g, '').toUpperCase() || 'EUR';
}

export function packZeroCommaAmount(model: InvoiceCoverLetterModel): string {
    return `${packCurrencyCode(model)} 0,00`;
}

export function packCaseDetailLine(session: InvoicePreviewSessionV1 | null): string {
    return session?.meta.projectLabel?.trim() || 'Legal services';
}

export function packFirmBankingLines(currencyCode: string): string[] {
    const cur = currencyCode.toUpperCase() || 'EUR';
    return [
        'TIN: —',
        'Bank name: —',
        'Bank address: —',
        `AC (${cur}): —`,
        'Bank code: —',
        'SWIFT: —',
        'Correspondent bank: —',
        `Corr. ACC (${cur}): —`,
    ];
}

export type InvoicePreviewPackInput = {
    model: InvoiceCoverLetterModel;
    session: InvoicePreviewSessionV1 | null;
};
