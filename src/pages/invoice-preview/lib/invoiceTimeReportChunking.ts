import { emptyDetailRow, type InvoiceTimeReportDetailRow, trimTrailingEmptyDetailSlots } from './invoiceTimeReportModel';

/** Detail rows on a continuation page (no summary block). */
export const TIME_REPORT_PDF_ROWS_MID_CHUNK = 22;

/** Detail rows on the last time-report page (summary table below). */
export const TIME_REPORT_PDF_ROWS_LAST_CHUNK = 8;

export function splitDetailRowsForPagedTimeReport(rows: readonly InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[][] {
    const trimmed = trimTrailingEmptyDetailSlots(rows);
    if (trimmed.length === 0)
        return [[emptyDetailRow()]];

    const MID = TIME_REPORT_PDF_ROWS_MID_CHUNK;
    const LAST = TIME_REPORT_PDF_ROWS_LAST_CHUNK;
    const n = trimmed.length;

    if (n <= LAST)
        return [trimmed];

    const chunks: InvoiceTimeReportDetailRow[][] = [];
    let i = 0;

    while (i < n) {
        const remaining = n - i;
        if (remaining <= LAST) {
            chunks.push(trimmed.slice(i));
            break;
        }

        const rowsBeforeFinal = remaining - LAST;
        if (rowsBeforeFinal <= MID) {
            const firstSize = Math.min(MID, Math.ceil(remaining / 2));
            const secondSize = remaining - firstSize;
            if (secondSize <= LAST && firstSize >= 1) {
                chunks.push(trimmed.slice(i, i + firstSize));
                chunks.push(trimmed.slice(i + firstSize));
                break;
            }
        }

        const take = Math.min(MID, remaining - LAST);
        if (take < 1) {
            chunks.push(trimmed.slice(i));
            break;
        }
        chunks.push(trimmed.slice(i, i + take));
        i += take;
    }

    return chunks;
}

export function timeReportPagedChunkCount(rows: readonly InvoiceTimeReportDetailRow[]): number {
    return splitDetailRowsForPagedTimeReport(rows).length;
}
