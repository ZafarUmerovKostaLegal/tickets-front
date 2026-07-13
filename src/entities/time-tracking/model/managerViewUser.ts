import type { User } from '@entities/user';
import type { TimeTrackingUserRow } from '@entities/time-tracking';
function parseWeeklyCap(raw: string | number | undefined): number | null {
    if (raw == null || raw === '')
        return null;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function timeTrackingModuleRoleFromRow(row: TimeTrackingUserRow): 'manager' | 'user' | null {
    const r = (row.role ?? '').trim();
    return r === 'manager' || r === 'user' ? r : null;
}
export function userFromTimeTrackingRowForUpsert(current: User, row: TimeTrackingUserRow): User {
    const fromRow = timeTrackingModuleRoleFromRow(row);
    return {
        ...current,
        id: row.id,
        email: row.email,
        display_name: row.display_name ?? null,
        picture: row.picture ?? null,
        is_blocked: row.is_blocked,
        is_archived: row.is_archived,
        weekly_capacity_hours: parseWeeklyCap(row.weekly_capacity_hours),
        time_tracking_role: fromRow ?? current.time_tracking_role ?? null,
    };
}
