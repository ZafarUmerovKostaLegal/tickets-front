const ROLES_MODERATE_CANONICAL = ['Главный администратор', 'Администратор', 'Партнер'];
function normalizeExpenseRoleKey(role) {
    return (role ?? '').trim().toLowerCase().replace(/ё/g, 'е');
}
const EXPENSE_MODERATION_ROLE_KEYS = new Set(ROLES_MODERATE_CANONICAL.map(r => normalizeExpenseRoleKey(r)));
export function canModerateExpenseRequests(role) {
    const rk = normalizeExpenseRoleKey(role);
    if (!rk)
        return false;
    return EXPENSE_MODERATION_ROLE_KEYS.has(rk);
}
export function canViewExpensesRequestsAndReport(role) {
    return canModerateExpenseRequests(role);
}
export function canAccessExpensesSection(role) {
    return Boolean(role?.trim());
}
