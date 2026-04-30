export function normalizeOrgRoleKey(role: string | null | undefined): string {
    return (role ?? '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ');
}
export function isOfficeManagerRole(role: string | null | undefined): boolean {
    const k = normalizeOrgRoleKey(role);
    return k === 'офис менеджер';
}
/** Организационная роль «Партнёр» / Partner (учёт времени, проекты). */
export function isPartnerOrgRole(role: string | null | undefined): boolean {
    const k = normalizeOrgRoleKey(role);
    return k === 'партнер' || k === 'partner';
}
export function hasFullTicketAccessRole(role: string | null | undefined): boolean {
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
export function canViewTicketCreator(role: string | null | undefined): boolean {
    return hasFullTicketAccessRole(role);
}
