import { isOfficeManagerRole, isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';

const ADMIN_KEYS = new Set(['главный администратор', 'администратор']);

/** Same set as correspondence check_manage_role: admin, partner, office manager. */
export function canDeleteCorrespondence(role: string | null | undefined, position?: string | null): boolean {
    const key = normalizeOrgRoleKey(role);
    if (ADMIN_KEYS.has(key))
        return true;
    return isPartnerOrgRole(role, position) || isOfficeManagerRole(role);
}
