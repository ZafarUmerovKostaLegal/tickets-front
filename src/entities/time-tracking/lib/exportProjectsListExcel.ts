import type { Fill } from 'exceljs';
import { loadExcelJS, writeExcelWorkbookBuffer, excelWorkbookBufferToBlob } from '@shared/lib/exceljsLoader';
import type { ProjectRow } from '../model/types';

export type ProjectsListExcelColumnLabels = {
    client: string;
    project: string;
    type: string;
    status: string;
    budget: string;
    spent: string;
    remaining: string;
    currency: string;
    hours: string;
    sheetName: string;
};

export type ExportProjectsListExcelInput = {
    projects: ProjectRow[];
    partnerLabel: string;
    columnLabels: ProjectsListExcelColumnLabels;
    statusLabel: (status: ProjectRow['status']) => string;
    typeLabel: (type: ProjectRow['type']) => string;
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
    return s || 'partner';
}

function remainingOf(p: ProjectRow): number | null {
    if (typeof p.remaining === 'number' && Number.isFinite(p.remaining))
        return p.remaining;
    if (typeof p.budget === 'number' && Number.isFinite(p.budget))
        return p.budget - (Number.isFinite(p.spent) ? p.spent : 0);
    return null;
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

/** Client-side Excel export of the (already filtered) projects list for a partner. */
export async function exportProjectsListExcel(input: ExportProjectsListExcelInput): Promise<string> {
    const projects = input.projects ?? [];
    if (projects.length === 0)
        throw new Error('empty');

    const ExcelJS = await loadExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kosta Legal';
    wb.created = new Date();
    wb.modified = new Date();

    const labels = input.columnLabels;
    const ws = wb.addWorksheet(labels.sheetName.slice(0, 31) || 'Projects', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    const headers = [
        labels.client,
        labels.project,
        labels.type,
        labels.status,
        labels.budget,
        labels.spent,
        labels.remaining,
        labels.currency,
        labels.hours,
    ];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = FILL_HEADER;
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 22;

    for (const p of projects) {
        const budget = p.hasBudgetConfigured === false
            ? null
            : (typeof p.budget === 'number' && Number.isFinite(p.budget) ? p.budget : null);
        const rem = remainingOf(p);
        const hours = typeof p.loggedHours === 'number' && Number.isFinite(p.loggedHours)
            ? p.loggedHours
            : null;
        ws.addRow([
            p.client || '',
            p.name || '',
            input.typeLabel(p.type),
            input.statusLabel(p.status),
            budget,
            Number.isFinite(p.spent) ? p.spent : 0,
            rem,
            (p.currency || '').trim() || 'USD',
            hours,
        ]);
    }

    const widths = [28, 36, 22, 14, 14, 14, 14, 10, 10];
    widths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
    });
    for (const col of [5, 6, 7, 9]) {
        ws.getColumn(col).numFmt = '#,##0.00';
        ws.getColumn(col).alignment = { horizontal: 'right' };
    }

    const buffer = await writeExcelWorkbookBuffer(wb);
    const blob = excelWorkbookBufferToBlob(buffer);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `projects-${slugifyFilePart(input.partnerLabel)}-${dateStr}.xlsx`;
    triggerXlsxDownload(blob, filename);
    return filename;
}
