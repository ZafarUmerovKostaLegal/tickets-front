import { TIME_REPORT_DETAIL_ROWS, TIME_REPORT_SUMMARY_ROWS } from './invoicePreviewPackShared';
import { formatCoverLetterTotal } from './invoiceCoverLetterModel';

/** Одна строка детальной таблицы Time Report */
export type InvoiceTimeReportDetailRow = {
    date: string;
    initials: string;
    task: string;
    description: string;
    hours: string;
    amount: string;
};

export type InvoiceTimeReportSummaryRow = {
    initials: string;
    name: string;
    title: string;
    hours: string;
    hourlyRate: string;
    totalPrice: string;
};

export type InvoiceTimeReportPack = {
    currency: string;
    detailSlots: InvoiceTimeReportDetailRow[];
    summarySlots: InvoiceTimeReportSummaryRow[];
    detailTotalHoursDisplay: string;
    detailTotalAmountDisplay: string;
    summaryGrandHoursDisplay: string;
    summaryGrandAmountDisplay: string;
};

export function emptyDetailRow(): InvoiceTimeReportDetailRow {
    return { date: '', initials: '', task: '', description: '', hours: '', amount: '' };
}

function emptySummaryRow(): InvoiceTimeReportSummaryRow {
    return { initials: '', name: '', title: '', hours: '', hourlyRate: '', totalPrice: '' };
}

export function emptyInvoiceTimeReportPack(currency: string): InvoiceTimeReportPack {
    return {
        currency,
        detailSlots: Array.from({ length: TIME_REPORT_DETAIL_ROWS }, emptyDetailRow),
        summarySlots: Array.from({ length: TIME_REPORT_SUMMARY_ROWS }, emptySummaryRow),
        detailTotalHoursDisplay: '',
        detailTotalAmountDisplay: '',
        summaryGrandHoursDisplay: '',
        summaryGrandAmountDisplay: '',
    };
}

export function formatTimeReportHours(n: number): string {
    if (!Number.isFinite(n))
        return '';
    const s = n.toFixed(3).replace(/\.?0+$/, '');
    return s || '0';
}

function detailRowIsTrailingEmpty(row: InvoiceTimeReportDetailRow): boolean {
    return ![row.date, row.initials, row.task, row.description, row.hours, row.amount].some((c) => String(c).trim().length > 0);
}

/** Убирает пустые строки снизу (после данных). */
export function trimTrailingEmptyDetailSlots(rows: readonly InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    const out = [...rows];
    while (out.length > 0 && detailRowIsTrailingEmpty(out[out.length - 1]!))
        out.pop();
    return out;
}

/** Все строки счёта для документов без обрезки по лимиту листа. */
export function finalizeDetailSlots(rows: InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    return trimTrailingEmptyDetailSlots(rows);
}

export function padDetailRows(rows: InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    const out = [...rows];
    while (out.length < TIME_REPORT_DETAIL_ROWS)
        out.push(emptyDetailRow());
    return out;
}

export function padSummaryRows(rows: InvoiceTimeReportSummaryRow[]): InvoiceTimeReportSummaryRow[] {
    const out = [...rows];
    while (out.length < TIME_REPORT_SUMMARY_ROWS)
        out.push(emptySummaryRow());
    return out;
}

export function formatTimeReportAmount(amount: number, currency: string): string {
    return formatCoverLetterTotal(amount, currency);
}
