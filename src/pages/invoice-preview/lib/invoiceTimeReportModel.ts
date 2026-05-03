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

function emptyDetailRow(): InvoiceTimeReportDetailRow {
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

export function padDetailRows(rows: InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    const out = [...rows];
    while (out.length < TIME_REPORT_DETAIL_ROWS)
        out.push(emptyDetailRow());
    return out.slice(0, TIME_REPORT_DETAIL_ROWS);
}

export function padSummaryRows(rows: InvoiceTimeReportSummaryRow[]): InvoiceTimeReportSummaryRow[] {
    const out = [...rows];
    while (out.length < TIME_REPORT_SUMMARY_ROWS)
        out.push(emptySummaryRow());
    return out.slice(0, TIME_REPORT_SUMMARY_ROWS);
}

export function formatTimeReportAmount(amount: number, currency: string): string {
    return formatCoverLetterTotal(amount, currency);
}
