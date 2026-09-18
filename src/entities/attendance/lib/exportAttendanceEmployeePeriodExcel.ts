import type { Alignment, Borders, Fill, Font, Worksheet } from 'exceljs';
import type { PeriodAttendanceItem } from '../model/dailyReportTypes';
import type { AttendanceRecord } from '../model/types';
import { loadExcelJS, writeExcelWorkbookBuffer, excelWorkbookBufferToBlob } from '@shared/lib/exceljsLoader';

export type AttendanceEmployeePeriodExportInput = {
    employeeName: string;
    dateFrom: string;
    dateTo: string;
    items: PeriodAttendanceItem[];
    /** Optional raw camera marks for sheet 2. */
    rawMarks?: AttendanceRecord[];
};

type AC = { argb: string };

const C_HEADER: AC = { argb: 'FF1E3A5F' };
const C_WHITE: AC = { argb: 'FFFFFFFF' };
const C_ROW_ODD: AC = { argb: 'FFDEEAF6' };
const C_ROW_EVEN: AC = { argb: 'FFFFFFFF' };
const C_GREEN: AC = { argb: 'FFC6EFCE' };
const C_GREEN_TEXT: AC = { argb: 'FF006100' };
const C_RED: AC = { argb: 'FFFFC7CE' };
const C_RED_TEXT: AC = { argb: 'FF9C0006' };
const C_YELLOW: AC = { argb: 'FFFFEB9C' };
const C_BORDER: AC = { argb: 'FF94A3B8' };
const C_SUMMARY: AC = { argb: 'FFF8FAFC' };

const WEEKDAY_RU = [
    'Воскресенье',
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
];

function solid(color: AC): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: color };
}

function border(): Partial<Borders> {
    const c = C_BORDER;
    return {
        top: { style: 'thin', color: c },
        bottom: { style: 'thin', color: c },
        left: { style: 'thin', color: c },
        right: { style: 'thin', color: c },
    };
}

function font(opts: Partial<Font> & { color?: AC } = {}): Partial<Font> {
    const { color, ...rest } = opts;
    return {
        name: 'Calibri',
        size: 11,
        ...rest,
        ...(color ? { color } : {}),
    };
}

function align(opts: Partial<Alignment> = {}): Partial<Alignment> {
    return { vertical: 'middle', ...opts };
}

export function fmtYmdDot(iso: string): string {
    const s = iso.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return iso;
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}

function parseYmd(iso: string): Date {
    return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

function* iterYmdInclusive(from: string, to: string): Generator<string> {
    const cur = parseYmd(from);
    const end = parseYmd(to);
    while (cur <= end) {
        yield cur.toISOString().slice(0, 10);
        cur.setDate(cur.getDate() + 1);
    }
}

function isWeekday(ymd: string): boolean {
    const dow = parseYmd(ymd).getDay();
    return dow >= 1 && dow <= 5;
}

function weekdayRu(ymd: string): string {
    return WEEKDAY_RU[parseYmd(ymd).getDay()] ?? '';
}

function formatHmFromIso(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        const m = iso.match(/T(\d{2}):(\d{2})/);
        return m ? `${m[1]}:${m[2]}` : '';
    }
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
}

function parseEventMs(iso: string | null | undefined): number | null {
    if (!iso)
        return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
}

/** Interval first→last only; empty if no last punch. */
export function formatIntervalHm(firstIso: string | null | undefined, lastIso: string | null | undefined): string {
    const a = parseEventMs(firstIso);
    const b = parseEventMs(lastIso);
    if (a == null || b == null || b <= a)
        return '';
    const totalMin = Math.floor((b - a) / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

export function intervalMinutes(firstIso: string | null | undefined, lastIso: string | null | undefined): number | null {
    const a = parseEventMs(firstIso);
    const b = parseEventMs(lastIso);
    if (a == null || b == null || b <= a)
        return null;
    return Math.floor((b - a) / 60_000);
}

function formatTotalMinutes(totalMin: number): string {
    if (!Number.isFinite(totalMin) || totalMin < 0)
        return '';
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

export type AttendanceDayExportRow = {
    date: string;
    weekday: string;
    firstMark: string;
    lastMark: string;
    interval: string;
    intervalMin: number | null;
    eventCount: number;
    uniqueCount: number;
    hasMarks: boolean;
    hasDuplicates: boolean;
};

export function buildAttendanceDayExportRows(
    dateFrom: string,
    dateTo: string,
    items: PeriodAttendanceItem[],
): AttendanceDayExportRow[] {
    const byDate = new Map<string, PeriodAttendanceItem>();
    for (const item of items) {
        const d = (item.date || '').slice(0, 10);
        if (!d)
            continue;
        const prev = byDate.get(d);
        if (!prev || (item.first_event_time && !prev.first_event_time))
            byDate.set(d, item);
    }
    const rows: AttendanceDayExportRow[] = [];
    for (const ymd of iterYmdInclusive(dateFrom, dateTo)) {
        if (!isWeekday(ymd))
            continue;
        const item = byDate.get(ymd);
        const first = item?.first_event_time ?? null;
        const last = item?.last_event_time ?? null;
        const hasMarks = Boolean(first);
        let eventCount = typeof item?.event_count === 'number' ? item.event_count : 0;
        let uniqueCount = typeof item?.unique_event_count === 'number' ? item.unique_event_count : 0;
        if (hasMarks && eventCount <= 0) {
            eventCount = last ? 2 : 1;
            uniqueCount = eventCount;
        }
        rows.push({
            date: ymd,
            weekday: weekdayRu(ymd),
            firstMark: formatHmFromIso(first),
            lastMark: formatHmFromIso(last),
            interval: formatIntervalHm(first, last),
            intervalMin: intervalMinutes(first, last),
            eventCount,
            uniqueCount,
            hasMarks,
            hasDuplicates: uniqueCount > 0 && eventCount > uniqueCount,
        });
    }
    return rows;
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function styleHeaderRow(ws: Worksheet, rowIndex: number, colCount: number): void {
    const row = ws.getRow(rowIndex);
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = solid(C_HEADER);
        cell.font = font({ bold: true, color: C_WHITE, size: 11 });
        cell.alignment = align({ horizontal: 'center', wrapText: true });
        cell.border = border();
    }
    row.height = 22;
}

export async function exportAttendanceEmployeePeriodExcel(
    input: AttendanceEmployeePeriodExportInput,
): Promise<void> {
    const name = (input.employeeName || 'Сотрудник').trim() || 'Сотрудник';
    const rows = buildAttendanceDayExportRows(input.dateFrom, input.dateTo, input.items);
    const workdays = rows.length;
    const withMarks = rows.filter((r) => r.hasMarks).length;
    const withoutMarks = workdays - withMarks;
    const intervals = rows.map((r) => r.intervalMin).filter((n): n is number => n != null);
    const totalIntervalMin = intervals.reduce((s, n) => s + n, 0);
    const avgIntervalMin = intervals.length > 0 ? Math.round(totalIntervalMin / intervals.length) : 0;
    const daysWithDupes = rows.filter((r) => r.hasDuplicates).length;

    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();

    const ws = wb.addWorksheet('Посещаемость', {
        views: [{ state: 'frozen', ySplit: 5 }],
    });
    ws.columns = [
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 18 },
        { width: 12 },
        { width: 14 },
        { width: 12 },
        { width: 14 },
    ];

    ws.mergeCells(1, 1, 1, 8);
    const title = ws.getCell(1, 1);
    title.value = `Таблица посещаемости — ${name}`;
    title.font = font({ bold: true, size: 14 });
    title.alignment = align({ horizontal: 'center' });

    ws.mergeCells(3, 1, 3, 8);
    const summary = ws.getCell(3, 1);
    summary.value = [
        `Период: ${fmtYmdDot(input.dateFrom)}–${fmtYmdDot(input.dateTo)}`,
        `Будних дней: ${workdays}`,
        `Дней с отметками: ${withMarks}`,
        `Без отметок: ${withoutMarks}`,
    ].join('    ');
    summary.font = font({ size: 11 });
    summary.fill = solid(C_SUMMARY);
    summary.alignment = align({ horizontal: 'left' });

    const headerRow = 5;
    const headers = [
        'Дата',
        'День недели',
        'Первая отметка',
        'Последняя отметка',
        'Интервал',
        'Всего отметок',
        'Уникальных',
        'Статус',
    ];
    headers.forEach((h, i) => {
        ws.getCell(headerRow, i + 1).value = h;
    });
    styleHeaderRow(ws, headerRow, 8);

    rows.forEach((r, idx) => {
        const rowIdx = headerRow + 1 + idx;
        const excelRow = ws.getRow(rowIdx);
        const values = [
            fmtYmdDot(r.date),
            r.weekday,
            r.firstMark,
            r.lastMark,
            r.interval,
            r.eventCount,
            r.uniqueCount,
            r.hasMarks ? 'Есть отметки' : 'Нет отметок',
        ];
        values.forEach((v, i) => {
            const cell = excelRow.getCell(i + 1);
            cell.value = v;
            cell.border = border();
            cell.alignment = align({ horizontal: i === 1 || i === 7 ? 'left' : 'center' });
            cell.fill = solid(idx % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN);
            cell.font = font();
        });
        const statusCell = excelRow.getCell(8);
        if (r.hasMarks) {
            statusCell.fill = solid(C_GREEN);
            statusCell.font = font({ color: C_GREEN_TEXT, bold: true });
        }
        else {
            statusCell.fill = solid(C_RED);
            statusCell.font = font({ color: C_RED_TEXT, bold: true });
        }
        if (r.hasDuplicates) {
            const uniq = excelRow.getCell(7);
            uniq.fill = solid(C_YELLOW);
            uniq.font = font({ bold: true });
        }
    });

    const footerRow = headerRow + 1 + rows.length + 2;
    ws.mergeCells(footerRow, 1, footerRow, 8);
    const footer = ws.getCell(footerRow, 1);
    footer.value = [
        `Суммарный интервал: ${formatTotalMinutes(totalIntervalMin)}`,
        `Средний интервал: ${intervals.length ? formatTotalMinutes(avgIntervalMin) : '—'}`,
        `Дней с дублями: ${daysWithDupes}`,
    ].join('    ');
    footer.font = font({ bold: true, size: 11 });
    footer.fill = solid(C_SUMMARY);
    footer.alignment = align({ horizontal: 'left' });

    const raw = input.rawMarks ?? [];
    if (raw.length > 0) {
        const ws2 = wb.addWorksheet('Исходные отметки', {
            views: [{ state: 'frozen', ySplit: 1 }],
        });
        ws2.columns = [
            { width: 14 },
            { width: 10 },
            { width: 22 },
            { width: 18 },
            { width: 16 },
            { width: 14 },
            { width: 18 },
        ];
        const rawHeaders = ['Дата', 'Время', 'Имя', 'Person ID', 'Точка', 'Статус', 'Камера'];
        rawHeaders.forEach((h, i) => {
            ws2.getCell(1, i + 1).value = h;
        });
        styleHeaderRow(ws2, 1, 7);
        const sorted = [...raw].sort((a, b) => String(a.time ?? '').localeCompare(String(b.time ?? '')));
        sorted.forEach((rec, idx) => {
            const rowIdx = 2 + idx;
            const t = rec.time ? new Date(rec.time) : null;
            const ymd = t && !Number.isNaN(t.getTime())
                ? `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.${t.getFullYear()}`
                : '';
            const hm = t && !Number.isNaN(t.getTime())
                ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
                : (rec.time ?? '');
            const vals = [
                ymd,
                hm,
                rec.name || '',
                rec.person_id || '',
                rec.checkpoint || rec.label || '',
                rec.attendance_status || '',
                rec.camera_ip || '',
            ];
            vals.forEach((v, i) => {
                const cell = ws2.getCell(rowIdx, i + 1);
                cell.value = v;
                cell.border = border();
                cell.fill = solid(idx % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN);
                cell.font = font({ size: 10 });
            });
        });
    }

    const buffer = await writeExcelWorkbookBuffer(wb);
    const blob = excelWorkbookBufferToBlob(buffer);
    const safeName = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
    triggerDownload(blob, `attendance_${safeName}_${input.dateFrom}_${input.dateTo}.xlsx`);
}
