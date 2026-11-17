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
