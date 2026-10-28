import { normalizeOrgRoleKey } from '@shared/lib/orgRoles';
export const LIMIT = 24;
const INVENTORY_EDIT_ROLE_KEYS = new Set(['Администратор', 'IT отдел', 'Партнер', 'Офис менеджер', 'Офис-менеджер'].map(normalizeOrgRoleKey));
const CATEGORY_MANAGE_ROLE_KEYS = new Set(['Администратор', 'IT отдел'].map(normalizeOrgRoleKey));
export function canEditInventory(role) {
    return INVENTORY_EDIT_ROLE_KEYS.has(normalizeOrgRoleKey(role));
}
export function canCreateInventoryItem(role) {
    return INVENTORY_EDIT_ROLE_KEYS.has(normalizeOrgRoleKey(role));
}
export function canManageCategories(role) {
    return CATEGORY_MANAGE_ROLE_KEYS.has(normalizeOrgRoleKey(role));
}
