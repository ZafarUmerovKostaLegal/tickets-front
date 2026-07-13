const MANAGE_ROLES = ['Главный администратор', 'Администратор', 'Партнер'] as const;
function normalizeRoleKey(role: string): string {
    return role.trim().toLowerCase().replace(/ё/g, 'е');
}
const MANAGE_ROLE_KEYS = new Set(MANAGE_ROLES.map((r) => normalizeRoleKey(r)));
export function canManageTimeManagerClients(role: string | null | undefined): boolean {
    const rk = normalizeRoleKey(role ?? '');
    if (!rk)
        return false;
    return MANAGE_ROLE_KEYS.has(rk);
}
export function canManageUserProjectAccess(appRole: string | null | undefined, timeTrackingRole: 'user' | 'manager' | null | undefined): boolean {
    if (canManageTimeManagerClients(appRole))
        return true;
    return timeTrackingRole === 'manager';
}
