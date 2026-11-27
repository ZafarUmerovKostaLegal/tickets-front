import type { Borders, Color, Fill } from 'exceljs';
import type { CashMovement } from '@entities/expenses/model/cashApi';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { excelWorkbookBufferToBlob, loadExcelJS, writeExcelWorkbookBuffer } from '@shared/lib/exceljsLoader';

const KIND_LABEL: Record<CashMovement['kind'], string> = {
    set: 'Остаток установлен',
    expense: 'Потрачено',
    topup: 'Пополнение',
};

export type CashExportRow = {
    date: Date | null;
    kind: string;
    expenseId: string;
    note: string;
    income: number | null;
    outcome: number | null;
    set: number | null;
    before: number | null;
    after: number | null;
    files: string;
};

function num(raw: string | null | undefined): number | null {
    if (raw == null || raw === '')
        return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

export function cashExportRows(rows: CashMovement[]): CashExportRow[] {
    return [...rows]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
        .map((row) => {
            const amount = num(row.amount);
            const date = new Date(row.createdAt);
            return {
                date: Number.isNaN(date.getTime()) ? null : new Date(date.getTime() - date.getTimezoneOffset() * 60_000),
                kind: KIND_LABEL[row.kind] ?? row.kind,
                expenseId: row.expenseId ?? '',
                note: row.note.trim(),
                income: row.kind === 'topup' ? amount : null,
                outcome: row.kind === 'expense' ? amount : null,
                set: row.kind === 'set' ? amount : null,
                before: num(row.balanceBefore),
                after: num(row.balanceAfter),
                files: (row.attachments ?? []).map((file) => file.fileName).join(', '),
            };
        });
}

export function cashExportTotals(rows: CashExportRow[]): { income: number; outcome: number } {
    return rows.reduce(
        (sum, row) => ({ income: sum.income + (row.income ?? 0), outcome: sum.outcome + (row.outcome ?? 0) }),
        { income: 0, outcome: 0 },
    );
}

function moneyFormat(value: unknown): string {
    return typeof value === 'number' && !Number.isInteger(value) ? '#,##0.00' : '#,##0';
}
const HEAD: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } as Color };
const TOTAL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F9' } as Color };
const EVEN: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } as Color };
const LINE = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } as Color };
const BORDER: Partial<Borders> = { top: LINE, bottom: LINE, left: LINE, right: LINE };

const COLUMNS: Array<{ title: string; width: number; key: keyof CashExportRow; money?: boolean }> = [
    { title: 'Дата и время', width: 18, key: 'date' },
    { title: 'Операция', width: 20, key: 'kind' },
    { title: 'Заявка', width: 14, key: 'expenseId' },
    { title: 'Комментарий', width: 48, key: 'note' },
    { title: 'Пополнение', width: 16, key: 'income', money: true },
    { title: 'Потрачено', width: 16, key: 'outcome', money: true },
    { title: 'Установлен остаток', width: 18, key: 'set', money: true },
    { title: 'Остаток до', width: 16, key: 'before', money: true },
    { title: 'Остаток после', width: 16, key: 'after', money: true },
    { title: 'Файлы', width: 30, key: 'files' },
];

export async function exportCashToExcel(movements: CashMovement[], meta: { period: string; balance: string | null }): Promise<void> {
    const rows = cashExportRows(movements);
    const totals = cashExportTotals(rows);
    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Касса', { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.columns = COLUMNS.map((column) => ({ width: column.width }));

    ws.mergeCells(1, 1, 1, COLUMNS.length);
    const title = ws.getCell(1, 1);
    title.value = 'Касса — история операций';
    title.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    ws.mergeCells(2, 1, 2, COLUMNS.length);
    const sub = ws.getCell(2, 1);
    const balance = num(meta.balance);
    sub.value = [
        meta.period ? `Период: ${meta.period}` : 'Период: всё время',
        balance != null ? `Остаток сейчас: ${balance.toLocaleString('ru-RU')} UZS` : null,
        `Выгружено: ${new Date().toLocaleString('ru-RU')}`,
    ].filter(Boolean).join('   ·   ');
    sub.font = { size: 10, color: { argb: 'FF64748B' } };

    const head = ws.getRow(4);
    COLUMNS.forEach((column, index) => {
        const cell = head.getCell(index + 1);
        cell.value = column.title;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = HEAD;
        cell.border = BORDER;
        cell.alignment = { vertical: 'middle', horizontal: column.money ? 'right' : 'left', wrapText: true };
    });
    head.height = 22;

    rows.forEach((row, rowIndex) => {
        const line = ws.getRow(5 + rowIndex);
        COLUMNS.forEach((column, index) => {
            const cell = line.getCell(index + 1);
            cell.value = row[column.key];
            cell.border = BORDER;
            cell.alignment = { vertical: 'top', wrapText: column.key === 'note' || column.key === 'files' };
            if (column.money)
                cell.numFmt = moneyFormat(cell.value);
            if (column.key === 'date')
                cell.numFmt = 'dd.mm.yyyy hh:mm';
            if (rowIndex % 2 === 1)
                cell.fill = EVEN;
        });
    });

    const totalRow = ws.getRow(5 + rows.length);
    totalRow.getCell(1).value = `Итого операций: ${rows.length}`;
    totalRow.getCell(5).value = totals.income;
    totalRow.getCell(6).value = totals.outcome;
    COLUMNS.forEach((column, index) => {
        const cell = totalRow.getCell(index + 1);
        cell.font = { bold: true };
        cell.fill = TOTAL;
        cell.border = BORDER;
        if (column.money)
            cell.numFmt = moneyFormat(cell.value);
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: COLUMNS.length } };

    const blob = excelWorkbookBufferToBlob(await writeExcelWorkbookBuffer(wb));
    downloadBlob(blob, `kassa-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
