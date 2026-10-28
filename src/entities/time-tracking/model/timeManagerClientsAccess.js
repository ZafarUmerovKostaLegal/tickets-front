const MANAGE_ROLES = ['Главный администратор', 'Администратор', 'Партнер'];
function normalizeRoleKey(role) {
    return role.trim().toLowerCase().replace(/ё/g, 'е');
}
const MANAGE_ROLE_KEYS = new Set(MANAGE_ROLES.map((r) => normalizeRoleKey(r)));
export function canManageTimeManagerClients(role) {
    const rk = normalizeRoleKey(role ?? '');
    if (!rk)
        return false;
    return MANAGE_ROLE_KEYS.has(rk);
}
export function canManageUserProjectAccess(appRole, timeTrackingRole) {
    if (canManageTimeManagerClients(appRole))
        return true;
    return timeTrackingRole === 'manager';
}
