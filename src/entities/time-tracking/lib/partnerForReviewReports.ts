import type { PartnerPendingBadgeRow } from '../api/partnerReportConfirmationsPending';

export function countPartnerForReviewPendingSignature(
    requests: readonly PartnerPendingBadgeRow[],
    authUserId: number | null | undefined,
): number {
    if (authUserId == null || !Number.isFinite(authUserId))
        return 0;
    const uid = Math.round(authUserId);
    return requests.filter((r) => r.pendingPartnerAuthUserIds.includes(uid)).length;
}

export function formatPartnerForReviewBadge(count: number): string {
    if (count <= 0)
        return '';
    if (count > 99)
        return '99+';
    return String(count);
}
