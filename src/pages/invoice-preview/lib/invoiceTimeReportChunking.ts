import { emptyDetailRow, type InvoiceTimeReportDetailRow, trimTrailingEmptyDetailSlots } from './invoiceTimeReportModel';

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
/** Last page may run this many short rows past the nominal capacity. */
const LAST_SLACK = 3;

function textLines(text: string, charsPerLine: number): number {
    const parts = String(text ?? '').split(/\r?\n/);
    let count = 0;
    for (const part of parts) {
        const len = part.trim().length;
        count += len === 0 ? 1 : Math.ceil(len / charsPerLine);
    }
    return Math.max(1, count);
}

/** 1 = a single-line row. Wrapped description/task lines consume extra capacity. */
function rowUnits(row: InvoiceTimeReportDetailRow): number {
    const lines = Math.max(
        textLines(row.description, 42),
        textLines(row.task, 18),
        1,
    );
    return 1 + (lines - 1) * 1;
}

function summaryReserveUnits(summaryRows: number): number {
    if (summaryRows <= 0)
        return 0;
    return 5 + summaryRows * 1.6;
}

function unitSum(units: readonly number[], from: number, count: number): number {
    let sum = 0;
    const end = Math.min(units.length, from + count);
    for (let i = from; i < end; i += 1)
        sum += units[i] ?? 0;
    return sum;
}

export function splitDetailRowsForPagedTimeReport(
    rows: readonly InvoiceTimeReportDetailRow[],
    options?: { summaryRows?: number },
): InvoiceTimeReportDetailRow[][] {
    const trimmed = trimTrailingEmptyDetailSlots(rows);
    if (trimmed.length === 0)
        return [[emptyDetailRow()]];

    const MID = TIME_REPORT_PDF_ROWS_MID_CHUNK;
    const LAST = TIME_REPORT_PDF_ROWS_LAST_CHUNK;
    const lastBudget = Math.max(4, LAST + LAST_SLACK - summaryReserveUnits(options?.summaryRows ?? 0));
    const n = trimmed.length;
    const units = trimmed.map(rowUnits);
    const totalUnits = unitSum(units, 0, n);

    if (n <= LAST && totalUnits <= lastBudget)
        return [trimmed];

    const chunks: InvoiceTimeReportDetailRow[][] = [];
    let i = 0;

    while (i < n) {
        const remaining = n - i;
        const remainingUnits = unitSum(units, i, remaining);
        if (remaining <= lastBudget && remainingUnits <= lastBudget) {
            chunks.push(trimmed.slice(i));
            break;
        }

        let take = Math.min(MID, Math.max(0, remaining - LAST));
        while (take > 1 && unitSum(units, i, take) > MID)
            take -= 1;
        if (take < 1) {
            take = 1;
            while (i + take < n && unitSum(units, i, take + 1) <= MID)
                take += 1;
        }
        if (take > 0 && take < MIN_DENSE_MID_CHUNK && remainingUnits <= lastBudget) {
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
