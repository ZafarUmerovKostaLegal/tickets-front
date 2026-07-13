import {
    buildPartnerReportDisplayMetaFromSnapshot,
    resolvePartnerReportDisplayMeta,
    type PartnerReportRowDisplayMeta,
} from '@entities/time-tracking/lib/partnerReportDisplay';
import { displayReportClientLabel, displayReportProjectLabel } from '@entities/time-tracking/lib/expenseReportDisplay';
import { loadPartnerReportDisplayLookups } from '@entities/time-tracking/lib/partnerReportDisplayLookups';
import { buildReportDownloadFilename } from '@entities/time-tracking/lib/reportDownloadFilename';
import {
    type PartnerReportConfirmationRequest,
    type ReportSnapshot,
} from '@entities/time-tracking';

function labelsFromMeta(
    row: PartnerReportConfirmationRequest,
    meta: PartnerReportRowDisplayMeta,
): { clientName: string; projectName: string } {
    return {
        clientName: displayReportClientLabel(meta.clientName, meta.clientId),
        projectName: displayReportProjectLabel(meta.projectName, row.projectId),
    };
}

export async function resolvePartnerConfirmedExportFilename(
    row: PartnerReportConfirmationRequest,
    snapshot?: ReportSnapshot | null,
): Promise<string> {
    const directClientName = String(row.clientName ?? '').trim();
    const directProjectName = String(row.projectName ?? '').trim() || row.title.trim();
    if (directClientName && directProjectName) {
        return buildReportDownloadFilename({
            clientName: directClientName,
            projectName: directProjectName,
            dateFrom: row.dateFrom,
            dateTo: row.dateTo,
        });
    }

    let labels: { clientName: string; projectName: string } | null = null;

    if (snapshot) {
        const fromSnapshot = buildPartnerReportDisplayMetaFromSnapshot(snapshot, row);
        if (fromSnapshot.clientName.trim() || fromSnapshot.projectName.trim())
            labels = labelsFromMeta(row, fromSnapshot);
    }

    if (!labels || !labels.clientName.trim() || labels.clientName === '—' || !labels.projectName.trim()) {
        const { projectRows, clientNamesById, clientMetaByProjectId } = await loadPartnerReportDisplayLookups();
        const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, undefined, clientMetaByProjectId);
        labels = labelsFromMeta(row, meta);
    }

    return buildReportDownloadFilename({
        clientName: labels.clientName,
        projectName: labels.projectName,
        dateFrom: row.dateFrom,
        dateTo: row.dateTo,
    });
}
