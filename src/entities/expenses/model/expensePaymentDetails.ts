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

export function expenseHasReimbursementCard(req: {
    hasReimbursementCard?: boolean | null;
    reimbursementCardNumber?: string | null;
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    if (reimbursementCardDigits(req.reimbursementCardNumber).length > 0)
        return true;
    if (req.hasReimbursementCard === true)
        return true;
    if (req.hasReimbursementCard === false)
        return false;
    return isEmployeePersonalFundsPayout(req);
}

export function isEmployeePersonalFundsPayout(req: {
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    if (req.expenseType === 'partner_expense')
        return false;
    return String(req.paymentMethod ?? '').trim().toLowerCase() === 'cash';
}

export function isAwaitingEmployeeReimbursement(req: {
    status?: string | null;
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    return req.status === 'approved' && isEmployeePersonalFundsPayout(req);
}

export function isAwaitingVendorPayment(req: {
    status?: string | null;
    isReimbursable?: boolean | null;
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    if ((req.expenseType || '').trim() === 'partner_expense')
        return false;
    return req.status === 'approved'
        && !isEmployeePersonalFundsPayout(req);
}

export function isOfficeCorporateCardPayment(req: {
    paymentMethod?: string | null;
}): boolean {
    return String(req.paymentMethod ?? '').trim().toLowerCase() === 'card';
}

export function shouldHideCorporateCardFromCompanyMainList(req: {
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    if (!isOfficeCorporateCardPayment(req))
        return false;
    return String(req.expenseType ?? '').trim() !== 'client_expense';
}

export function belongsInCorporateCardSection(req: {
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    return shouldHideCorporateCardFromCompanyMainList(req);
}
