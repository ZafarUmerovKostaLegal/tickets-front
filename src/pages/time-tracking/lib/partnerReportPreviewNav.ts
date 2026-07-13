import { fetchReportsMeta, type PartnerReportConfirmationRequest } from '@entities/time-tracking';
import { writeReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import { routes } from '@shared/config';
import type { NavigateFunction } from 'react-router-dom';

async function reportPreviewPerPage(): Promise<number> {
    try {
        const meta = await fetchReportsMeta();
        const cap = meta.pageSizeMax != null && meta.pageSizeMax > 0 ? Math.min(meta.pageSizeMax, 5000) : 500;
        return Math.min(500, cap);
    }
    catch {
        return 500;
    }
}

export async function openForReviewReportPreview(r: PartnerReportConfirmationRequest, navigate: NavigateFunction): Promise<void> {
    const perPage = await reportPreviewPerPage();
    writeReportPreviewTransfer({
        v: 2,
        reportType: 'time',
        groupBy: 'projects',
        filters: {
            dateFrom: r.dateFrom,
            dateTo: r.dateTo,
            project_id: r.projectId,
            page: 1,
            per_page: perPage,
        },
        forReviewPreview: true,
        returnTo: `${routes.timeTracking}?tab=reports&reportsSection=for-review`,
    });
    navigate(routes.timeTrackingReportPreview);
}

export async function openConfirmedPartnerReportPreview(
    r: PartnerReportConfirmationRequest,
    navigate: NavigateFunction,
    opts?: { returnTo?: string },
): Promise<void> {
    const perPage = await reportPreviewPerPage();
    writeReportPreviewTransfer({
        v: 2,
        reportType: 'time',
        groupBy: 'projects',
        filters: {
            dateFrom: r.dateFrom,
            dateTo: r.dateTo,
            project_id: r.projectId,
            page: 1,
            per_page: perPage,
        },
        partnerConfirmationSnapshotId: r.snapshotId,
        ...(opts?.returnTo ? { returnTo: opts.returnTo } : {}),
    });
    navigate(routes.timeTrackingReportPreview);
}
