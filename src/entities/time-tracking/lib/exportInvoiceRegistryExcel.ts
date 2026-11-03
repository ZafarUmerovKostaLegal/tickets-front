import type { Fill } from 'exceljs';
import type { CbuParsed } from '@entities/expenses/model/cbuRates';
import {
    formatRegistryAmountCell,
    formatRegistryAmountUsd,
    INVOICE_REGISTRY_USD_COLUMN,
    isInvoiceRegistryMoneyColumnKey,
    normalizeRegistryStatusLabel,
    type InvoiceRegistryColumnDef,
    type InvoiceRegistryRow,
} from '@entities/time-tracking/model/invoiceRegistry';
import { loadExcelJS, writeExcelWorkbookBuffer, excelWorkbookBufferToBlob } from '@shared/lib/exceljsLoader';

export type ExportInvoiceRegistryExcelInput = {
    rows: InvoiceRegistryRow[];
    columns: InvoiceRegistryColumnDef[];
    sheetName: string;
    yearLabel: string;
    usdRates?: Readonly<Record<string, CbuParsed>>;
    usdFailed?: Readonly<Record<string, true>>;
};

const FILL_HEADER: Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
};

function slugifyFilePart(raw: string): string {
    const s = String(raw ?? '')
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return s || 'registry';
}

function triggerXlsxDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function exportColumns(columns: InvoiceRegistryColumnDef[]): InvoiceRegistryColumnDef[] {
    return columns.filter((col) => col.editor !== 'pdf');
}

function cellValue(
    row: InvoiceRegistryRow,
    col: InvoiceRegistryColumnDef,
    usdRates: Readonly<Record<string, CbuParsed>>,
    usdFailed: Readonly<Record<string, true>>,
): string | number {
    if (col.key === INVOICE_REGISTRY_USD_COLUMN)
        return formatRegistryAmountUsd(row, usdRates, usdFailed);
    const raw = String(row[col.key] ?? '');
    if (col.editor === 'status')
        return normalizeRegistryStatusLabel(raw) || raw;
    if (isInvoiceRegistryMoneyColumnKey(col.key)) {
        const formatted = formatRegistryAmountCell(raw);
        const asNum = formatted.replace(/,/g, '');
        const n = Number(asNum);
        if (formatted && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(asNum))
            return n;
        return formatted || raw;
    }
    return raw;
}

function columnWidth(col: InvoiceRegistryColumnDef): number {
    if (col.key === 'seqNo')
        return 8;
    if (col.wide)
        return 36;
    if (col.key === 'currency' || col.key === 'partner')
        return 12;
    if (col.key === INVOICE_REGISTRY_USD_COLUMN || isInvoiceRegistryMoneyColumnKey(col.key))
        return 16;
    if (col.key === 'statusNote')
        return 16;
    return 18;
}

/** Client-side Excel export of the (already filtered) invoice registry rows. */
export async function exportInvoiceRegistryExcel(input: ExportInvoiceRegistryExcelInput): Promise<string> {
    const rows = input.rows ?? [];
    if (rows.length === 0)
        throw new Error('empty');

    const columns = exportColumns(input.columns ?? []);
    if (columns.length === 0)
        throw new Error('empty');

    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet((input.sheetName || 'Registry').slice(0, 31), {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    const headerRow = ws.addRow(columns.map((col) => col.label));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = FILL_HEADER;
    headerRow.alignment = { vertical: 'middle', wrapText: true };
    headerRow.height = 28;

    const usdRates = input.usdRates ?? {};
    const usdFailed = input.usdFailed ?? {};

    for (const row of rows) {
        const values = columns.map((col) => cellValue(row, col, usdRates, usdFailed));
        const excelRow = ws.addRow(values);
        excelRow.alignment = { vertical: 'top', wrapText: true };
    }

    columns.forEach((col, i) => {
        const column = ws.getColumn(i + 1);
        column.width = columnWidth(col);
        if (isInvoiceRegistryMoneyColumnKey(col.key) || col.key === INVOICE_REGISTRY_USD_COLUMN) {
            column.numFmt = '#,##0.00';
            column.alignment = { horizontal: 'right', vertical: 'top' };
        }
    });

    const buffer = await writeExcelWorkbookBuffer(wb);
    const blob = excelWorkbookBufferToBlob(buffer);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `invoice-registry-${slugifyFilePart(input.yearLabel)}-${dateStr}.xlsx`;
    triggerXlsxDownload(blob, filename);
    return filename;
}
