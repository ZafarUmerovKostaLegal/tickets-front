import type { Worksheet } from 'exceljs';
import { excelWorkbookBufferToBlob, loadExcelJS, writeExcelWorkbookBuffer } from '@shared/lib/exceljsLoader';
import {
    formatDuration,
    formatMinuteOfDay,
    parseYmd,
    summarizeByEmployee,
    workedTime,
    type AttendanceDayRow,
} from './attendancePeriod';

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A5F' } };
const LATE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFEB9C' } };
const ABSENT_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFC7CE' } };
const THIN = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };

const STATUS_RU: Record<string, string> = {
    present_on_time: 'Вовремя',
    late: 'Опоздал',
    absent: 'Не пришёл',
};

function dot(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    return `${d}.${m}.${y}`;
}

function hm(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '—';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function styleTable(ws: Worksheet, headerRow: number, columns: number): void {
    const header = ws.getRow(headerRow);
    header.height = 22;
    for (let c = 1; c <= columns; c++) {
        const cell = header.getCell(c);
        cell.fill = HEADER_FILL;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    ws.eachRow((row, index) => {
        if (index < headerRow)
            return;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
            if (col <= columns)
                cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
        });
    });
}

export async function exportAttendancePeriodExcel(input: {
    dateFrom: string;
    dateTo: string;
    rows: AttendanceDayRow[];
}): Promise<void> {
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    const period = `${dot(input.dateFrom)} — ${dot(input.dateTo)}`;

    const summary = wb.addWorksheet('Сводка', { views: [{ state: 'frozen', ySplit: 3 }] });
    summary.getCell('A1').value = `Посещаемость за период ${period}`;
    summary.getCell('A1').font = { bold: true, size: 14 };
    const summaryHeader = ['Сотрудник', 'Должность', 'Рабочих дней', 'Пришёл', 'Вовремя', 'Опозданий', 'Не пришёл', 'Без отметки ухода', 'Ср. приход', 'Ср. уход', 'Самый поздний приход', 'Всего часов'];
    summary.addRow([]);
    summary.addRow(summaryHeader);
    const people = summarizeByEmployee(input.rows).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    for (const p of people) {
        const row = summary.addRow([
            p.name,
            p.subtitle,
            p.days,
            p.present,
            p.onTime,
            p.late,
            p.absent,
            p.noExit,
            formatMinuteOfDay(p.avgArrival),
            formatMinuteOfDay(p.avgDeparture),
            formatMinuteOfDay(p.latestArrival),
            formatDuration(p.workedMs),
        ]);
        if (p.late > 0)
            row.getCell(6).fill = LATE_FILL;
        if (p.absent > 0)
            row.getCell(7).fill = ABSENT_FILL;
    }
    summary.columns = [32, 24, 13, 10, 10, 12, 12, 16, 11, 11, 18, 12].map((width) => ({ width }));
    styleTable(summary, 3, summaryHeader.length);

    const detail = wb.addWorksheet('По дням', { views: [{ state: 'frozen', ySplit: 1 }] });
    const detailHeader = ['Дата', 'День недели', 'Сотрудник', 'Статус', 'Приход', 'Уход', 'Часы', 'Отметок', 'Комментарий'];
    detail.addRow(detailHeader);
    const sorted = [...input.rows].sort((a, b) => a.date.localeCompare(b.date)
        || (a.display_name || '').localeCompare(b.display_name || '', 'ru'));
    for (const r of sorted) {
        const worked = workedTime(r);
        const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(parseYmd(r.date));
        const row = detail.addRow([
            dot(r.date),
            weekday,
            r.display_name || r.camera_name || '—',
            STATUS_RU[r.status] ?? r.status,
            hm(r.first_event_time),
            worked.noExit ? 'нет отметки' : hm(worked.ongoing ? null : r.last_event_time),
            worked.ongoing ? `${formatDuration(worked.ms)} (в офисе)` : formatDuration(worked.ms),
            r.unique_event_count ?? r.event_count ?? 0,
            r.explanation_text || '',
        ]);
        if (r.status === 'late')
            row.getCell(4).fill = LATE_FILL;
        if (r.status === 'absent')
            row.getCell(4).fill = ABSENT_FILL;
    }
    detail.columns = [12, 8, 32, 12, 9, 13, 14, 9, 40].map((width) => ({ width }));
    styleTable(detail, 1, detailHeader.length);

    const blob = excelWorkbookBufferToBlob(await writeExcelWorkbookBuffer(wb));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Посещаемость_${input.dateFrom}_${input.dateTo}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
