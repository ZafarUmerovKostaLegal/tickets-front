import { hasFullTicketAccessRole } from '@shared/lib/orgRoles';
export function canManageInternalExtensions(role) {
    return hasFullTicketAccessRole(role);
}
