const ROLES_MODERATE_CANONICAL = ['Главный администратор', 'Администратор', 'Партнер'] as const;
function normalizeExpenseRoleKey(role: string | null | undefined): string {
    return (role ?? '').trim().toLowerCase().replace(/ё/g, 'е');
}
const EXPENSE_MODERATION_ROLE_KEYS = new Set(ROLES_MODERATE_CANONICAL.map(r => normalizeExpenseRoleKey(r)));
export function canModerateExpenseRequests(role: string | null | undefined): boolean {
    const rk = normalizeExpenseRoleKey(role);
    if (!rk)
        return false;
    return EXPENSE_MODERATION_ROLE_KEYS.has(rk);
}
export function canViewExpensesRequestsAndReport(role: string | null | undefined): boolean {
    return canModerateExpenseRequests(role);
}
export function canAccessExpensesSection(role: string | null | undefined): boolean {
    return Boolean(role?.trim());
}
