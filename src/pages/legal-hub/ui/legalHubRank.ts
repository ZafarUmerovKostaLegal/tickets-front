import { isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';
import { normalizeReportEmployeePositionLabel } from '@entities/time-tracking/lib/reportEmployeePosition';

/** Lower rank is more senior. Partner is 0. Associate is 5. Unknown sits at the bottom. */
const POSITION_RANK: readonly string[] = [
    'Partner',
    'Counsel',
    'Senior Associate',
    'Associate Level II',
    'Associate Level I',
    'Associate',
    'Contracts Manager',
    'Junior Associate',
    'Trainee',
];

export const LEGAL_HUB_ASSOCIATE_RANK = 5;

export function legalHubPositionRank(position: string | null | undefined, role?: string | null): number {
    if (isPartnerOrgRole(role, position))
        return 0;
    const label = normalizeReportEmployeePositionLabel(position ?? '')
        || normalizeReportEmployeePositionLabel(role ?? '');
    const key = label.trim().toLowerCase();
    if (!key)
        return 5000;
    const exact = POSITION_RANK.findIndex((title) => title.toLowerCase() === key);
    if (exact >= 0)
        return exact;
    const raw = normalizeOrgRoleKey(position || role);
    if (raw.includes('senior') && raw.includes('associate'))
        return 2;
    if (raw.includes('level ii') || raw.includes('level 2'))
        return 3;
    if (raw.includes('level i') || raw.includes('level 1'))
        return 4;
    if (raw.includes('junior'))
        return 7;
    if (raw.includes('counsel') || raw.includes('советник'))
        return 1;
    if (raw.includes('trainee') || raw.includes('стажер'))
        return 8;
    if (raw.includes('associate') || raw === 'юрист')
        return LEGAL_HUB_ASSOCIATE_RANK;
    return 5000;
}

export function canAssignLegalHubTask(
    actor: { id: number; rank: number },
    target: { id: number; rank: number },
): boolean {
    if (actor.rank === 0)
        return true;
    if (actor.id === target.id)
        return actor.rank > LEGAL_HUB_ASSOCIATE_RANK;
    if (actor.rank <= LEGAL_HUB_ASSOCIATE_RANK)
        return target.rank > actor.rank;
    return false;
}
