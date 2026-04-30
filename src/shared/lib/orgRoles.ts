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
/**
 * Пользователь считается партнёром для TT/проектов, если в орг. роли или в должности (справочник)
 * есть признак партнёра — не только точное «Партнер», но и «Ведущий партнёр», Partner и т.п.
 */
export function isPartnerOrgRole(role: string | null | undefined, position?: string | null): boolean {
    const kr = normalizeOrgRoleKey(role);
    if (kr.includes('партнер') || kr.includes('partner'))
        return true;
    const kp = normalizeOrgRoleKey(position);
    return kp.includes('партнер') || kp.includes('partner');
}

const ADMIN_PANEL_ACCESS_ROLE_KEYS = new Set(['Главный администратор', 'Администратор'].map(normalizeOrgRoleKey));

/** Доступ к основной админ-панели (/admin, карточка пользователя): администраторы и партнёры (роль или должность). */
export function canAccessAdminPanel(role: string | null | undefined, position?: string | null): boolean {
    const k = normalizeOrgRoleKey(role);
    if (ADMIN_PANEL_ACCESS_ROLE_KEYS.has(k))
        return true;
    return isPartnerOrgRole(role, position);
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
