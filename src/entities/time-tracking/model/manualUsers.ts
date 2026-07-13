import type { User } from '@entities/user';
import type { TimeTrackingUserRow } from '@entities/time-tracking/api';

export const MANUAL_TT_USER_AUTH_ID_FLOOR = 2_000_000_000;

export function isManualTtAuthUserId(authUserId: number): boolean {
    return Number.isFinite(authUserId) && authUserId >= MANUAL_TT_USER_AUTH_ID_FLOOR;
}

export function isWithoutAuthRegistration(user: Pick<TimeTrackingUserRow, 'is_manual' | 'id'>): boolean {
    return user.is_manual === true || isManualTtAuthUserId(user.id);
}

function parseWeeklyCap(raw: string | number | undefined): number | null {
    if (raw == null || raw === '')
        return null;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

export function timeTrackingRowToUser(row: TimeTrackingUserRow): User {
    return {
        id: row.id,
        email: row.email,
        display_name: row.display_name ?? null,
        picture: row.picture ?? null,
        role: row.role ?? '',
        position: row.position ?? null,
        is_blocked: row.is_blocked,
        is_archived: row.is_archived,
        weekly_capacity_hours: parseWeeklyCap(row.weekly_capacity_hours),
        time_tracking_role: row.role === 'manager' || row.role === 'user' ? row.role : null,
        created_at: row.created_at,
        updated_at: row.updated_at ?? null,
        desktop_background: null,
    };
}
