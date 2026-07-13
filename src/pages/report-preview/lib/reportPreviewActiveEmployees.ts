import type { TimeTrackingUserRow } from '@entities/time-tracking';

export function timeTrackingUserDisplayLabel(u: TimeTrackingUserRow): string {
    return (u.display_name?.trim() || u.email || `#${u.id}`).trim();
}

export function buildArchivedAuthUserIds(users: readonly TimeTrackingUserRow[]): Set<number> {
    const ids = new Set<number>();
    for (const u of users) {
        if (u.is_archived || u.is_blocked)
            ids.add(u.id);
    }
    return ids;
}

export function buildArchivedEmployeeNames(users: readonly TimeTrackingUserRow[]): Set<string> {
    const names = new Set<string>();
    for (const u of users) {
        if (!u.is_archived && !u.is_blocked)
            continue;
        const label = timeTrackingUserDisplayLabel(u);
        if (label)
            names.add(label);
    }
    return names;
}

export function isActiveReportPreviewEmployee(
    authUserId: number,
    archivedAuthUserIds: ReadonlySet<number>,
): boolean {
    if (!Number.isFinite(authUserId) || authUserId <= 0)
        return true;
    return !archivedAuthUserIds.has(authUserId);
}

export function filterActiveEmployeeNames(
    names: readonly string[],
    archivedNames: ReadonlySet<string>,
): string[] {
    return names.filter((name) => !archivedNames.has(name));
}
