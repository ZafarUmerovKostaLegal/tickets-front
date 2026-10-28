import { buildPartnerConfirmedSnapshotExcel, fetchAllTimeReportProjectRows, fetchPartnerInvoicePreview, getReportSnapshot, isTimeTrackingHttpError, listUsersWithProjectAccessToProjectForPick, loadSnapshotRowsForPartnerExcel, } from '@entities/time-tracking';
import { sortTimeReportRowsForDisplay } from '@entities/time-tracking/lib/timeReportRows';
import { flattenTimeReportToExcelRows } from '@pages/report-preview/lib/reportPreviewApiToExcelRows';
import { deduplicateTimeExcelPreviewRows } from '@pages/report-preview/lib/reportPreviewDuplicateRows';
import { applyAuthUserExportProfilesToTimePreviewRows, fetchReportExportProfilesByAuthUserId, mergeAuthUserExportProfiles, } from '@pages/report-preview/lib/reportPreviewEmployeeInitials';
import { buildReportPreviewPartnerExcel, downloadBlob, } from '@pages/report-preview/lib/reportPreviewPartnerExcel';
import { resolvePartnerConfirmedExportFilename } from '@pages/time-tracking/lib/resolvePartnerConfirmedExportFilename';
export function syntheticSnapshotFromPartnerRow(row, title) {
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
async function loadLiveTimePreviewExportContext(row) {
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
    const sorted = sortTimeReportRowsForDisplay('projects', reportProjectRows);
    const flat = deduplicateTimeExcelPreviewRows(flattenTimeReportToExcelRows('projects', sorted));
    if (flat.length === 0)
        return { rows: [], profiles: new Map(), projectMembers: [] };
    const exportProfiles = await fetchReportExportProfilesByAuthUserId();
    let projectMembers = [];
    try {
        projectMembers = await listUsersWithProjectAccessToProjectForPick(pid);
    }
    catch {
        projectMembers = [];
    }
    const profiles = mergeAuthUserExportProfiles(exportProfiles, projectMembers.map((m) => ({
        authUserId: m.authUserId,
        position: m.position,
    })));
    const rows = applyAuthUserExportProfilesToTimePreviewRows(flat, profiles);
    return { rows, profiles, projectMembers };
}
async function loadSnapshotForPartnerExport(row) {
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
/**
 * Same Excel pipeline as Report preview download (sort → flatten → dedupe → profiles → partner Excel).
 * Falls back to frozen snapshot rows only when live report data is empty.
 */
export async function exportPartnerConfirmedReportExcel(row) {
    const pid = row.projectId.trim();
    const df = row.dateFrom.slice(0, 10);
    const dt = row.dateTo.slice(0, 10);
    if (!pid || !df || !dt)
        throw new Error('Недостаточно данных отчёта для выгрузки.');
    const live = await loadLiveTimePreviewExportContext(row);
    if (live && live.rows.length > 0) {
        const currency = live.rows.find((item) => item.currency.trim())?.currency.trim() || 'USD';
        const clientName = String(row.clientName ?? '').trim()
            || live.rows.find((r) => r.clientName.trim())?.clientName
            || '';
        const projectName = String(row.projectName ?? '').trim()
            || row.title.trim()
            || live.rows.find((r) => r.projectName.trim())?.projectName
            || '';
        const title = [clientName, projectName].filter(Boolean).join(' — ') || row.title.trim() || 'Report';
        let invoiceTotal;
        let invoiceCurrency = currency;
        try {
            const preview = await fetchPartnerInvoicePreview({
                projectId: pid,
                dateFrom: df,
                dateTo: dt,
                clientId: String(row.clientId ?? '').trim() || undefined,
            });
            invoiceTotal = preview.expectedSubtotal;
            invoiceCurrency = preview.currency || currency;
        }
        catch {
            invoiceTotal = undefined;
        }
        const { blob, filename } = await buildReportPreviewPartnerExcel(title, live.rows, {
            projectId: pid,
            currency: invoiceCurrency,
            profilesByAuthUserId: live.profiles,
            projectMembers: live.projectMembers,
            clientName,
            projectName,
            dateFrom: df,
            dateTo: dt,
            totalForInvoiceAmount: invoiceTotal,
        });
        downloadBlob(blob, filename);
        return;
    }
    const loadedSnapshot = await loadSnapshotForPartnerExport(row);
    if (!loadedSnapshot)
        throw new Error('Не удалось загрузить данные отчёта для выгрузки.');
    const downloadFilename = await resolvePartnerConfirmedExportFilename(row, loadedSnapshot.snapshot);
    const { blob, filename } = await buildPartnerConfirmedSnapshotExcel(loadedSnapshot.snapshot, {
        snapshotRows: loadedSnapshot.snapshotRows,
        downloadFilename,
    });
    downloadBlob(blob, filename);
}
