import { normalizeReportEmployeePositionLabel } from '@entities/time-tracking/lib/reportEmployeePosition';
import { compareReportPositionTitles } from '@pages/report-preview/lib/reportPreviewPositionRates';
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
    /** Fixed amount on top of hours — own table, above Summary of services. */
    fixedFeeSlots?: InvoiceTimeReportDetailRow[];
    summarySlots: InvoiceTimeReportSummaryRow[];
    detailTotalHoursDisplay: string;
    detailTotalAmountDisplay: string;
    expenseTotalAmountDisplay: string;
    mehnatTotalHoursDisplay: string;
    mehnatTotalAmountDisplay: string;
    fixedFeeTotalAmountDisplay?: string;
    summaryGrandHoursDisplay: string;
    summaryGrandAmountDisplay: string;
    /** Edited heading on the first time-report sheet. Empty means the generated title. */
    reportTitle?: string | null;
    /** Edited heading on continuation sheets. */
    reportTitleContinued?: string | null;
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
        fixedFeeSlots: [],
        summarySlots: Array.from({ length: TIME_REPORT_SUMMARY_ROWS }, emptySummaryRow),
        detailTotalHoursDisplay: '',
        detailTotalAmountDisplay: '',
        expenseTotalAmountDisplay: '',
        mehnatTotalHoursDisplay: '',
        mehnatTotalAmountDisplay: '',
        fixedFeeTotalAmountDisplay: '',
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
        || trimTrailingEmptyDetailSlots(pack.mehnatSlots ?? []).length > 0
        || trimTrailingEmptyDetailSlots(pack.fixedFeeSlots ?? []).length > 0;
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

function normReportHours(raw: string): string {
    return String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
}

function sameTimeReportLine(
    a: InvoiceTimeReportDetailRow,
    b: InvoiceTimeReportDetailRow,
): boolean {
    return a.date.trim() === b.date.trim()
        && a.initials.trim().toUpperCase() === b.initials.trim().toUpperCase()
        && normReportHours(a.hours) === normReportHours(b.hours)
        && parseTimeReportAmountDisplay(a.amount).toFixed(2) === parseTimeReportAmountDisplay(b.amount).toFixed(2);
}

function reportDateToIso(display: string): string {
    const match = display.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match)
        return `${match[3]}-${match[2]}-${match[1]}`;
    return display.trim().slice(0, 10);
}

/** Fill Task from the linked project task when a saved row still shows the note. */
export function applyLinkedTaskNamesToTimeReportPack(
    pack: InvoiceTimeReportPack,
    hints: readonly { workDate: string; hours: number; description: string | null; taskName: string }[],
): InvoiceTimeReportPack {
    if (!hints.length)
        return pack;
    const used = new Set<number>();
    let changed = false;
    const mapRows = (rows: InvoiceTimeReportDetailRow[]) => rows.map((row) => {
        const lineDate = reportDateToIso(row.date);
        const lineNote = row.description.trim().toLowerCase().replace(/\s+/g, ' ');
        const lineHours = parseTimeReportHoursDisplay(row.hours);
        let best = -1;
        hints.forEach((hint, index) => {
            if (used.has(index) || best >= 0)
                return;
            if (hint.workDate.slice(0, 10) !== lineDate)
                return;
            if (Math.abs(hint.hours - lineHours) > 0.02)
                return;
            const hintNote = (hint.description ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
            const notesMatch = Boolean(lineNote) && (hintNote === lineNote || hintNote.includes(lineNote) || lineNote.includes(hintNote));
            if (!notesMatch && lineNote !== hint.taskName.trim().toLowerCase())
                return;
            best = index;
        });
        if (best < 0)
            return row;
        used.add(best);
        const task = hints[best]!.taskName.trim();
        if (!task || task.toLowerCase() === row.description.trim().toLowerCase() || task === row.task.trim())
            return row;
        changed = true;
        return { ...row, task };
    });
    const detailSlots = mapRows(pack.detailSlots ?? []);
    const mehnatSlots = mapRows(pack.mehnatSlots ?? []);
    return changed ? { ...pack, detailSlots, mehnatSlots } : pack;
}

/** Saved wording stays; Task always comes from the live row (task linked in the DB). */
function mergeTimeRowsKeepLiveDescription(
    saved: readonly InvoiceTimeReportDetailRow[],
    live: readonly InvoiceTimeReportDetailRow[],
): InvoiceTimeReportDetailRow[] {
    const liveRows = trimTrailingEmptyDetailSlots(live);
    if (!liveRows.length)
        return [...saved];
    if (!trimTrailingEmptyDetailSlots(saved).length)
        return liveRows;
    const savedRows = trimTrailingEmptyDetailSlots(saved);
    const used = new Set<number>();
    return liveRows.map((liveRow) => {
        const match = savedRows.findIndex((savedRow, index) => (
            !used.has(index) && sameTimeReportLine(liveRow, savedRow)
        ));
        if (match < 0)
            return liveRow;
        used.add(match);
        const savedRow = savedRows[match]!;
        const liveTask = liveRow.task.trim();
        const savedTask = savedRow.task.trim();
        const savedNote = savedRow.description.trim();
        const savedTaskIsNote = Boolean(savedTask) && Boolean(savedNote)
            && savedTask.toLowerCase() === savedNote.toLowerCase();
        const withSavedWording = { ...liveRow, description: savedRow.description };
        if (!liveTask)
            return savedTaskIsNote ? { ...withSavedWording, task: '' } : { ...withSavedWording, task: savedRow.task };
        if (liveTask === savedTask)
            return withSavedWording;
        return { ...withSavedWording, task: liveTask };
    });
}

/**
 * Keep saved wording for time lines and expenses, take expense amounts from the
 * live pack, and take summary rate rows from the live pack so an older rate
 * shows up in a draft that was saved before the split.
 */
export function mergeTimeReportPackPreferLiveExpenses(
    saved: InvoiceTimeReportPack,
    live: InvoiceTimeReportPack,
): InvoiceTimeReportPack {
    const liveExpenses = live.expenseSlots ?? [];
    const hasLiveExpenses = trimTrailingEmptyDetailSlots(liveExpenses).length > 0;
    const detailSlots = mergeTimeRowsKeepLiveDescription(saved.detailSlots ?? [], live.detailSlots ?? []);
    const fixedFeeSlots = mergeTimeRowsKeepLiveDescription(saved.fixedFeeSlots ?? [], live.fixedFeeSlots ?? []);
    const fixedFeeTotalAmountDisplay = (live.fixedFeeTotalAmountDisplay ?? '').trim()
        || (saved.fixedFeeTotalAmountDisplay ?? '');
    const summaryFromLive = mergeSummarySlotsPreferLiveRates(saved, live);
    if (!hasLiveExpenses) {
        return withSummaryOrderedBySeniority({
            ...saved,
            detailSlots,
            fixedFeeSlots,
            fixedFeeTotalAmountDisplay,
            ...summaryFromLive,
        });
    }
    const cur = (live.currency || saved.currency || 'USD').trim().toUpperCase() || 'USD';
    const expenseSlots = mergeExpenseSlotsKeepSavedText(saved.expenseSlots ?? [], liveExpenses);
    const totalFromLive = (live.expenseTotalAmountDisplay ?? '').trim();
    const expenseTotalAmountDisplay = totalFromLive
        || formatTimeReportAmount(sumDetailAmounts(trimTrailingEmptyDetailSlots(expenseSlots)), cur);
    return withSummaryOrderedBySeniority({
        ...saved,
        currency: live.currency || saved.currency,
        detailSlots,
        fixedFeeSlots,
        fixedFeeTotalAmountDisplay,
        expenseSlots,
        expenseTotalAmountDisplay,
        ...summaryFromLive,
    });
}

/** A saved draft keeps its wording, but rate rows come from the freshly resolved pack. */
function mergeSummarySlotsPreferLiveRates(
    saved: InvoiceTimeReportPack,
    live: InvoiceTimeReportPack,
): Pick<InvoiceTimeReportPack, 'summarySlots' | 'summaryGrandHoursDisplay' | 'summaryGrandAmountDisplay'> {
    const liveRows = trimTrailingEmptySummarySlots(live.summarySlots ?? []);
    if (!liveRows.length) {
        return {
            summarySlots: saved.summarySlots,
            summaryGrandHoursDisplay: saved.summaryGrandHoursDisplay,
            summaryGrandAmountDisplay: saved.summaryGrandAmountDisplay,
        };
    }
    const savedRows = trimTrailingEmptySummarySlots(saved.summarySlots ?? []);
    const used = new Set<number>();
    const summarySlots = liveRows.map((liveRow) => {
        const match = savedRows.findIndex((savedRow, index) => {
            if (used.has(index))
                return false;
            if (savedRow.initials.trim().toUpperCase() !== liveRow.initials.trim().toUpperCase())
                return false;
            if (savedRow.name.trim().toLowerCase() !== liveRow.name.trim().toLowerCase())
                return false;
            return Math.abs(
                parseTimeReportAmountDisplay(savedRow.hourlyRate) - parseTimeReportAmountDisplay(liveRow.hourlyRate),
            ) < 0.01;
        });
        if (match < 0)
            return liveRow;
        used.add(match);
        const savedRow = savedRows[match]!;
        return {
            ...liveRow,
            name: savedRow.name.trim() ? savedRow.name : liveRow.name,
            title: savedRow.title.trim() ? savedRow.title : liveRow.title,
        };
    });
    return {
        summarySlots,
        summaryGrandHoursDisplay: live.summaryGrandHoursDisplay || saved.summaryGrandHoursDisplay,
        summaryGrandAmountDisplay: live.summaryGrandAmountDisplay || saved.summaryGrandAmountDisplay,
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

/**
 * Rate actually billed on a line. When the stored unit rate and amount÷hours
 * disagree, the amount wins — that is the older rate still sitting on the draft.
 */
export function billableRateFromLine(opts: {
    unitAmount?: number | null;
    rateSource?: number | null;
    hours: number;
    amount: number;
}): number {
    const implied = opts.hours > 0 && Number.isFinite(opts.amount) && opts.amount !== 0
        ? opts.amount / opts.hours
        : 0;
    const unit = Number(opts.unitAmount);
    const src = Number(opts.rateSource);
    const listed = Number.isFinite(unit) && unit > 0
        ? unit
        : (Number.isFinite(src) && src > 0 ? src : 0);
    if (listed > 0 && implied > 0) {
        const listedCents = Math.round(listed * 100) / 100;
        const impliedCents = Math.round(implied * 100) / 100;
        const gap = Math.abs(opts.amount - listed * opts.hours);
        if (Math.abs(listedCents - impliedCents) >= 0.01 && gap > Math.max(0.05, Math.abs(opts.amount) * 0.005))
            return impliedCents;
        return listedCents;
    }
    if (listed > 0)
        return Math.round(listed * 100) / 100;
    return implied > 0 ? Math.round(implied * 100) / 100 : 0;
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
    const summaryRowsForInitials = new Map<string, number>();
    for (const row of pack.summarySlots) {
        if (summaryRowIsEmpty(row))
            continue;
        const key = row.initials.trim().toUpperCase();
        if (!key || key === '—' || key === '-')
            continue;
        summaryRowsForInitials.set(key, (summaryRowsForInitials.get(key) ?? 0) + 1);
    }
    const summarySlots = pack.summarySlots.map((row) => {
        if (summaryRowIsEmpty(row))
            return row;
        const key = row.initials.trim().toUpperCase();
        if (!key || key === '—' || key === '-')
            return row;
        if ((summaryRowsForInitials.get(key) ?? 0) !== 1)
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

function blankReportCell(raw: string): boolean {
    const text = raw.trim();
    return !text || text === '—' || text === '-' || text === '–';
}

const GENERIC_FIXED_FEE_DESCRIPTION = /^(fixed fee|fixed amount|фиксированная сумма)$/i;

/** Text for the fixed-fee table column «Scope description». */
export function fixedFeeScopeText(row: Pick<InvoiceTimeReportDetailRow, 'task' | 'description'>): string {
    const desc = row.description.trim();
    const task = row.task.trim();
    const taskOk = Boolean(task) && task !== '—' && task !== '-' && task !== '–';
    const generic = !desc || desc === '—' || desc === '-' || desc === '–' || GENERIC_FIXED_FEE_DESCRIPTION.test(desc);
    if (!generic)
        return row.description;
    if (taskOk)
        return row.task;
    return row.description;
}

/** The hours-plus-fee line: no date, person, hours or rate, task Other. */
export function isFixedFeeTimeReportRow(row: InvoiceTimeReportDetailRow): boolean {
    const hours = row.hours.trim();
    const hoursBlank = blankReportCell(hours) || hours === '0' || hours === '0.00' || hours === '0,00';
    if (!hoursBlank || !blankReportCell(row.hourlyRate) || !blankReportCell(row.initials) || !blankReportCell(row.date))
        return false;
    const task = row.task.trim().toLowerCase();
    if (task === 'other' || task === 'прочее')
        return true;
    const desc = row.description.trim().toLowerCase();
    return desc === 'fixed fee' || desc === 'fixed amount' || desc === 'фиксированная сумма';
}

function detailAmountWithoutFixedFee(
    pack: InvoiceTimeReportPack,
    regular: readonly InvoiceTimeReportDetailRow[],
    feeRows: readonly InvoiceTimeReportDetailRow[],
): string {
    const cur = (pack.currency || 'USD').trim().toUpperCase() || 'USD';
    const shown = parseTimeReportAmountDisplay(pack.detailTotalAmountDisplay);
    const regularSum = sumDetailAmounts(regular);
    const feeSum = sumDetailAmounts(feeRows);
    if (feeSum !== 0 && Math.abs(shown - (regularSum + feeSum)) < 0.05)
        return formatTimeReportAmount(regularSum, cur);
    return pack.detailTotalAmountDisplay;
}

/** Pull the fixed-fee line out of the time grid (also heals older saved packs). */
export function ensureFixedFeeSeparatedPack(pack: InvoiceTimeReportPack): InvoiceTimeReportPack {
    const details = trimTrailingEmptyDetailSlots(pack.detailSlots);
    const already = trimTrailingEmptyDetailSlots(pack.fixedFeeSlots ?? []);
    const fromDetails = details.filter(isFixedFeeTimeReportRow);
    const regular = fromDetails.length ? details.filter((row) => !isFixedFeeTimeReportRow(row)) : details;
    const cur = (pack.currency || 'USD').trim().toUpperCase() || 'USD';
    const feeRows = fromDetails.length ? [...already, ...fromDetails] : already;
    if (!feeRows.length) {
        if (pack.fixedFeeSlots != null)
            return pack;
        return { ...pack, fixedFeeSlots: [], fixedFeeTotalAmountDisplay: pack.fixedFeeTotalAmountDisplay ?? '' };
    }
    const detailTotalAmountDisplay = detailAmountWithoutFixedFee(pack, regular, feeRows);
    const fixedFeeTotalAmountDisplay = (fromDetails.length || !(pack.fixedFeeTotalAmountDisplay ?? '').trim())
        ? formatTimeReportAmount(sumDetailAmounts(feeRows), cur)
        : pack.fixedFeeTotalAmountDisplay;
    if (
        !fromDetails.length
        && detailTotalAmountDisplay === pack.detailTotalAmountDisplay
        && fixedFeeTotalAmountDisplay === pack.fixedFeeTotalAmountDisplay
        && pack.fixedFeeSlots != null
    )
        return pack;
    return alignHoursToDisplayedLines({
        ...pack,
        detailSlots: fromDetails.length ? (regular.length ? finalizeDetailSlots(regular) : []) : pack.detailSlots,
        detailTotalHoursDisplay: fromDetails.length
            ? formatTimeReportHours(sumDetailHours(regular))
            : pack.detailTotalHoursDisplay,
        detailTotalAmountDisplay,
        fixedFeeSlots: finalizeDetailSlots(feeRows),
        fixedFeeTotalAmountDisplay,
    });
}

/** Pull My Mehnat rows out of the main time grid (also heals older saved packs). */
function separateMehnatRows(pack: InvoiceTimeReportPack): InvoiceTimeReportPack {
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

/** Pull My Mehnat rows out of the main time grid (also heals older saved packs). */
export function ensureMehnatSeparatedPack(pack: InvoiceTimeReportPack): InvoiceTimeReportPack {
    return ensureFixedFeeSeparatedPack(separateMehnatRows(pack));
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

function summaryTitleIsBlank(title: string): boolean {
    const text = title.trim();
    return !text || text === '—' || text === '-' || text === '–';
}

export type InvoiceSummaryRateSlice = {
    rate: number;
    hours: number;
    amount: number;
};

/**
 * One summary line per hourly rate. A second line appears when hours in the
 * period were billed at an older rate. That line leaves the title empty.
 */
export function summaryRowsForRateSlices(input: {
    initials: string;
    name: string;
    title: string;
    currency: string;
    hours: number;
    amount: number;
    slices: readonly InvoiceSummaryRateSlice[];
}): InvoiceTimeReportSummaryRow[] {
    const byRate = new Map<number, { hours: number; amount: number }>();
    for (const slice of input.slices) {
        if (!(slice.rate > 0) || !(slice.hours > 0))
            continue;
        const rate = Math.round(slice.rate * 100) / 100;
        const cur = byRate.get(rate) ?? { hours: 0, amount: 0 };
        cur.hours += slice.hours;
        cur.amount += slice.amount;
        byRate.set(rate, cur);
    }
    const distinct = [...byRate.entries()].sort((a, b) => b[0] - a[0]);
    if (distinct.length < 2) {
        const rate = distinct[0]?.[0] ?? (input.hours > 0 ? input.amount / input.hours : 0);
        return [summaryRowFromSlice(input, input.title, input.hours, rate, input.amount)];
    }
    const ratedHours = distinct.reduce((sum, [, bucket]) => sum + bucket.hours, 0);
    const ratedAmount = distinct.reduce((sum, [, bucket]) => sum + bucket.amount, 0);
    const leftoverHours = input.hours - ratedHours;
    const leftoverAmount = input.amount - ratedAmount;
    if (Math.abs(leftoverHours) > 0.0001 || Math.abs(leftoverAmount) > 0.0001) {
        const host = distinct.reduce((best, entry) => (entry[1].hours > best[1].hours ? entry : best));
        host[1].hours += leftoverHours;
        host[1].amount += leftoverAmount;
    }
    return distinct.map(([rate, bucket], index) => summaryRowFromSlice(
        input,
        index === 0 ? input.title : '',
        bucket.hours,
        rate,
        bucket.amount,
    ));
}

function summaryRowFromSlice(
    input: { initials: string; name: string; currency: string },
    title: string,
    hours: number,
    rate: number,
    amount: number,
): InvoiceTimeReportSummaryRow {
    return {
        initials: input.initials,
        name: input.name,
        title,
        hours: formatTimeReportHours(hours),
        hourlyRate: rate > 0 ? formatTimeReportAmount(rate, input.currency) : '—',
        totalPrice: formatTimeReportAmount(amount, input.currency),
    };
}

function summaryPersonKey(row: InvoiceTimeReportSummaryRow): string {
    return `${row.initials.trim()}\0${row.name.trim().toLowerCase()}`;
}

/** Partner, then Counsel, Senior Associate, Associate, Junior Associate, Trainee. Same title: higher rate, then higher amount. */
export function orderTimeReportSummarySlots(rows: readonly InvoiceTimeReportSummaryRow[]): InvoiceTimeReportSummaryRow[] {
    const filled = trimTrailingEmptySummarySlots(rows);
    const groups = new Map<string, InvoiceTimeReportSummaryRow[]>();
    for (const row of filled) {
        const key = summaryPersonKey(row);
        const list = groups.get(key);
        if (list)
            list.push(row);
        else
            groups.set(key, [row]);
    }
    const people = [...groups.values()].sort((a, b) => compareTimeReportSummaryRows(
        representativeSummaryRow(a),
        representativeSummaryRow(b),
    ));
    const sorted = people.flatMap((person) => [...person].sort(compareTimeReportSummaryRows));
    return padSummaryRows(sorted);
}

function representativeSummaryRow(rows: readonly InvoiceTimeReportSummaryRow[]): InvoiceTimeReportSummaryRow {
    return [...rows].sort(compareTimeReportSummaryRows)[0]!;
}

function compareTimeReportSummaryRows(a: InvoiceTimeReportSummaryRow, b: InvoiceTimeReportSummaryRow): number {
    const aBlank = summaryTitleIsBlank(a.title);
    const bBlank = summaryTitleIsBlank(b.title);
    if (aBlank !== bBlank)
        return aBlank ? 1 : -1;
    if (!aBlank) {
        const aTitle = normalizeReportEmployeePositionLabel(a.title) || a.title;
        const bTitle = normalizeReportEmployeePositionLabel(b.title) || b.title;
        const byTitle = compareReportPositionTitles(aTitle, bTitle);
        if (byTitle !== 0)
            return byTitle;
    }
    const rateDiff = parseTimeReportAmountDisplay(b.hourlyRate) - parseTimeReportAmountDisplay(a.hourlyRate);
    if (rateDiff !== 0)
        return rateDiff;
    const amountDiff = parseTimeReportAmountDisplay(b.totalPrice) - parseTimeReportAmountDisplay(a.totalPrice);
    if (amountDiff !== 0)
        return amountDiff;
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
}

function withSummaryOrderedBySeniority(pack: InvoiceTimeReportPack): InvoiceTimeReportPack {
    const summarySlots = orderTimeReportSummarySlots(pack.summarySlots);
    return { ...pack, summarySlots };
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
