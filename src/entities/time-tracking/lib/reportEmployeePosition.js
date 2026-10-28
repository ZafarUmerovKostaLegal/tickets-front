import { isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';
const REPORT_POSITION_LABELS = {
    partner: 'Partner',
    партнер: 'Partner',
    counsel: 'Counsel',
    'senior associate': 'Senior Associate',
    associate: 'Associate',
    'junior associate': 'Junior Associate',
    trainee: 'Trainee',
    'contracts manager': 'Contracts Manager',
};
export function normalizeReportEmployeePositionLabel(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return '';
    const key = normalizeOrgRoleKey(trimmed);
    return REPORT_POSITION_LABELS[key] ?? trimmed;
}
export function resolveReportEmployeePosition(params) {
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
