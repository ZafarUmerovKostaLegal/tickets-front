import { TIME_REPORT_DETAIL_ROWS, TIME_REPORT_SUMMARY_ROWS } from './invoicePreviewPackShared';

export type InvoiceTimeReportDetailRow = {
    date: string;
    initials: string;
    task: string;
    description: string;
    hours: string;
    hourlyRate: string;
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
    /** Expense lines shown in a separate table (not mixed into time details). */
    expenseSlots: InvoiceTimeReportDetailRow[];
    /** My Mehnat time lines — own table, not mixed into the main time grid. */
    mehnatSlots: InvoiceTimeReportDetailRow[];
    summarySlots: InvoiceTimeReportSummaryRow[];
    detailTotalHoursDisplay: string;
    detailTotalAmountDisplay: string;
    expenseTotalAmountDisplay: string;
    mehnatTotalHoursDisplay: string;
    mehnatTotalAmountDisplay: string;
    summaryGrandHoursDisplay: string;
    summaryGrandAmountDisplay: string;
};

export function emptyDetailRow(): InvoiceTimeReportDetailRow {
    return { date: '', initials: '', task: '', description: '', hours: '', hourlyRate: '', amount: '' };
}

function emptySummaryRow(): InvoiceTimeReportSummaryRow {
    return { initials: '', name: '', title: '', hours: '', hourlyRate: '', totalPrice: '' };
}

export function emptyInvoiceTimeReportPack(currency: string): InvoiceTimeReportPack {
    return {
        currency,
        detailSlots: Array.from({ length: TIME_REPORT_DETAIL_ROWS }, emptyDetailRow),
        expenseSlots: [],
        mehnatSlots: [],
        summarySlots: Array.from({ length: TIME_REPORT_SUMMARY_ROWS }, emptySummaryRow),
        detailTotalHoursDisplay: '',
        detailTotalAmountDisplay: '',
        expenseTotalAmountDisplay: '',
        mehnatTotalHoursDisplay: '',
        mehnatTotalAmountDisplay: '',
        summaryGrandHoursDisplay: '',
        summaryGrandAmountDisplay: '',
    };
}

export function formatTimeReportHours(n: number): string {
    if (!Number.isFinite(n))
        return '';
    // Match partner Excel export: 2 decimal places, ru-RU comma separator (e.g. 0,63).
    return n.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function detailRowIsTrailingEmpty(row: InvoiceTimeReportDetailRow): boolean {
    return ![row.date, row.initials, row.task, row.description, row.hours, row.hourlyRate, row.amount]
        .some((c) => String(c).trim().length > 0);
}

export function trimTrailingEmptyDetailSlots(rows: readonly InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    const out = [...rows];
    while (out.length > 0 && detailRowIsTrailingEmpty(out[out.length - 1]!))
        out.pop();
    return out;
}

/** True when the pack has at least one non-empty time or expense row (not a placeholder). */
export function timeReportPackHasContent(pack: InvoiceTimeReportPack | null | undefined): boolean {
    if (!pack)
        return false;
    return trimTrailingEmptyDetailSlots(pack.detailSlots).length > 0
        || trimTrailingEmptyDetailSlots(pack.expenseSlots ?? []).length > 0
        || trimTrailingEmptyDetailSlots(pack.mehnatSlots ?? []).length > 0;
}

/** Task names like «My mehnat registration» / «Регистрация My mehnat». Description-only mentions do not count. */
export function isMyMehnatTimeReportRow(row: Pick<InvoiceTimeReportDetailRow, 'task'>): boolean {
    return (row.task ?? '').toLowerCase().includes('mehnat');
}

export function parseTimeReportHoursDisplay(raw: string): number {
    const t = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
}

export function parseTimeReportAmountDisplay(raw: string): number {
    let t = String(raw ?? '').trim().replace(/[−–]/g, '-');
    const neg = t.startsWith('-');
    t = t.replace(/^-/, '').replace(/[A-Za-z\s]/g, '');
    if (t.includes('.') && t.includes(','))
        t = t.replace(/,/g, '');
    else if (t.includes(',') && !t.includes('.'))
        t = t.replace(',', '.');
    const n = Number(t);
    if (!Number.isFinite(n))
        return 0;
    return neg ? -n : n;
}

function sumDetailHours(rows: readonly InvoiceTimeReportDetailRow[]): number {
    return rows.reduce((s, r) => s + parseTimeReportHoursDisplay(r.hours), 0);
}

function sumDetailAmounts(rows: readonly InvoiceTimeReportDetailRow[]): number {
    return rows.reduce((s, r) => s + parseTimeReportAmountDisplay(r.amount), 0);
}

/** Pull My Mehnat rows out of the main time grid (also heals older saved packs). */
export function ensureMehnatSeparatedPack(pack: InvoiceTimeReportPack): InvoiceTimeReportPack {
    const details = trimTrailingEmptyDetailSlots(pack.detailSlots);
    const already = trimTrailingEmptyDetailSlots(pack.mehnatSlots ?? []);
    const fromDetails = details.filter(isMyMehnatTimeReportRow);
    const regular = details.filter((r) => !isMyMehnatTimeReportRow(r));
    const cur = (pack.currency || 'EUR').trim().toUpperCase() || 'EUR';

    if (fromDetails.length === 0) {
        if (already.length === 0) {
            if (pack.mehnatSlots != null)
                return pack;
            return {
                ...pack,
                mehnatSlots: [],
                mehnatTotalHoursDisplay: pack.mehnatTotalHoursDisplay ?? '',
                mehnatTotalAmountDisplay: pack.mehnatTotalAmountDisplay ?? '',
            };
        }
        if ((pack.mehnatTotalHoursDisplay ?? '').trim() && (pack.mehnatTotalAmountDisplay ?? '').trim())
            return pack;
        return {
            ...pack,
            mehnatSlots: already,
            mehnatTotalHoursDisplay: formatTimeReportHours(sumDetailHours(already)),
            mehnatTotalAmountDisplay: formatTimeReportAmount(sumDetailAmounts(already), cur),
        };
    }

    const mehnat = [...already, ...fromDetails];
    return {
        ...pack,
        detailSlots: regular.length ? finalizeDetailSlots(regular) : [],
        detailTotalHoursDisplay: formatTimeReportHours(sumDetailHours(regular)),
        detailTotalAmountDisplay: formatTimeReportAmount(sumDetailAmounts(regular), cur),
        mehnatSlots: finalizeDetailSlots(mehnat),
        mehnatTotalHoursDisplay: formatTimeReportHours(sumDetailHours(mehnat)),
        mehnatTotalAmountDisplay: formatTimeReportAmount(sumDetailAmounts(mehnat), cur),
    };
}

export function finalizeDetailSlots(rows: InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    return trimTrailingEmptyDetailSlots(rows);
}

export function padDetailRows(rows: InvoiceTimeReportDetailRow[]): InvoiceTimeReportDetailRow[] {
    const out = [...rows];
    while (out.length < TIME_REPORT_DETAIL_ROWS)
        out.push(emptyDetailRow());
    return out;
}

function summaryRowIsEmpty(row: InvoiceTimeReportSummaryRow): boolean {
    return ![row.initials, row.name, row.title, row.hours, row.hourlyRate, row.totalPrice]
        .some((c) => String(c).trim().length > 0);
}

export function trimTrailingEmptySummarySlots(rows: readonly InvoiceTimeReportSummaryRow[]): InvoiceTimeReportSummaryRow[] {
    const out = [...rows];
    while (out.length > 0 && summaryRowIsEmpty(out[out.length - 1]!))
        out.pop();
    return out;
}

export function padSummaryRows(rows: InvoiceTimeReportSummaryRow[]): InvoiceTimeReportSummaryRow[] {
    const out = [...rows];
    while (out.length < TIME_REPORT_SUMMARY_ROWS)
        out.push(emptySummaryRow());
    return out;
}

export function formatTimeReportAmount(amount: number, currency: string): string {
    const cur = (currency || 'EUR').trim().toUpperCase() || 'EUR';
    if (!Number.isFinite(amount))
        return `${cur} 0.00`;
    const neg = amount < 0;
    const num = Math.abs(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return neg ? `−${cur} ${num}` : `${cur} ${num}`;
}
