import { isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';

const REPORT_POSITION_LABELS: Record<string, string> = {
    partner: 'Partner',
    партнер: 'Partner',
    counsel: 'Counsel',
    'senior associate': 'Senior Associate',
    associate: 'Associate',
    'junior associate': 'Junior Associate',
    trainee: 'Trainee',
    'contracts manager': 'Contracts Manager',
};

export function normalizeReportEmployeePositionLabel(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed)
        return '';
    const key = normalizeOrgRoleKey(trimmed);
    return REPORT_POSITION_LABELS[key] ?? trimmed;
}

export function resolveReportEmployeePosition(params: {
    entryPosition?: string | null;
    userPosition?: string | null;
    userRole?: string | null;
}): string {
    const fromEntry = normalizeReportEmployeePositionLabel(params.entryPosition ?? '');
    if (fromEntry)
        return fromEntry;
    const profilePosition = normalizeReportEmployeePositionLabel(params.userPosition ?? '');
    if (profilePosition)
        return profilePosition;
    if (isPartnerOrgRole(params.userRole, params.userPosition))
        return 'Partner';
    const fromRole = normalizeReportEmployeePositionLabel(params.userRole ?? '');
    if (fromRole)
        return fromRole;
    return '';
}
