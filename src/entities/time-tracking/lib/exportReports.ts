import type { BorderStyle, Borders, Color, Fill, Font } from 'exceljs';
import { loadExcelJS } from '@shared/lib/exceljsLoader';
export interface ReportExportCol {
    key: string;
    label: string;
    labelEn?: string;
    numeric?: boolean;
    width?: number;
    hours?: boolean;
}
export interface ReportExportParams {
    title: string;
    periodLabel: string;
    dateFrom: string;
    dateTo: string;
    rows: Record<string, unknown>[];
    cols: ReportExportCol[];
    summaryCards?: {
        label: string;
        value: string;
    }[];
    isSnapshot?: boolean;
    snapshotVersion?: number;
}
type AC = {
    argb: string;
};
const C_NAVY: AC = { argb: 'FF0F172A' };
const C_NAVY2: AC = { argb: 'FF1E293B' };
const C_HEADER: AC = { argb: 'FF334155' };
const C_ACCENT: AC = { argb: 'FF4F46E5' };
const C_WHITE: AC = { argb: 'FFFFFFFF' };
const C_MUTED: AC = { argb: 'FF64748B' };
const C_ROW_ODD: AC = { argb: 'FFFFFFFF' };
const C_ROW_EVEN: AC = { argb: 'FFF8FAFC' };
const C_TOTAL: AC = { argb: 'FFEEF2F9' };
const C_BORDER: AC = { argb: 'FFE2E8F0' };
const C_BORDER_DARK: AC = { argb: 'FF94A3B8' };
const C_META_BG: AC = { argb: 'FFF1F5F9' };
function solid(color: AC): Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: color as Color };
}
function border(color: AC = C_BORDER): Partial<Borders> {
    const s: BorderStyle = 'thin';
    const c = color as Color;
    return { top: { style: s, color: c }, bottom: { style: s, color: c }, left: { style: s, color: c }, right: { style: s, color: c } };
}
function font(opts: Partial<Font> & {
    color?: AC;
} = {}): Partial<Font> {
    const { color, ...rest } = opts;
    return { name: 'Calibri', size: 10, ...(color ? { color: color as Color } : {}), ...rest };
}
function excelColLetter(col1: number): string {
    let n = col1;
    let s = '';
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}
function todayStr(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function fmtDate(iso: string): string {
    if (!iso)
        return '—';
    const [y, m, day] = iso.split('-');
    return `${day}.${m}.${y}`;
}
function cellValue(row: Record<string, unknown>, key: string): string | number {
    const v = row[key];
    if (v == null)
        return '';
    if (typeof v === 'boolean')
        return v ? 'Да' : 'Нет';
    if (typeof v === 'number')
        return v;
    return String(v);
}
function parseDecimalHours(raw: unknown): number | null {
    if (raw == null || raw === '')
        return null;
    if (typeof raw === 'number' && Number.isFinite(raw))
        return raw;
    const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}
export async function exportReportsToExcel(params: ReportExportParams): Promise<void> {
    const ExcelJS = await loadExcelJS();
    const { title, periodLabel, dateFrom, dateTo, rows, cols, summaryCards, isSnapshot, snapshotVersion } = params;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    wb.modified = new Date();
    const ws = wb.addWorksheet('Данные (Data)', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
        },
        views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
        properties: { tabColor: C_ACCENT },
    });
    const lastCol = excelColLetter(cols.length);
    cols.forEach((c, i) => {
        ws.getColumn(i + 1).width = Math.min(52, Math.max(12, (c.width ?? 130) / 6));
    });
    ws.mergeCells(`A1:${lastCol}1`);
    ws.getRow(1).height = 38;
    const titleCell = ws.getCell('A1');
    titleCell.value = title.toUpperCase();
    titleCell.font = font({ bold: true, size: 14, color: C_WHITE });
    titleCell.fill = solid(C_NAVY);
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: false, wrapText: false };
    ws.mergeCells(`A2:${lastCol}2`);
    ws.getRow(2).height = 17;
    const sub = ws.getCell('A2');
    const snapshotLabel = isSnapshot ? `  ·  Финальный отчёт v${snapshotVersion ?? 1}` : '';
    sub.value = `TIME TRACKING REPORT${snapshotLabel}`;
    sub.font = font({ size: 8.5, italic: true, color: { argb: 'FF94A3B8' } as AC });
    sub.fill = solid(C_NAVY2);
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    const midCol = Math.ceil(cols.length / 2);
    if (midCol > 1) {
        ws.mergeCells(`A3:${excelColLetter(midCol)}3`);
    }
    if (midCol < cols.length) {
        ws.mergeCells(`${excelColLetter(midCol + 1)}3:${lastCol}3`);
    }
    ws.getRow(3).height = 20;
    const metaL = ws.getCell('A3');
    metaL.value = `Период / Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}    |    ${periodLabel}    |    Записей / Records: ${rows.length}`;
    metaL.font = font({ size: 9, italic: true, color: C_MUTED });
    metaL.alignment = { vertical: 'middle', indent: 1 };
    metaL.fill = solid(C_META_BG);
    const metaR = ws.getCell(`${excelColLetter(midCol + 1)}3`);
    metaR.value = `Сформирован / Generated: ${todayStr()}`;
    metaR.font = font({ size: 9, italic: true, color: C_MUTED });
    metaR.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    metaR.fill = solid(C_META_BG);
    ws.getRow(4).height = 5;
    ws.mergeCells(`A4:${lastCol}4`);
    ws.getCell('A4').fill = solid(C_META_BG);
    const HDR_ROW = 5;
    const DATA_START = 6;
    const hasBilingual = cols.some((c) => c.labelEn);
    ws.getRow(HDR_ROW).height = hasBilingual ? 46 : 28;
    cols.forEach((c, i) => {
        const cell = ws.getRow(HDR_ROW).getCell(i + 1);
        cell.value = hasBilingual && c.labelEn ? `${c.label}\n${c.labelEn}` : c.label;
        cell.font = font({ bold: true, size: 9, color: C_WHITE });
        cell.fill = solid(C_HEADER);
        cell.alignment = {
            horizontal: c.numeric ? 'right' : 'left',
            vertical: 'middle',
            wrapText: hasBilingual,
            indent: c.numeric ? 0 : 1,
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF475569' } as Color },
            bottom: { style: 'medium', color: C_ACCENT as Color },
            left: { style: 'thin', color: { argb: 'FF475569' } as Color },
            right: { style: 'thin', color: { argb: 'FF475569' } as Color },
        };
    });
    ws.autoFilter = `A${HDR_ROW}:${lastCol}${HDR_ROW}`;
    rows.forEach((row, ri) => {
        const rowNum = DATA_START + ri;
        const wsRow = ws.getRow(rowNum);
        wsRow.height = 18;
        const bg = ri % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN;
        const brd = border();
        cols.forEach((c, ci) => {
            const cell = wsRow.getCell(ci + 1);
            cell.font = font({ size: 9.5 });
            cell.fill = solid(bg);
            cell.border = brd;
            const hoursN = c.hours ? parseDecimalHours(row[c.key]) : null;
            if (c.hours && hoursN != null) {
                cell.value = hoursN / 24;
                cell.numFmt = '[h]:mm;@';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                return;
            }
            if (c.hours) {
                cell.value = cellValue(row, c.key);
                cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                return;
            }
            const v = cellValue(row, c.key);
            cell.value = v;
            cell.alignment = {
                horizontal: c.numeric ? 'right' : 'left',
                vertical: 'middle',
                indent: c.numeric ? 0 : 1,
            };
            if (c.numeric && typeof v === 'number') {
                cell.numFmt = Number.isInteger(v) ? '#,##0' : '#,##0.00';
            }
        });
    });
    const TOTAL_ROW = DATA_START + rows.length;
    const totRow = ws.getRow(TOTAL_ROW);
    totRow.height = 22;
    const brdTot = border(C_BORDER_DARK);
    const totFont = font({ bold: true, size: 9.5 });
    const firstNumIdx = cols.findIndex((c) => c.numeric);
    const mergeEnd = firstNumIdx > 1 ? firstNumIdx : 1;
    if (mergeEnd > 1) {
        ws.mergeCells(`A${TOTAL_ROW}:${excelColLetter(mergeEnd)}${TOTAL_ROW}`);
    }
    const labelCell = totRow.getCell(1);
    labelCell.value = `ИТОГО / TOTAL  (${rows.length} ${rows.length === 1 ? 'строка' : rows.length < 5 ? 'строки' : 'строк'})`;
    labelCell.font = totFont;
    labelCell.fill = solid(C_TOTAL);
    labelCell.border = brdTot;
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    cols.forEach((c, ci) => {
        const cell = totRow.getCell(ci + 1);
        cell.fill = solid(C_TOTAL);
        cell.border = brdTot;
        if (c.numeric) {
            const colLetter = excelColLetter(ci + 1);
            cell.value = { formula: `SUM(${colLetter}${DATA_START}:${colLetter}${TOTAL_ROW - 1})` };
            cell.font = totFont;
            cell.numFmt = c.hours ? '[h]:mm;@' : '#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
    });
    ws.headerFooter.oddHeader = `&C&B${title}`;
    ws.headerFooter.oddFooter = `&LKosta Legal&C&P / &N&R${todayStr()}`;
    if (summaryCards && summaryCards.length > 0) {
        const ws2 = wb.addWorksheet('KPI', {
            views: [{ showGridLines: false }],
            properties: { tabColor: { argb: 'FF0891B2' } },
        });
        ws2.columns = [{ width: 36 }, { width: 24 }];
        ws2.mergeCells('A1:B1');
        ws2.getRow(1).height = 32;
        const kpiTitle = ws2.getCell('A1');
        kpiTitle.value = `KPI — ${title}`;
        kpiTitle.font = font({ bold: true, size: 13, color: C_WHITE });
        kpiTitle.fill = solid(C_NAVY);
        kpiTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        ws2.mergeCells('A2:B2');
        ws2.getRow(2).height = 16;
        const kpiSub = ws2.getCell('A2');
        kpiSub.value = `Период: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`;
        kpiSub.font = font({ size: 8.5, italic: true, color: { argb: 'FF94A3B8' } as AC });
        kpiSub.fill = solid(C_NAVY2);
        kpiSub.alignment = { horizontal: 'center', vertical: 'middle' };
        ws2.getRow(3).height = 5;
        const hdr = ws2.getRow(4);
        hdr.height = 22;
        (['Показатель / Indicator', 'Значение / Value'] as const).forEach((label, i) => {
            const c = hdr.getCell(i + 1);
            c.value = label;
            c.font = font({ bold: true, size: 9, color: C_WHITE });
            c.fill = solid(C_HEADER);
            c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle', indent: 1 };
            c.border = {
                top: { style: 'thin', color: { argb: 'FF475569' } as Color },
                bottom: { style: 'medium', color: C_ACCENT as Color },
                left: { style: 'thin', color: { argb: 'FF475569' } as Color },
                right: { style: 'thin', color: { argb: 'FF475569' } as Color },
            };
        });
        summaryCards.forEach((card, ri) => {
            const row = ws2.getRow(5 + ri);
            row.height = 20;
            const bg = ri % 2 === 0 ? C_ROW_ODD : C_ROW_EVEN;
            const brd = border();
            const c1 = row.getCell(1);
            c1.value = card.label;
            c1.font = font({ size: 9.5 });
            c1.fill = solid(bg);
            c1.border = brd;
            c1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            const c2 = row.getCell(2);
            c2.value = card.value;
            c2.font = font({ size: 9.5, bold: true });
            c2.fill = solid(bg);
            c2.border = brd;
            c2.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        });
        const fRow = ws2.getRow(5 + summaryCards.length + 1);
        fRow.height = 16;
        ws2.mergeCells(`A${5 + summaryCards.length + 1}:B${5 + summaryCards.length + 1}`);
        const fc = fRow.getCell(1);
        fc.value = `Выгружено: ${todayStr()}`;
        fc.font = font({ size: 8, italic: true, color: C_MUTED });
        fc.alignment = { horizontal: 'right', vertical: 'middle' };
        fc.fill = solid(C_META_BG);
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = title.replace(/[^\wа-яА-Я ]/gi, '').trim().slice(0, 40).replace(/\s+/g, '-');
    a.download = `tt-report-${safeName}-${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
