/**
 * Управляющий партнёр — вторая, обязательная ступень согласования отсутствий
 * и адресат заявления в PDF. Источник правды — бэкенд
 * (VACATION_MANAGING_PARTNER_EMAIL / _NAME), который присылает эти данные
 * в каждой заявке; константы нужны там, где заявок под рукой ещё нет —
 * например, при показе вкладки «На согласование».
 */
export const VACATION_MANAGING_PARTNER_EMAIL = 'aakhmadjonov@kostalegal.com';
export const VACATION_MANAGING_PARTNER_NAME = 'Azizbek Akhmadjonov';

export function isVacationManagingPartner(
    email: string | null | undefined,
    configuredEmail?: string | null,
): boolean {
    const target = (configuredEmail?.trim() || VACATION_MANAGING_PARTNER_EMAIL).toLowerCase();
    const mine = email?.trim().toLowerCase();
    return Boolean(mine && target && mine === target);
}
