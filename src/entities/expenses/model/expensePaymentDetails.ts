export const REIMBURSEMENT_CARD_NUMBER_DIGITS = 16;

export function reimbursementCardDigits(value: string | null | undefined): string {
    return String(value ?? '').replace(/\D/g, '').slice(0, REIMBURSEMENT_CARD_NUMBER_DIGITS);
}

export function formatReimbursementCardNumber(value: string | null | undefined): string {
    return reimbursementCardDigits(value).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function isValidReimbursementCardNumber(value: string | null | undefined): boolean {
    return reimbursementCardDigits(value).length === REIMBURSEMENT_CARD_NUMBER_DIGITS;
}
