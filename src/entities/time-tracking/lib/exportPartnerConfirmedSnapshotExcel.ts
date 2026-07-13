import type { Borders, Cell, Color, Fill, Font } from 'exceljs';
import { exportReportSnapshot, type ReportSnapshot, type ReportSnapshotRow } from '../api';
import { getSnapshotRowDisplayData } from './reportSnapshotOverrides';
import { resolveReportEmployeeInitials } from './reportEmployeeInitials';
import { resolveReportEmployeePosition } from './reportEmployeePosition';
import { loadExcelJS, writeExcelWorkbookBuffer, excelWorkbookBufferToBlob } from '@shared/lib/exceljsLoader';

const FILL_HEADER: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } as Color };
const FILL_POSITION_RATE_HEADER: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9B1B30' } as Color };
const FILL_RATE_PER_HOUR_HEADER: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } as Color };
const C_BLACK = { argb: 'FF000000' } as Color;
const C_WHITE = { argb: 'FFFFFFFF' } as Color;

const EXCEL_NUM_FMT_2 = '#,##0.00';

function excelNum2(n: number): number {
    if (!Number.isFinite(n))
        return 0;
    return Math.round(n * 100) / 100;
}

function consistentExcelMoneyLine(hoursRaw: number, rateRaw: number): { hours: number; rate: number; amount: number } {
    const hours = excelNum2(hoursRaw);
    const rate = excelNum2(rateRaw);
    return {
        hours,
        rate,
        amount: excelNum2(hours * rate),
    };
}

function applyExcelNum2Cell(cell: Cell, n: number, opts?: { bold?: boolean; fill?: Fill }): void {
    cell.value = excelNum2(n);
    cell.numFmt = EXCEL_NUM_FMT_2;
    cell.alignment = { vertical: 'middle', horizontal: 'right' };
    cell.font = fontCell({ bold: Boolean(opts?.bold) });
    if (opts?.fill)
        cell.fill = opts.fill;
}

function applyExcelProductFormula(
    cell: Cell,
    hoursCol: string,
    rateCol: string,
    rowNum: number,
    opts?: { bold?: boolean; fill?: Fill; border?: Partial<Borders> },
): void {
    cell.value = { formula: `${hoursCol}${rowNum}*${rateCol}${rowNum}` };
    cell.numFmt = EXCEL_NUM_FMT_2;
    cell.alignment = { vertical: 'middle', horizontal: 'right' };
    cell.font = fontCell({ bold: Boolean(opts?.bold) });
    if (opts?.fill)
        cell.fill = opts.fill;
    if (opts?.border)
        cell.border = opts.border;
}

function applyExcelSumFormula(
    cell: Cell,
    col: string,
    fromRow: number,
    toRow: number,
    opts?: { bold?: boolean; fill?: Fill; border?: Partial<Borders> },
): void {
    cell.value = fromRow <= toRow
        ? { formula: `SUM(${col}${fromRow}:${col}${toRow})` }
        : 0;
    cell.numFmt = EXCEL_NUM_FMT_2;
    cell.alignment = { vertical: 'middle', horizontal: 'right' };
    cell.font = fontCell({ bold: Boolean(opts?.bold) });
    if (opts?.fill)
        cell.fill = opts.fill;
    if (opts?.border)
        cell.border = opts.border;
}

function solidHeader(): Fill {
    return FILL_HEADER;
}

function thinBlackBorder(): Partial<Borders> {
    const style = 'thin' as const;
    const color = C_BLACK;
    return {
        top: { style, color },
        bottom: { style, color },
        left: { style, color },
        right: { style, color },
    };
}

function dottedRowBorder(): Partial<Borders> {
    return {
        bottom: { style: 'dotted', color: C_BLACK },
    };
}

function fontCellWhite(opts: Partial<Font> = {}): Partial<Font> {
    return { name: 'Calibri', size: 11, color: C_WHITE, ...opts };
}

export type PartnerConfirmedExcelPositionRateRow = {
    position: string;
    rate: number;
};

function normalizePositionRateTableLabel(title: string): string {
    return title.trim().replace(/\s+as of\s+.+/i, '').trim();
}

function buildPositionRateRowsFromDetails(details: DetailLine[]): PartnerConfirmedExcelPositionRateRow[] {
    const map = new Map<string, number>();
    for (const line of details) {
        const position = normalizePositionRateTableLabel(line.title);
        const rate = excelNum2(line.rate);
        if (!position || rate <= 0)
            continue;
        const prev = map.get(position);
        if (prev == null || rate > prev)
            map.set(position, rate);
    }
    return [...map.entries()]
        .map(([position, rate]) => ({ position, rate }))
        .sort((a, b) => {
            const ra = positionHierarchyRank(a.position);
            const rb = positionHierarchyRank(b.position);
            if (ra !== rb)
                return ra - rb;
            return a.position.localeCompare(b.position, 'en', { sensitivity: 'base' });
        });
}

function writePositionRateTable(
    ws: import('exceljs').Worksheet,
    startRow: number,
    rows: PartnerConfirmedExcelPositionRateRow[],
    currency = 'USD',
): number {
    if (rows.length === 0)
        return startRow;
    let r = startRow;
    const header = ws.getRow(r);
    const posHead = header.getCell(1);
    posHead.value = 'Position';
    posHead.font = fontCellWhite({ bold: true });
    posHead.fill = FILL_POSITION_RATE_HEADER;
    posHead.alignment = { vertical: 'middle', horizontal: 'left' };
    posHead.border = thinBlackBorder();
    const rateHead = header.getCell(2);
    rateHead.value = `Rate Per Hour (${currency.trim() || 'USD'})`;
    rateHead.font = fontCellWhite({ bold: true });
    rateHead.fill = FILL_RATE_PER_HOUR_HEADER;
    rateHead.alignment = { vertical: 'middle', horizontal: 'right' };
    rateHead.border = thinBlackBorder();
    header.height = 18;

    for (const row of rows) {
        r++;
        const data = ws.getRow(r);
        data.height = 18;
        const posCell = data.getCell(1);
        posCell.value = row.position;
        posCell.font = fontCell();
        posCell.alignment = { vertical: 'middle', horizontal: 'left' };
        posCell.border = dottedRowBorder();
        const rateCell = data.getCell(2);
        applyExcelNum2Cell(rateCell, row.rate);
        rateCell.border = dottedRowBorder();
    }
    return r;
}

function writeInvoiceFooterSection(
    ws: import('exceljs').Worksheet,
    startRow: number,
    totalForInvoice: number,
): number {
    let r = startRow + 2;
    const reimbRow = ws.getRow(r);
    ws.mergeCells(r, 1, r, 2);
    const reimbCell = reimbRow.getCell(1);
    reimbCell.value = 'Reimbursable expenses';
    reimbCell.font = fontCell({ bold: true });
    reimbCell.alignment = { vertical: 'middle', horizontal: 'center' };
    reimbCell.border = thinBlackBorder();

    r++;
    const totalRow = ws.getRow(r);
    ws.mergeCells(r, 1, r, 5);
    const totalLabel = totalRow.getCell(1);
    totalLabel.value = 'TOTAL FOR INVOICE';
    totalLabel.font = fontCell({ bold: true });
    totalLabel.alignment = { vertical: 'middle', horizontal: 'right' };
    totalLabel.border = thinBlackBorder();
    const totalValue = totalRow.getCell(6);
    applyExcelNum2Cell(totalValue, totalForInvoice, { bold: true });
    totalValue.border = thinBlackBorder();
    return r;
}

function fontCell(opts: Partial<Font> = {}): Partial<Font> {
    return { name: 'Calibri', size: 11, ...opts };
}

const EXCEL_POSITION_HIERARCHY: readonly string[] = [
    'Partner',
    'Counsel',
    'Senior Associate',
    'Associate Level II',
    'Associate Level I',
    'Associate',
    'Contracts Manager',
    'Junior Associate',
    'Trainee',
];

function positionHierarchyRank(title: string): number {
    const t = title.trim().toLowerCase();
    if (!t)
        return 9999;
    const exact = EXCEL_POSITION_HIERARCHY.findIndex((p) => p.toLowerCase() === t);
    if (exact >= 0)
        return exact;
    if (t.includes('partner'))
        return 0;
    if (t.includes('senior') && t.includes('associate'))
        return 2;
    if (t.includes('associate level ii') || (t.includes('level ii') && t.includes('associate')))
        return 3;
    if (t.includes('associate level i') || (t.includes('level i') && t.includes('associate')))
        return 4;
    if (t.includes('junior') && t.includes('associate'))
        return 7;
    if (t.includes('counsel'))
        return 1;
    if (t.includes('associate'))
        return 5;
    if (t.includes('contracts'))
        return 6;
    if (t.includes('trainee'))
        return 8;
    return 5000;
}

function compareSummaryByHierarchy(
    a: { name: string; title: string },
    b: { name: string; title: string },
): number {
    const ra = positionHierarchyRank(a.title);
    const rb = positionHierarchyRank(b.title);
    if (ra !== rb)
        return ra - rb;
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
}

function pickStr(d: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const v = d[k];
        if (v == null)
            continue;
        const s = String(v).trim();
        if (s)
            return s;
    }
    return '';
}

function pickNum(d: Record<string, unknown>, ...keys: string[]): number | null {
    for (const k of keys) {
        const v = d[k];
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
        if (typeof v === 'string' && v.trim()) {
            const n = Number(v.replace(/\s/g, '').replace(',', '.'));
            if (Number.isFinite(n))
                return n;
        }
    }
    return null;
}

function pickBool(d: Record<string, unknown>, ...keys: string[]): boolean {
    for (const k of keys) {
        const v = d[k];
        if (v === true)
            return true;
        if (v === false || v == null)
            continue;
        const s = String(v).trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes')
            return true;
    }
    return false;
}

function fmtDateDdMmYyyy(iso: string): string {
    const s = iso.trim().slice(0, 10);
    if (!s)
        return '';
    const [y, m, d] = s.split('-');
    if (!y || !m || !d)
        return s;
    return `${d}.${m}.${y}`;
}

function coerceUnknownToSnapshotRow(raw: unknown, index: number): ReportSnapshotRow | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const o = raw as Record<string, unknown>;
    const id = String(o.id ?? o.rowId ?? `row-${index}`);
    const sortOrder = typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder)
        ? o.sortOrder
        : typeof o.sort_order === 'number' && Number.isFinite(o.sort_order)
            ? o.sort_order
            : index;
    const sourceType = String(o.sourceType ?? o.source_type ?? 'time_entry');
    const sourceId = String(o.sourceId ?? o.source_id ?? id);
    let data: Record<string, unknown>;
    if (o.data && typeof o.data === 'object' && !Array.isArray(o.data))
        data = o.data as Record<string, unknown>;
    else if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields))
        data = o.fields as Record<string, unknown>;
    else {
        const skip = new Set([
            'id', 'rowId', 'sortOrder', 'sort_order', 'sourceType', 'source_type', 'sourceId', 'source_id',
            'effective', 'overrides', 'editedByUserId', 'edited_by_user_id', 'editedAt', 'edited_at',
        ]);
        data = {};
        for (const [k, v] of Object.entries(o)) {
            if (!skip.has(k))
                data[k] = v;
        }
        if (Object.keys(data).length === 0)
            data = { ...o } as Record<string, unknown>;
    }
    const effRaw = o.effective;
    const effective = effRaw && typeof effRaw === 'object' && !Array.isArray(effRaw)
        ? effRaw as Record<string, unknown>
        : undefined;
    const overridesRaw = o.overrides;
    const overrides = overridesRaw && typeof overridesRaw === 'object' && !Array.isArray(overridesRaw)
        ? overridesRaw as Record<string, unknown>
        : null;
    const editedBy = o.editedByUserId ?? o.edited_by_user_id;
    const editedByUserId = typeof editedBy === 'number' && Number.isFinite(editedBy)
        ? editedBy
        : null;
    const editedRaw = o.editedAt ?? o.edited_at;
    const editedAt = editedRaw != null && editedRaw !== '' ? String(editedRaw) : null;
    return {
        id,
        sortOrder,
        sourceType,
        sourceId,
        data,
        effective,
        overrides,
        editedByUserId,
        editedAt,
    };
}

function normalizeExportJsonToSnapshotRows(parsed: unknown): ReportSnapshotRow[] {
    if (Array.isArray(parsed))
        return parsed.map((r, i) => coerceUnknownToSnapshotRow(r, i)).filter((x): x is ReportSnapshotRow => x != null);
    if (!parsed || typeof parsed !== 'object')
        return [];
    const root = parsed as Record<string, unknown>;
    const nested = root.rows
        ?? root.snapshotRows
        ?? (root.snapshot as Record<string, unknown> | undefined)?.rows
        ?? (root.data as Record<string, unknown> | undefined)?.rows
        ?? (root.payload as Record<string, unknown> | undefined)?.rows
        ?? (root.result as Record<string, unknown> | undefined)?.rows
        ?? root.items;
    if (Array.isArray(nested))
        return nested.map((r, i) => coerceUnknownToSnapshotRow(r, i)).filter((x): x is ReportSnapshotRow => x != null);
    return [];
}

export async function loadSnapshotRowsForPartnerExcel(snapshotId: string, snapshot: ReportSnapshot): Promise<ReportSnapshotRow[]> {
    const sid = snapshotId.trim();
    if (!sid)
        return [];
    if (Array.isArray(snapshot.rows) && snapshot.rows.length > 0)
        return [...snapshot.rows].sort((a, b) => a.sortOrder - b.sortOrder);
    try {
        const { blob } = await exportReportSnapshot(sid, 'json');
        const text = await blob.text();
        const parsed = JSON.parse(text) as unknown;
        const normalized = normalizeExportJsonToSnapshotRows(parsed);
        if (normalized.length > 0)
            return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    catch {

    }
    return [];
}

async function loadSnapshotRowsFromJsonExport(snapshotId: string): Promise<ReportSnapshotRow[]> {
    const sid = snapshotId.trim();
    if (!sid)
        return [];
    try {
        const { blob } = await exportReportSnapshot(sid, 'json');
        const text = await blob.text();
        const parsed = JSON.parse(text) as unknown;
        const normalized = normalizeExportJsonToSnapshotRows(parsed);
        if (normalized.length > 0)
            return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    catch {

    }
    return [];
}

function pickWorkDateStr(d: Record<string, unknown>): string {
    let wd = pickStr(d, 'workDate', 'work_date');
    if (!wd) {
        const rec = pickStr(d, 'recordedAt', 'recorded_at');
        wd = rec.trim().slice(0, 10);
    }
    return wd.trim().slice(0, 10);
}

function pickBillableHoursNum(d: Record<string, unknown>): number | null {
    return pickNum(d,
        'billableHours',
        'billable_hours',
        'hours',
        'durationHours',
        'duration_hours',
        'totalHours',
        'total_hours',
        'quantity',
    );
}

function isIncludedEntryRow(sr: ReportSnapshotRow, d: Record<string, unknown>): boolean {
    if (pickBool(d, 'isVoided', 'is_voided'))
        return false;
    const rk = pickStr(d, 'rowKind', 'row_kind').toLowerCase();
    if (rk === 'aggregate')
        return false;
    const st = sr.sourceType.trim().toLowerCase();
    if (st.includes('aggregate') || st.includes('rollup') || st.includes('summary'))
        return false;
    if (rk === 'entry')
        return true;
    const wd = pickWorkDateStr(d);
    const hours = pickBillableHoursNum(d);
    const te = pickStr(d, 'timeEntryId', 'time_entry_id');
    if (te && hours != null && hours > 1e-9)
        return true;
    if (wd && hours != null && hours > 1e-9)
        return true;
    return false;
}

type DetailLine = {
    dateStr: string;
    initials: string;
    task: string;
    notes: string;
    hours: number;
    rate: number;
    amount: number;
    sortKey: string;
    personKey: string;
    fullName: string;
    title: string;
};

export type PartnerConfirmedExcelFallbackRow = {
    rowKind: 'entry' | 'aggregate';
    workDate: string;
    employeeName: string;
    employeeInitials: string;
    employeePosition: string;
    authUserId: number;
    taskName: string;
    note: string;
    billableHours: number;
    billableRate: number;
    amountToPay: number;
    isVoided: boolean;
    timeEntryId: string;
};

function buildDetailLinesFromSnapshotRows(rawRows: ReportSnapshotRow[]): DetailLine[] {
    const details: DetailLine[] = [];
    for (const sr of rawRows) {
        const d = getSnapshotRowDisplayData(sr);
        if (!isIncludedEntryRow(sr, d))
            continue;
        const fullName = pickStr(d, 'employeeName', 'employee_name');
        const initialsRaw = pickStr(d, 'employeeInitials', 'employee_initials');
        const hoursRaw = pickBillableHoursNum(d) ?? 0;
        if (hoursRaw <= 1e-9)
            continue;
        const rateRaw = pickNum(d, 'billableRate', 'billable_rate') ?? 0;
        const { hours, rate, amount } = consistentExcelMoneyLine(hoursRaw, rateRaw);

        const wd = pickWorkDateStr(d);
        const authId = pickNum(d, 'authUserId', 'auth_user_id');
        const personKey = authId != null && authId > 0 ? `id:${Math.round(authId)}` : `n:${fullName.toLowerCase()}`;

        details.push({
            dateStr: fmtDateDdMmYyyy(wd),
            initials: resolveReportEmployeeInitials({ stored: initialsRaw, displayName: fullName }),
            task: pickStr(d, 'taskName', 'task_name'),
            notes: pickStr(d, 'note', 'notes', 'description'),
            hours,
            rate,
            amount,
            sortKey: `${wd}\u0000${fullName}\u0000${pickStr(d, 'timeEntryId', 'time_entry_id')}`,
            personKey,
            fullName,
            title: resolveReportEmployeePosition({
                entryPosition: pickStr(d, 'employeePosition', 'employee_position'),
            }),
        });
    }
    details.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return details;
}

function detailLinesFromFallback(fr: PartnerConfirmedExcelFallbackRow[]): DetailLine[] {
    const details: DetailLine[] = [];
    for (const row of fr) {
        if (row.rowKind !== 'entry' || row.isVoided)
            continue;
        const hoursRaw = row.billableHours;
        if (hoursRaw <= 1e-9)
            continue;
        const { hours, rate, amount } = consistentExcelMoneyLine(hoursRaw, row.billableRate);
        const fullName = row.employeeName.trim();
        const wd = row.workDate.trim().slice(0, 10);
        const personKey = row.authUserId > 0 ? `id:${row.authUserId}` : `n:${fullName.toLowerCase()}`;
        details.push({
            dateStr: fmtDateDdMmYyyy(wd),
            initials: resolveReportEmployeeInitials({
                stored: row.employeeInitials,
                displayName: fullName,
            }),
            task: row.taskName.trim(),
            notes: row.note.trim(),
            hours,
            rate,
            amount,
            sortKey: `${wd}\u0000${fullName}\u0000${row.timeEntryId}`,
            personKey,
            fullName,
            title: resolveReportEmployeePosition({ entryPosition: row.employeePosition }),
        });
    }
    details.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return details;
}

export type PartnerConfirmedSnapshotExcelResult = {
    blob: Blob;
    filename: string;
};

export async function buildPartnerConfirmedSnapshotExcel(snapshot: ReportSnapshot, opts?: {

    snapshotRows?: ReportSnapshotRow[];
    fallbackTimeRows?: PartnerConfirmedExcelFallbackRow[];

    preferPageRows?: boolean;
    positionRateRows?: PartnerConfirmedExcelPositionRateRow[];
    totalForInvoiceAmount?: number;
    currency?: string;
    downloadFilename?: string;
}): Promise<PartnerConfirmedSnapshotExcelResult> {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Report', {
        views: [{ showGridLines: true }],
    });

    let details: DetailLine[];
    if (opts?.preferPageRows && opts.fallbackTimeRows) {
        details = detailLinesFromFallback(opts.fallbackTimeRows);
    }
    else {
        const rawRows = opts?.snapshotRows != null
            ? [...opts.snapshotRows].sort((a, b) => a.sortOrder - b.sortOrder)
            : await loadSnapshotRowsForPartnerExcel(snapshot.id, snapshot);
        details = buildDetailLinesFromSnapshotRows(rawRows);
        if (details.length === 0 && rawRows.length > 0) {
            const jsonRows = await loadSnapshotRowsFromJsonExport(snapshot.id);
            if (jsonRows.length > 0)
                details = buildDetailLinesFromSnapshotRows(jsonRows);
        }
        if (details.length === 0 && opts?.fallbackTimeRows?.length)
            details = detailLinesFromFallback(opts.fallbackTimeRows);
    }

    const T1_HEADERS = ['Date', 'First Name', 'Task', 'Notes', 'Hours', 'Rate', 'Amount'];

    const T1_FORMULA_COL = 9;
    const T1_FORMULA_COL_LETTER = 'I';
    let r = 1;
    const headerRow = ws.getRow(r);
    T1_HEADERS.forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        c.font = fontCell({ bold: true });
        c.fill = solidHeader();
        c.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'right' : 'left', wrapText: i === 3 };
    });
    headerRow.height = 18;

    const t1DataFirstRow = r + 1;
    for (const line of details) {
        r++;
        const row = ws.getRow(r);
        const textVals = [line.dateStr, line.initials, line.task, line.notes];
        for (let i = 0; i < textVals.length; i++) {
            const c = row.getCell(i + 1);
            c.value = textVals[i];
            c.font = fontCell();
            c.alignment = { vertical: 'top', horizontal: 'left', wrapText: i === 3 };
        }
        applyExcelNum2Cell(row.getCell(5), line.hours);
        applyExcelNum2Cell(row.getCell(6), line.rate);
        applyExcelNum2Cell(row.getCell(7), line.amount);
        applyExcelProductFormula(row.getCell(T1_FORMULA_COL), 'E', 'F', r);
    }
    const t1DataLastRow = r;

    r++;
    const totalRow = ws.getRow(r);
    totalRow.getCell(1).value = 'Total';
    totalRow.getCell(1).font = fontCell({ bold: true });
    totalRow.getCell(1).fill = solidHeader();
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const totalFill = solidHeader();
    if (t1DataLastRow >= t1DataFirstRow) {
        applyExcelSumFormula(totalRow.getCell(5), 'E', t1DataFirstRow, t1DataLastRow, { bold: true, fill: totalFill });
        applyExcelSumFormula(totalRow.getCell(7), 'G', t1DataFirstRow, t1DataLastRow, { bold: true, fill: totalFill });
        applyExcelSumFormula(totalRow.getCell(T1_FORMULA_COL), T1_FORMULA_COL_LETTER, t1DataFirstRow, t1DataLastRow, { bold: true, fill: totalFill });
    }
    else {
        applyExcelNum2Cell(totalRow.getCell(5), 0, { bold: true, fill: totalFill });
        applyExcelNum2Cell(totalRow.getCell(7), 0, { bold: true, fill: totalFill });
        applyExcelNum2Cell(totalRow.getCell(T1_FORMULA_COL), 0, { bold: true, fill: totalFill });
    }

    ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: T1_HEADERS.length },
    };

    ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

    ws.columns = [
        { width: 12 },
        { width: 32 },
        { width: 24 },
        { width: 44 },
        { width: 10 },
        { width: 14 },
        { width: 18 },
        { width: 4 },
        { width: 18 },
    ];

    const gapRows = 3;
    const t2HeaderRowIdx = r + gapRows + 1;

    type SummaryLine = {
        initials: string;
        name: string;
        title: string;
        hours: number;
        rateLabel: number;
        amount: number;
    };

    const byPerson = new Map<string, {
        initials: string;
        name: string;
        title: string;
        hours: number;
        amount: number;
    }>();

    for (const line of details) {
        const cur = byPerson.get(line.personKey);
        if (!cur) {
            byPerson.set(line.personKey, {
                initials: line.initials,
                name: line.fullName,
                title: line.title,
                hours: line.hours,
                amount: line.amount,
            });
        }
        else {
            cur.hours += line.hours;
            cur.amount += line.amount;
            if (line.title && (!cur.title || positionHierarchyRank(line.title) < positionHierarchyRank(cur.title)))
                cur.title = line.title;
            if (!cur.name && line.fullName)
                cur.name = line.fullName;
        }
    }

    const summary: SummaryLine[] = [...byPerson.values()].map((p) => {
        const hours = excelNum2(p.hours);
        const amount = excelNum2(p.amount);
        const rateLabel = hours > 1e-9 ? excelNum2(amount / hours) : 0;
        return {
            initials: p.initials,
            name: p.name,
            title: p.title,
            hours,
            rateLabel,
            amount,
        };
    });
    summary.sort(compareSummaryByHierarchy);

    r = t2HeaderRowIdx;
    const T2_HEADERS = ['Initials', 'Name', 'Title', 'Hours', 'Rate (USD)', 'Amount'];
    const t2h = ws.getRow(r);
    T2_HEADERS.forEach((h, i) => {
        const c = t2h.getCell(i + 1);
        c.value = h;
        c.font = fontCell({ bold: true });
        c.fill = solidHeader();
        c.alignment = { vertical: 'middle', horizontal: i >= 3 ? 'right' : 'left', wrapText: false };
        c.border = thinBlackBorder();
    });
    t2h.height = 18;

    const t2DataFirstRow = r + 1;
    for (const s of summary) {
        r++;
        const row = ws.getRow(r);
        row.height = 20;
        const textCells = [s.initials, s.name, s.title];
        for (let i = 0; i < textCells.length; i++) {
            const c = row.getCell(i + 1);
            c.value = textCells[i];
            c.font = fontCell();
            c.border = thinBlackBorder();
            c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
        }
        applyExcelNum2Cell(row.getCell(4), s.hours);
        row.getCell(4).border = thinBlackBorder();
        applyExcelNum2Cell(row.getCell(5), s.rateLabel);
        row.getCell(5).border = thinBlackBorder();
        applyExcelProductFormula(row.getCell(6), 'D', 'E', r, { border: thinBlackBorder() });
    }
    const t2DataLastRow = r;

    const t2TotalRowIdx = r + 1;
    const tr = ws.getRow(t2TotalRowIdx);
    for (let col = 1; col <= 6; col++) {
        tr.getCell(col).border = thinBlackBorder();
    }
    const t2TotalFill = solidHeader();
    if (t2DataLastRow >= t2DataFirstRow) {
        applyExcelSumFormula(tr.getCell(4), 'D', t2DataFirstRow, t2DataLastRow, { bold: true, fill: t2TotalFill, border: thinBlackBorder() });
        applyExcelSumFormula(tr.getCell(6), 'F', t2DataFirstRow, t2DataLastRow, { bold: true, fill: t2TotalFill, border: thinBlackBorder() });
    }
    else {
        applyExcelNum2Cell(tr.getCell(4), 0, { bold: true, fill: t2TotalFill });
        tr.getCell(4).border = thinBlackBorder();
        applyExcelNum2Cell(tr.getCell(6), 0, { bold: true, fill: t2TotalFill });
        tr.getCell(6).border = thinBlackBorder();
    }

    const summaryTotalAmount = summary.reduce((acc, row) => acc + row.amount, 0);
    const totalForInvoice = excelNum2(opts?.totalForInvoiceAmount ?? summaryTotalAmount);
    const positionRateRows = (opts?.positionRateRows?.length
        ? opts.positionRateRows
        : buildPositionRateRowsFromDetails(details))
        .filter((row) => row.position.trim() && row.rate > 0);
    const exportCurrency = (opts?.currency ?? 'USD').trim() || 'USD';
    const positionRateHeaderRow = t2TotalRowIdx + 2;
    writePositionRateTable(ws, positionRateHeaderRow, positionRateRows, exportCurrency);
    const afterPositionRatesRow = positionRateRows.length > 0
        ? positionRateHeaderRow + positionRateRows.length
        : t2TotalRowIdx;
    writeInvoiceFooterSection(ws, afterPositionRatesRow, totalForInvoice);

    const buf = await writeExcelWorkbookBuffer(wb);
    const blob = excelWorkbookBufferToBlob(buf);
    const filename = (() => {
        const override = opts?.downloadFilename?.trim();
        if (override)
            return override;
        const base = snapshot.name.trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
        return `${base || `confirmed-snapshot-${snapshot.id}`}.xlsx`;
    })();
    return { blob, filename };
}
