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

/** Same 2-decimal rounding as the partner Excel export (`excelNum2`). */
export function roundTimeReportHours2(n: number): number {
    if (!Number.isFinite(n))
        return 0;
    return Math.round(n * 100) / 100;
}

/** Task label stays in the description. It used to be stripped before the notes. */
export function descriptionKeepingTaskWords(task: string, description: string): string {
    const taskText = task.trim();
    const note = description.trim();
    const taskMissing = !taskText || taskText === '—' || taskText === '-';
    const noteMissing = !note || note === '—' || note === '-';
    if (taskMissing)
        return noteMissing ? '' : note;
    if (noteMissing)
        return taskText;
    if (note.toLowerCase().startsWith(taskText.toLowerCase()))
        return note;
    return `${taskText} ${note}`;
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

/** Sum hours the way the invoice grid shows them: round each line, then add. */
export function sumRoundedTimeReportHours(values: readonly number[]): number {
    return roundTimeReportHours2(values.reduce((sum, n) => sum + roundTimeReportHours2(n), 0));
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

function expenseAmountKey(row: InvoiceTimeReportDetailRow): number {
    return Math.round(parseTimeReportAmountDisplay(row.amount) * 100);
}

/**
 * Live rows supply the amount (FX). A saved description in another language
 * stays on the same expense, matched by date and amount.
 */
export function mergeExpenseSlotsKeepSavedText(
    saved: readonly InvoiceTimeReportDetailRow[],
    live: readonly InvoiceTimeReportDetailRow[],
): InvoiceTimeReportDetailRow[] {
    const savedRows = trimTrailingEmptyDetailSlots(saved);
    const liveRows = trimTrailingEmptyDetailSlots(live);
    const used = new Set<number>();
    return liveRows.map((liveRow, index) => {
        const date = liveRow.date.trim();
        const liveCents = expenseAmountKey(liveRow);
        let best = -1;
        let bestDelta = Number.POSITIVE_INFINITY;
        savedRows.forEach((savedRow, i) => {
            if (used.has(i) || savedRow.date.trim() !== date)
                return;
            const delta = Math.abs(expenseAmountKey(savedRow) - liveCents);
            if (delta < bestDelta) {
                bestDelta = delta;
                best = i;
            }
        });
        if (best < 0 && savedRows[index] && !used.has(index))
            best = index;
        if (best < 0)
            return liveRow;
        used.add(best);
        const savedRow = savedRows[best]!;
        const savedDesc = savedRow.description.trim();
        if (!savedDesc || savedDesc === liveRow.description.trim())
            return liveRow;
        return { ...liveRow, description: savedRow.description };
    });
}

/** Saved time rows keep hours and amounts; Description comes from the full live text. */
function mergeTimeRowsKeepLiveDescription(
    saved: readonly InvoiceTimeReportDetailRow[],
    live: readonly InvoiceTimeReportDetailRow[],
): InvoiceTimeReportDetailRow[] {
    const liveRows = trimTrailingEmptyDetailSlots(live);
    if (!liveRows.length)
        return [...saved];
    if (!trimTrailingEmptyDetailSlots(saved).length)
        return liveRows;
    const used = new Set<number>();
    return saved.map((savedRow) => {
        const match = liveRows.findIndex((liveRow, index) => (
            !used.has(index)
            && liveRow.date.trim() === savedRow.date.trim()
            && liveRow.initials.trim() === savedRow.initials.trim()
            && liveRow.task.trim() === savedRow.task.trim()
        ));
        if (match < 0)
            return savedRow;
        used.add(match);
        const next = liveRows[match]!.description.trim();
        if (!next || next === savedRow.description.trim())
            return savedRow;
        return { ...savedRow, description: liveRows[match]!.description };
    });
}

/**
 * Keep saved user edits for time/mehnat/summary and expense wording, but always
 * take expense amounts from a freshly resolved pack (registry UZS÷CBU).
 */
export function mergeTimeReportPackPreferLiveExpenses(
    saved: InvoiceTimeReportPack,
    live: InvoiceTimeReportPack,
): InvoiceTimeReportPack {
    const liveExpenses = live.expenseSlots ?? [];
    const hasLiveExpenses = trimTrailingEmptyDetailSlots(liveExpenses).length > 0;
    const detailSlots = mergeTimeRowsKeepLiveDescription(saved.detailSlots ?? [], live.detailSlots ?? []);
    if (!hasLiveExpenses)
        return { ...saved, detailSlots };
    const cur = (live.currency || saved.currency || 'USD').trim().toUpperCase() || 'USD';
    const expenseSlots = mergeExpenseSlotsKeepSavedText(saved.expenseSlots ?? [], liveExpenses);
    const totalFromLive = (live.expenseTotalAmountDisplay ?? '').trim();
    const expenseTotalAmountDisplay = totalFromLive
        || formatTimeReportAmount(sumDetailAmounts(trimTrailingEmptyDetailSlots(expenseSlots)), cur);
    return {
        ...saved,
        currency: live.currency || saved.currency,
        detailSlots,
        expenseSlots,
        expenseTotalAmountDisplay,
    };
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

function hoursShownOnLine(raw: string): number {
    return roundTimeReportHours2(parseTimeReportHoursDisplay(raw));
}

function withLineHoursRounded(row: InvoiceTimeReportDetailRow): InvoiceTimeReportDetailRow {
    if (!String(row.hours ?? '').trim())
        return row;
    const next = formatTimeReportHours(hoursShownOnLine(row.hours));
    return next === row.hours ? row : { ...row, hours: next };
}

function sumDetailHours(rows: readonly InvoiceTimeReportDetailRow[]): number {
    return roundTimeReportHours2(rows.reduce((s, r) => s + hoursShownOnLine(r.hours), 0));
}

/**
 * Line hours, the person row and both totals must use the same 2-decimal hours.
 * Raw 0,083 + 0,084 is 0,17, while each line shows 0,08 and 0,08 + 0,08 = 0,16.
 */
function alignHoursToDisplayedLines(pack: InvoiceTimeReportPack): InvoiceTimeReportPack {
    const detailSlots = pack.detailSlots.map(withLineHoursRounded);
    const mehnatSlots = (pack.mehnatSlots ?? []).map(withLineHoursRounded);
    const details = trimTrailingEmptyDetailSlots(detailSlots);
    const mehnat = trimTrailingEmptyDetailSlots(mehnatSlots);
    const byInitials = new Map<string, number>();
    for (const row of details) {
        const key = row.initials.trim().toUpperCase();
        if (!key)
            continue;
        byInitials.set(key, roundTimeReportHours2((byInitials.get(key) ?? 0) + hoursShownOnLine(row.hours)));
    }
    const summarySlots = pack.summarySlots.map((row) => {
        if (summaryRowIsEmpty(row))
            return row;
        const key = row.initials.trim().toUpperCase();
        if (!key || key === '—' || key === '-')
            return row;
        const hours = byInitials.get(key);
        if (hours == null)
            return row;
        const next = formatTimeReportHours(hours);
        return next === row.hours ? row : { ...row, hours: next };
    });
    const detailTotal = formatTimeReportHours(sumDetailHours(details));
    const mehnatTotal = mehnat.length ? formatTimeReportHours(sumDetailHours(mehnat)) : (pack.mehnatTotalHoursDisplay ?? '');
    const grandTotal = detailTotal;
    const slotsSame = detailSlots.every((row, i) => row === pack.detailSlots[i])
        && mehnatSlots.every((row, i) => row === (pack.mehnatSlots ?? [])[i]);
    if (
        slotsSame
        && detailTotal === pack.detailTotalHoursDisplay
        && mehnatTotal === (pack.mehnatTotalHoursDisplay ?? '')
        && grandTotal === pack.summaryGrandHoursDisplay
        && summarySlots.every((row, i) => row === pack.summarySlots[i])
    ) {
        return pack;
    }
    return {
        ...pack,
        detailSlots,
        mehnatSlots,
        summarySlots,
        detailTotalHoursDisplay: details.length ? detailTotal : pack.detailTotalHoursDisplay,
        mehnatTotalHoursDisplay: mehnatTotal,
        summaryGrandHoursDisplay: details.length ? grandTotal : pack.summaryGrandHoursDisplay,
    };
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
                return alignHoursToDisplayedLines(pack);
            return alignHoursToDisplayedLines({
                ...pack,
                mehnatSlots: [],
                mehnatTotalHoursDisplay: pack.mehnatTotalHoursDisplay ?? '',
                mehnatTotalAmountDisplay: pack.mehnatTotalAmountDisplay ?? '',
            });
        }
        if ((pack.mehnatTotalHoursDisplay ?? '').trim() && (pack.mehnatTotalAmountDisplay ?? '').trim())
            return alignHoursToDisplayedLines(pack);
        return alignHoursToDisplayedLines({
            ...pack,
            mehnatSlots: already,
            mehnatTotalHoursDisplay: formatTimeReportHours(sumDetailHours(already)),
            mehnatTotalAmountDisplay: formatTimeReportAmount(sumDetailAmounts(already), cur),
        });
    }

    const mehnat = [...already, ...fromDetails];
    return alignHoursToDisplayedLines({
        ...pack,
        detailSlots: regular.length ? finalizeDetailSlots(regular) : [],
        detailTotalHoursDisplay: formatTimeReportHours(sumDetailHours(regular)),
        detailTotalAmountDisplay: formatTimeReportAmount(sumDetailAmounts(regular), cur),
        mehnatSlots: finalizeDetailSlots(mehnat),
        mehnatTotalHoursDisplay: formatTimeReportHours(sumDetailHours(mehnat)),
        mehnatTotalAmountDisplay: formatTimeReportAmount(sumDetailAmounts(mehnat), cur),
    });
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
