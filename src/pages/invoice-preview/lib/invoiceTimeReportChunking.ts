import { TIME_REPORT_DETAIL_ROWS } from './invoicePreviewPackShared';
import { emptyDetailRow, type InvoiceTimeReportDetailRow, trimTrailingEmptyDetailSlots } from './invoiceTimeReportModel';

/** Детальных строк на странице «только таблица», без summary и без строки Total. */
export const TIME_REPORT_PDF_ROWS_MID_CHUNK = 22;
/** Макс. строк данных на последней странице под строку Total + блок Summary. */
export const TIME_REPORT_PDF_ROWS_LAST_CHUNK = 12;


/**
 * Чанки строк детальной таблицы под PDF/HTML:
 * последний чанк ≤ LAST — там же рисуются Total + Summary.
 */
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
