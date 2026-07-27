import {
    buildPartnerConfirmedSnapshotExcel,
    type PartnerConfirmedExcelFallbackRow,
    type PartnerConfirmedExcelPositionRateRow,
    type ProjectPartnerAccessRow,
    type ReportSnapshot,
} from '@entities/time-tracking';
import { buildReportDownloadFilename, resolveReportDownloadLabelsFromExcelRows } from '@entities/time-tracking/lib/reportDownloadFilename';
import type { TimeExcelPreviewRow } from './previewExcelTypes';
import type { AuthUserExportProfile } from './reportPreviewEmployeeInitials';
import { buildReportExportPositionRateRows } from './reportPreviewPositionRates';

export function timePreviewRowsForPageExport(displayRows: TimeExcelPreviewRow[]): TimeExcelPreviewRow[] {
    if (displayRows.length === 0)
        return displayRows;
    const hasEntry = displayRows.some((r) => r.rowKind === 'entry');
    const base = hasEntry ? displayRows.filter((r) => r.rowKind === 'entry') : displayRows;
    return base.filter((r) => !r.isVoided);
}

export function computeTimePreviewRowAmountToPay(r: TimeExcelPreviewRow): number {
    if (r.isVoided)
        return 0;
    if (!r.isBillable)
        return 0;
    // Prefer server package-aware amount (including 0 for package-covered hours).
    if (typeof r.amountToPay === 'number' && Number.isFinite(r.amountToPay))
        return Math.round(r.amountToPay * 100) / 100;
    const bh = Number.isFinite(r.billableHours) ? r.billableHours : 0;
    const rate = Number.isFinite(r.billableRate) ? r.billableRate : 0;
    const hours = Math.round(bh * 100) / 100;
    const rateR = Math.round(rate * 100) / 100;
    return Math.round(hours * rateR * 100) / 100;
}

/** Hours×rate recompute for in-preview edits (does not prefer stored amountToPay). */
export function recomputeTimePreviewRowAmountToPay(r: TimeExcelPreviewRow): number {
    if (r.isVoided)
        return 0;
    if (!r.isBillable)
        return 0;
    const bh = Number.isFinite(r.billableHours) ? r.billableHours : 0;
    const rate = Number.isFinite(r.billableRate) ? r.billableRate : 0;
    const hours = Math.round(bh * 100) / 100;
    const rateR = Math.round(rate * 100) / 100;
    return Math.round(hours * rateR * 100) / 100;
}

export function timeExcelPreviewRowsToPartnerFallback(rows: TimeExcelPreviewRow[]): PartnerConfirmedExcelFallbackRow[] {
    return timePreviewRowsForPageExport(rows).map((row) => ({
        rowKind: row.rowKind,
        workDate: row.workDate,
        employeeName: row.employeeName,
        employeeInitials: row.employeeInitials,
        employeePosition: row.employeePosition,
        authUserId: row.authUserId,
        taskName: row.taskName,
        note: row.note || row.description || '',
        hours: Number.isFinite(row.hours) ? row.hours : 0,
        billableHours: Number.isFinite(row.billableHours) ? row.billableHours : 0,
        billableRate: Number.isFinite(row.billableRate) ? row.billableRate : 0,
        amountToPay: computeTimePreviewRowAmountToPay(row),
        isVoided: row.isVoided,
        timeEntryId: row.timeEntryId,
        scopeColor: typeof row.scopeColor === 'string' ? row.scopeColor : '',
    }));
}

function previewExportSnapshot(title: string): ReportSnapshot {
    const now = new Date().toISOString();
    return {
        id: 'preview-export',
        name: title.trim() || 'Report preview',
        reportType: 'time',
        groupBy: 'projects',
        filters: {},
        version: 1,
        createdByUserId: 0,
        createdAt: now,
        updatedAt: null,
        rowCount: 0,
    };
}

export async function buildReportPreviewPartnerExcel(
    title: string,
    visiblePageRows: TimeExcelPreviewRow[],
    opts?: {
        projectId?: string;
        currency?: string;
        profilesByAuthUserId?: ReadonlyMap<number, AuthUserExportProfile>;
        projectMembers?: ProjectPartnerAccessRow[];
        clientName?: string;
        projectName?: string;
        dateFrom?: string;
        dateTo?: string;
        /** Prefer invoice-ready total (time + package + expenses in settlement currency). */
        totalForInvoiceAmount?: number;
    },
) {
    const rowsForExport = timePreviewRowsForPageExport(visiblePageRows);
    let positionRateRows: PartnerConfirmedExcelPositionRateRow[] | undefined;
    const projectId = (opts?.projectId ?? rowsForExport.find((r) => r.projectId.trim())?.projectId ?? '').trim();
    const currency = (opts?.currency ?? rowsForExport.find((r) => r.currency.trim())?.currency ?? 'USD').trim() || 'USD';
    if (projectId && opts?.profilesByAuthUserId) {
        positionRateRows = await buildReportExportPositionRateRows({
            exportRows: visiblePageRows,
            projectId,
            currency,
            profilesByAuthUserId: opts.profilesByAuthUserId,
            projectMembers: opts.projectMembers,
        });
    }
    const summed = rowsForExport.reduce((acc, row) => acc + computeTimePreviewRowAmountToPay(row), 0);
    const totalForInvoiceAmount = opts?.totalForInvoiceAmount != null && Number.isFinite(opts.totalForInvoiceAmount)
        ? opts.totalForInvoiceAmount
        : summed;
    const labels = resolveReportDownloadLabelsFromExcelRows(rowsForExport, {
        clientName: opts?.clientName,
        projectName: opts?.projectName,
    });
    const downloadFilename = buildReportDownloadFilename({
        clientName: labels.clientName,
        projectName: labels.projectName,
        dateFrom: opts?.dateFrom,
        dateTo: opts?.dateTo,
    });
    return buildPartnerConfirmedSnapshotExcel(previewExportSnapshot(title), {
        snapshotRows: [],
        fallbackTimeRows: timeExcelPreviewRowsToPartnerFallback(visiblePageRows),
        preferPageRows: true,
        positionRateRows,
        totalForInvoiceAmount,
        currency,
        downloadFilename,
    });
}

import { downloadBlob } from '@shared/lib/downloadBlob';

export { downloadBlob };
