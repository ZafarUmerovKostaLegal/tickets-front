import {
    buildPartnerConfirmedSnapshotExcel,
    fetchAllTimeReportProjectRows,
    getReportSnapshot,
    isTimeTrackingHttpError,
    loadSnapshotRowsForPartnerExcel,
    type PartnerReportConfirmationRequest,
    type ReportSnapshot,
    type ReportSnapshotRow,
} from '@entities/time-tracking';
import { flattenTimeReportToExcelRows } from '@pages/report-preview/lib/reportPreviewApiToExcelRows';
import {
    applyAuthUserExportProfilesToTimePreviewRows,
    fetchReportExportProfilesByAuthUserId,
} from '@pages/report-preview/lib/reportPreviewEmployeeInitials';
import { buildReportExportPositionRateRows } from '@pages/report-preview/lib/reportPreviewPositionRates';
import { timeExcelPreviewRowsToPartnerFallback } from '@pages/report-preview/lib/reportPreviewPartnerExcel';
import { resolvePartnerConfirmedExportFilename } from '@pages/time-tracking/lib/resolvePartnerConfirmedExportFilename';
import { downloadBlob } from '@shared/lib/downloadBlob';

type PartnerConfirmedExcelBuildOpts = NonNullable<Parameters<typeof buildPartnerConfirmedSnapshotExcel>[1]>;

export function syntheticSnapshotFromPartnerRow(
    row: PartnerReportConfirmationRequest,
    title?: string,
): ReportSnapshot {
    const now = new Date().toISOString();
    const snapshotId = row.snapshotId.trim();
    return {
        id: snapshotId || 'partner-confirmed-export',
        name: (title ?? row.title).trim() || 'Report',
        reportType: 'time',
        groupBy: 'projects',
        filters: {
            dateFrom: row.dateFrom,
            dateTo: row.dateTo,
            project_id: row.projectId,
        },
        version: 1,
        createdByUserId: row.submittedByAuthUserId,
        createdAt: row.createdAt || now,
        updatedAt: row.updatedAt,
        rowCount: 0,
    };
}

async function buildExportOptsFromLiveReport(
    row: PartnerReportConfirmationRequest,
): Promise<PartnerConfirmedExcelBuildOpts | null> {
    const pid = row.projectId.trim();
    const df = row.dateFrom.slice(0, 10);
    const dt = row.dateTo.slice(0, 10);
    if (!pid || !df || !dt)
        return null;
    const reportProjectRows = await fetchAllTimeReportProjectRows({
        dateFrom: df,
        dateTo: dt,
        project_id: pid,
        pageSizeMax: 5000,
    });
    const flat = flattenTimeReportToExcelRows('projects', reportProjectRows);
    if (flat.length === 0)
        return null;
    const exportProfiles = await fetchReportExportProfilesByAuthUserId();
    const enriched = applyAuthUserExportProfilesToTimePreviewRows(flat, exportProfiles);
    const fallbackTimeRows = timeExcelPreviewRowsToPartnerFallback(enriched);
    if (fallbackTimeRows.length === 0)
        return null;
    const currency = enriched.find((item) => item.currency.trim())?.currency.trim() || 'USD';
    const positionRateRows = await buildReportExportPositionRateRows({
        exportRows: enriched,
        projectId: pid,
        currency,
        profilesByAuthUserId: exportProfiles,
    });
    return {
        fallbackTimeRows,
        preferPageRows: true,
        positionRateRows,
        totalForInvoiceAmount: fallbackTimeRows.reduce((acc, item) => acc + item.amountToPay, 0),
        currency,
    };
}

async function loadSnapshotForPartnerExport(
    row: PartnerReportConfirmationRequest,
): Promise<{ snapshot: ReportSnapshot; snapshotRows: ReportSnapshotRow[] } | null> {
    const snapshotId = row.snapshotId.trim();
    if (!snapshotId)
        return null;
    try {
        const snapshot = await getReportSnapshot(snapshotId);
        const snapshotRows = await loadSnapshotRowsForPartnerExcel(snapshotId, snapshot);
        return { snapshot, snapshotRows };
    }
    catch (e) {
        if (isTimeTrackingHttpError(e, 404))
            return null;
        throw e;
    }
}

export async function exportPartnerConfirmedReportExcel(row: PartnerReportConfirmationRequest): Promise<void> {
    const pid = row.projectId.trim();
    const df = row.dateFrom.slice(0, 10);
    const dt = row.dateTo.slice(0, 10);
    if (!pid || !df || !dt)
        throw new Error('Недостаточно данных отчёта для выгрузки.');

    const loadedSnapshot = await loadSnapshotForPartnerExport(row);
    const liveOpts = await buildExportOptsFromLiveReport(row);
    if (!loadedSnapshot && !liveOpts)
        throw new Error('Не удалось загрузить данные отчёта для выгрузки.');

    const downloadFilename = await resolvePartnerConfirmedExportFilename(row, loadedSnapshot?.snapshot);
    const snapshot = loadedSnapshot?.snapshot
        ?? syntheticSnapshotFromPartnerRow(row, downloadFilename.replace(/\.xlsx$/i, ''));
    const buildOpts: PartnerConfirmedExcelBuildOpts = loadedSnapshot
        ? {
            snapshotRows: loadedSnapshot.snapshotRows,
            ...(liveOpts ?? {}),
            downloadFilename,
        }
        : {
            ...(liveOpts ?? { snapshotRows: [] }),
            downloadFilename,
        };

    const { blob, filename } = await buildPartnerConfirmedSnapshotExcel(snapshot, buildOpts);
    downloadBlob(blob, filename);
}
