export function normalizeOrgRoleKey(role) {
    return (role ?? '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ');
}
export function isOfficeManagerRole(role) {
    const k = normalizeOrgRoleKey(role);
    return k === 'офис менеджер';
}
export function isPartnerOrgRole(role, position) {
    const kr = normalizeOrgRoleKey(role);
    if (kr.includes('партнер') || kr.includes('partner'))
        return true;
    const kp = normalizeOrgRoleKey(position);
    return kp.includes('партнер') || kp.includes('partner');
}
const ADMIN_PANEL_ACCESS_ROLE_KEYS = new Set(['Главный администратор', 'Администратор'].map(normalizeOrgRoleKey));
export function canAccessAdminPanel(role, position) {
    const k = normalizeOrgRoleKey(role);
    if (ADMIN_PANEL_ACCESS_ROLE_KEYS.has(k))
        return true;
    return isPartnerOrgRole(role, position);
}
export function canAccessAdminOnlyModules(role) {
    return ADMIN_PANEL_ACCESS_ROLE_KEYS.has(normalizeOrgRoleKey(role));
}
export function canAccessAttendance(role, position) {
    const k = normalizeOrgRoleKey(role);
    if (k.includes('администратор'))
        return true;
    return isPartnerOrgRole(role, position);
}
export function hasFullTicketAccessRole(role) {
    const k = normalizeOrgRoleKey(role);
    if (isOfficeManagerRole(role))
        return true;
    if (k.includes('it'))
        return true;
    if (k === 'администратор' || k === 'главный администратор')
        return true;
    if (k.includes('партнер') || k.includes('партнёр'))
        return true;
    return false;
}
export function canViewTicketCreator(role) {
    return hasFullTicketAccessRole(role);
}
