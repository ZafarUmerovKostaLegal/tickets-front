import { emptyDetailRow, trimTrailingEmptyDetailSlots } from './invoiceTimeReportModel';
/**
 * Continuation pages (title only + detail grid, no summary / expenses).
 * Keep high so mid pages stay dense instead of half-blank A4 sheets.
 */
export const TIME_REPORT_PDF_ROWS_MID_CHUNK = 24;
/**
 * Last time-report page also carries totals + summary (+ expenses/mehnat when present).
 * Align with TIME_REPORT_DETAIL_ROWS (14) so typical monthly reports stay on one sheet.
 */
export const TIME_REPORT_PDF_ROWS_LAST_CHUNK = 16;
/** If the penultimate page would hold fewer rows than this, fold everything onto the last page. */
const MIN_DENSE_MID_CHUNK = 6;
export function splitDetailRowsForPagedTimeReport(rows) {
    const trimmed = trimTrailingEmptyDetailSlots(rows);
    if (trimmed.length === 0)
        return [[emptyDetailRow()]];
    const MID = TIME_REPORT_PDF_ROWS_MID_CHUNK;
    const LAST = TIME_REPORT_PDF_ROWS_LAST_CHUNK;
    const n = trimmed.length;
    if (n <= LAST)
        return [trimmed];
    const chunks = [];
    let i = 0;
    while (i < n) {
        const remaining = n - i;
        if (remaining <= LAST) {
            chunks.push(trimmed.slice(i));
            break;
        }
        let take = Math.min(MID, remaining - LAST);
        // Prefer one denser final page over a nearly empty lead sheet ([4]+[4] style).
        if (take > 0 && take < MIN_DENSE_MID_CHUNK) {
            chunks.push(trimmed.slice(i));
            break;
        }
        if (take < 1) {
            chunks.push(trimmed.slice(i));
            break;
        }
        chunks.push(trimmed.slice(i, i + take));
        i += take;
    }
    return chunks;
}
export function timeReportPagedChunkCount(rows) {
    return splitDetailRowsForPagedTimeReport(rows).length;
}
