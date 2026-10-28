export function timeTrackingUserDisplayLabel(u) {
    return (u.display_name?.trim() || u.email || `#${u.id}`).trim();
}
export function buildArchivedAuthUserIds(users) {
    const ids = new Set();
    for (const u of users) {
        if (u.is_archived || u.is_blocked)
            ids.add(u.id);
    }
    return ids;
}
export function buildArchivedEmployeeNames(users) {
    const names = new Set();
    for (const u of users) {
        if (!u.is_archived && !u.is_blocked)
            continue;
        const label = timeTrackingUserDisplayLabel(u);
        if (label)
            names.add(label);
    }
    return names;
}
export function isActiveReportPreviewEmployee(authUserId, archivedAuthUserIds) {
    if (!Number.isFinite(authUserId) || authUserId <= 0)
        return true;
    return !archivedAuthUserIds.has(authUserId);
}
export function filterActiveEmployeeNames(names, archivedNames) {
    return names.filter((name) => !archivedNames.has(name));
}
