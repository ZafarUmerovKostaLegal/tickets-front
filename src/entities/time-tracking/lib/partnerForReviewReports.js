export function countPartnerForReviewPendingSignature(requests, authUserId) {
    if (authUserId == null || !Number.isFinite(authUserId))
        return 0;
    const uid = Math.round(authUserId);
    return requests.filter((r) => r.pendingPartnerAuthUserIds.includes(uid)).length;
}
export function formatPartnerForReviewBadge(count) {
    if (count <= 0)
        return '';
    if (count > 99)
        return '99+';
    return String(count);
}
