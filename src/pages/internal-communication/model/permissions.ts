import { hasFullTicketAccessRole } from '@shared/lib/orgRoles';

export function canManageInternalExtensions(role: string | null | undefined): boolean {
    return hasFullTicketAccessRole(role);
}
