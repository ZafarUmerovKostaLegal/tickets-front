import { isVacationManagingPartner } from '@entities/vacation';
import { normalizeOrgRoleKey } from '@shared/lib/orgRoles';
const VACATION_SCHEDULE_EDIT_ROLE_KEYS = new Set(['Главный администратор', 'Администратор', 'Партнер', 'Офис менеджер', 'Офис-менеджер'].map(normalizeOrgRoleKey));
function roleCanEditVacationSchedule(user) {
    const k = normalizeOrgRoleKey(user?.role);
    return k.length > 0 && VACATION_SCHEDULE_EDIT_ROLE_KEYS.has(k);
}
export function canEditVacationSchedule(user) {
    const fromApi = user?.permissions?.vacation_can_manage_schedule;
    if (typeof fromApi === 'boolean')
        return fromApi;
    return roleCanEditVacationSchedule(user);
}
export function canImportVacationSchedule(user) {
    return canEditVacationSchedule(user);
}
export function canViewVacationManualEntryDocs(user) {
    return canEditVacationSchedule(user);
}
export function canDecideVacationLeaveRequests(user) {
    const k = normalizeOrgRoleKey(user?.role);
    if (k.includes('партнер') || k.includes('partner'))
        return true;
    // Управляющий партнёр решает вторую ступень независимо от того, как записана его роль.
    return isVacationManagingPartner(user?.email);
}
