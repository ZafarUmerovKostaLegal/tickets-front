import type { Borders, Color, Fill, Font } from 'exceljs';
import { exportReportSnapshot, type ReportSnapshot, type ReportSnapshotRow } from '../api';
import { getSnapshotRowDisplayData } from './reportSnapshotOverrides';
import { loadExcelJS } from '@shared/lib/exceljsLoader';

const FILL_HEADER: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } as Color };
const C_BLACK = { argb: 'FF000000' } as Color;

/** Отображение чисел как на эталоне: пробел тысячи, запятая — десятичный разделитель. */
function fmtRuNum(n: number, fracDigits = 2): string {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: fracDigits,
        maximumFractionDigits: fracDigits,
    }).format(n).replace(/\u202f|\u00a0/g, ' ');
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

function fontCell(opts: Partial<Font> = {}): Partial<Font> {
    return { name: 'Calibri', size: 11, ...opts };
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

/** Инициалы для колонки «имя»: как в списке пользователей тайм-трекинга (первое + последнее слово). */
function initialsFromDisplayName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '';
    if (parts.length === 1)
        return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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

/** Строки снимка: из GET или из JSON-экспорта `/snapshots/:id/export?format=json`, если в теле GET нет rows. */
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
        /* не JSON или ошибка сети */
    }
    return [];
}

/** Только JSON-экспорт снимка (когда GET вернул строки-заглушки без полезной нагрузки). */
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
        /* не JSON или ошибка сети */
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

/** Строки времени как в предпросмотре — если снимок без строк, подставляются из отчёта API. */
export type PartnerConfirmedExcelFallbackRow = {
    rowKind: 'entry' | 'aggregate';
    workDate: string;
    employeeName: string;
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
        const hours = pickBillableHoursNum(d) ?? 0;
        if (hours <= 1e-9)
            continue;
        const rate = pickNum(d, 'billableRate', 'billable_rate') ?? 0;
        let amount = pickNum(d, 'amountToPay', 'amount_to_pay', 'billable_amount', 'billableAmount') ?? 0;
        if (amount <= 1e-9 && rate > 0)
            amount = Math.round(hours * rate * 100) / 100;

        const wd = pickWorkDateStr(d);
        const authId = pickNum(d, 'authUserId', 'auth_user_id');
        const personKey = authId != null && authId > 0 ? `id:${Math.round(authId)}` : `n:${fullName.toLowerCase()}`;

        details.push({
            dateStr: fmtDateDdMmYyyy(wd),
            initials: initialsFromDisplayName(fullName),
            task: pickStr(d, 'taskName', 'task_name'),
            notes: pickStr(d, 'note', 'notes', 'description'),
            hours,
            rate,
            amount,
            sortKey: `${wd}\u0000${fullName}\u0000${pickStr(d, 'timeEntryId', 'time_entry_id')}`,
            personKey,
            fullName,
            title: pickStr(d, 'employeePosition', 'employee_position'),
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
        const hours = row.billableHours;
        if (hours <= 1e-9)
            continue;
        const rate = row.billableRate;
        let amount = row.amountToPay;
        if (amount <= 1e-9 && rate > 0)
            amount = Math.round(hours * rate * 100) / 100;
        const fullName = row.employeeName.trim();
        const wd = row.workDate.trim().slice(0, 10);
        const personKey = row.authUserId > 0 ? `id:${row.authUserId}` : `n:${fullName.toLowerCase()}`;
        details.push({
            dateStr: fmtDateDdMmYyyy(wd),
            initials: initialsFromDisplayName(fullName),
            task: row.taskName.trim(),
            notes: row.note.trim(),
            hours,
            rate,
            amount,
            sortKey: `${wd}\u0000${fullName}\u0000${row.timeEntryId}`,
            personKey,
            fullName,
            title: row.employeePosition.trim(),
        });
    }
    details.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return details;
}

export type PartnerConfirmedSnapshotExcelResult = {
    blob: Blob;
    filename: string;
};

/** Excel подтверждённого снимка: две таблицы в формате как на эталонном скриншоте партнёра. */
export async function buildPartnerConfirmedSnapshotExcel(snapshot: ReportSnapshot, opts?: {
    /** Уже загруженные строки (из GET + при необходимости JSON export), чтобы не дублировать запросы. */
    snapshotRows?: ReportSnapshotRow[];
    fallbackTimeRows?: PartnerConfirmedExcelFallbackRow[];
}): Promise<PartnerConfirmedSnapshotExcelResult> {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('Report', {
        views: [{ showGridLines: true }],
    });

    const rawRows = opts?.snapshotRows != null
        ? [...opts.snapshotRows].sort((a, b) => a.sortOrder - b.sortOrder)
        : await loadSnapshotRowsForPartnerExcel(snapshot.id, snapshot);
    let details = buildDetailLinesFromSnapshotRows(rawRows);
    if (details.length === 0 && rawRows.length > 0) {
        const jsonRows = await loadSnapshotRowsFromJsonExport(snapshot.id);
        if (jsonRows.length > 0)
            details = buildDetailLinesFromSnapshotRows(jsonRows);
    }
    if (details.length === 0 && opts?.fallbackTimeRows?.length)
        details = detailLinesFromFallback(opts.fallbackTimeRows);

    const T1_HEADERS = ['Date', 'First Name', 'Task', 'Notes', 'Hours', 'Rate', 'Amount'];
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

    for (const line of details) {
        r++;
        const row = ws.getRow(r);
        const vals: string[] = [
            line.dateStr,
            line.initials,
            line.task,
            line.notes,
            fmtRuNum(line.hours),
            fmtRuNum(line.rate),
            fmtRuNum(line.amount),
        ];
        for (let i = 0; i < vals.length; i++) {
            const c = row.getCell(i + 1);
            c.value = vals[i];
            c.font = fontCell();
            if (i === 0 || i === 1 || i === 2 || i === 3) {
                c.alignment = { vertical: 'top', horizontal: 'left', wrapText: i === 3 };
            }
            else {
                c.alignment = { vertical: 'middle', horizontal: 'right' };
            }
        }
    }

    const totalHours = details.reduce((s, x) => s + x.hours, 0);
    const totalAmount = details.reduce((s, x) => s + x.amount, 0);

    r++;
    const totalRow = ws.getRow(r);
    totalRow.getCell(1).value = 'Total';
    totalRow.getCell(1).font = fontCell({ bold: true });
    totalRow.getCell(1).fill = solidHeader();
    totalRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    const sumHoursCell = totalRow.getCell(5);
    sumHoursCell.value = fmtRuNum(totalHours);
    sumHoursCell.font = fontCell({ bold: true });
    sumHoursCell.fill = solidHeader();
    sumHoursCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const sumAmtCell = totalRow.getCell(7);
    sumAmtCell.value = fmtRuNum(totalAmount);
    sumAmtCell.font = fontCell({ bold: true });
    sumAmtCell.fill = solidHeader();
    sumAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: T1_HEADERS.length },
    };

    ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

    ws.columns = [
        { width: 12 },
        { width: 11 },
        { width: 22 },
        { width: 44 },
        { width: 10 },
        { width: 14 },
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
            if (!cur.title && line.title)
                cur.title = line.title;
            if (!cur.name && line.fullName)
                cur.name = line.fullName;
        }
    }

    const summary: SummaryLine[] = [...byPerson.values()].map((p) => ({
        initials: p.initials,
        name: p.name,
        title: p.title,
        hours: Math.round(p.hours * 100) / 100,
        rateLabel: p.hours > 1e-9 ? Math.round((p.amount / p.hours) * 100) / 100 : 0,
        amount: Math.round(p.amount * 100) / 100,
    }));
    summary.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

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

    for (const s of summary) {
        r++;
        const row = ws.getRow(r);
        const cells: string[] = [
            s.initials,
            s.name,
            s.title,
            fmtRuNum(s.hours),
            fmtRuNum(s.rateLabel),
            fmtRuNum(s.amount),
        ];
        for (let i = 0; i < cells.length; i++) {
            const c = row.getCell(i + 1);
            c.value = cells[i];
            c.font = fontCell();
            c.border = thinBlackBorder();
            if (i < 3)
                c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: i === 1 };
            else {
                c.alignment = { vertical: 'middle', horizontal: 'right' };
            }
        }
    }

    const t2TotalRowIdx = r + 1;
    const t2HoursSum = summary.reduce((a, x) => a + x.hours, 0);
    const t2AmtSum = summary.reduce((a, x) => a + x.amount, 0);
    const tr = ws.getRow(t2TotalRowIdx);
    for (let col = 1; col <= 6; col++) {
        tr.getCell(col).border = thinBlackBorder();
    }
    tr.getCell(4).value = fmtRuNum(t2HoursSum);
    tr.getCell(4).font = fontCell({ bold: true });
    tr.getCell(4).fill = solidHeader();
    tr.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

    tr.getCell(6).value = fmtRuNum(t2AmtSum);
    tr.getCell(6).font = fontCell({ bold: true });
    tr.getCell(6).fill = solidHeader();
    tr.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const base = snapshot.name.trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
    const filename = `${base || `confirmed-snapshot-${snapshot.id}`}.xlsx`;
    return { blob, filename };
}
