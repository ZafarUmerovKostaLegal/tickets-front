import { TIME_REPORT_DETAIL_ROWS } from './invoicePreviewPackShared';
import { emptyDetailRow, type InvoiceTimeReportDetailRow, trimTrailingEmptyDetailSlots } from './invoiceTimeReportModel';


export const TIME_REPORT_PDF_ROWS_MID_CHUNK = 22;

export const TIME_REPORT_PDF_ROWS_LAST_CHUNK = 12;



export function splitDetailRowsForPagedTimeReport(rows: readonly InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[][] {
    const trimmed = trimTrailingEmptyDetailSlots(rows);
    if (trimmed.length === 0) {
        return [
            Array.from({ length: TIME_REPORT_DETAIL_ROWS }, () => emptyDetailRow()),
        ];
    }

    const MID = TIME_REPORT_PDF_ROWS_MID_CHUNK;
    const LAST = TIME_REPORT_PDF_ROWS_LAST_CHUNK;

    if (trimmed.length <= LAST)
        return [trimmed];

    const chunks: InvoiceTimeReportDetailRow[][] = [];
    let i = 0;
    while (i < trimmed.length) {
        const remaining = trimmed.length - i;
        if (remaining <= LAST) {
            chunks.push(trimmed.slice(i));
            break;
        }
        const maxThis = Math.min(MID, trimmed.length - LAST - i);
        if (maxThis < 1) {
            chunks.push(trimmed.slice(i));
            break;
        }
        chunks.push(trimmed.slice(i, i + maxThis));
        i += maxThis;
    }
    return chunks;
}

export function timeReportPagedChunkCount(rows: readonly InvoiceTimeReportDetailRow[]): number {
    return splitDetailRowsForPagedTimeReport(rows).length;
}
