const byUser = new Map();
function normalizeWeekRange(raw) {
    const weekStart = String(raw.weekStart ?? '').trim().slice(0, 10);
    const weekEnd = String(raw.weekEnd ?? '').trim().slice(0, 10);
    if (weekStart.length !== 10 || weekEnd.length !== 10)
        return null;
    return { weekStart, weekEnd };
}
export function setUserSubmittedWeeks(authUserId, weeks) {
    const uid = Number(authUserId);
    if (!Number.isFinite(uid) || uid <= 0)
        return;
    const normalized = weeks
        .map(normalizeWeekRange)
        .filter((w) => w != null);
    byUser.set(uid, normalized);
}
export function mergeUserSubmittedWeek(authUserId, week) {
    const uid = Number(authUserId);
    const next = normalizeWeekRange(week);
    if (!Number.isFinite(uid) || uid <= 0 || !next)
        return;
    const prev = byUser.get(uid) ?? [];
    if (prev.some((w) => w.weekStart === next.weekStart && w.weekEnd === next.weekEnd)) {
        byUser.set(uid, prev);
        return;
    }
    byUser.set(uid, [...prev, next].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
}
export function isWorkDateInSubmittedWeek(authUserId, workDateYmd) {
    const uid = Number(authUserId);
    const wd = workDateYmd.trim().slice(0, 10);
    if (!Number.isFinite(uid) || uid <= 0 || wd.length !== 10)
        return false;
    return (byUser.get(uid) ?? []).some((w) => wd >= w.weekStart && wd <= w.weekEnd);
}
export function clearUserSubmittedWeeks(authUserId) {
    if (authUserId == null) {
        byUser.clear();
        return;
    }
    const uid = Number(authUserId);
    if (Number.isFinite(uid) && uid > 0)
        byUser.delete(uid);
}
