import type { User } from '@entities/user';
import { normalizeOrgRoleKey } from '@shared/lib/orgRoles';
const VACATION_SCHEDULE_EDIT_ROLE_KEYS = new Set(['Главный администратор', 'Администратор', 'Партнер', 'Офис менеджер', 'Офис-менеджер'].map(normalizeOrgRoleKey));
function roleCanEditVacationSchedule(user: User | null | undefined): boolean {
    const k = normalizeOrgRoleKey(user?.role);
    return k.length > 0 && VACATION_SCHEDULE_EDIT_ROLE_KEYS.has(k);
}
export function canEditVacationSchedule(user: User | null | undefined): boolean {
    const fromApi = user?.permissions?.vacation_can_manage_schedule;
    if (typeof fromApi === 'boolean')
        return fromApi;
    return roleCanEditVacationSchedule(user);
}
export function canImportVacationSchedule(user: User | null | undefined): boolean {
    return canEditVacationSchedule(user);
}

export function canViewVacationManualEntryDocs(user: User | null | undefined): boolean {
    return canEditVacationSchedule(user);
}

export function canDecideVacationLeaveRequests(user: User | null | undefined): boolean {
    const k = normalizeOrgRoleKey(user?.role);
    return k.includes('партнер') || k.includes('partner');
}
