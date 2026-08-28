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

/** Сотрудник оплатил из личных средств / личной карты — фирме нужно вернуть ему деньги. */
export function isEmployeePersonalFundsPayout(req: {
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    if (req.expenseType === 'partner_expense')
        return false;
    return String(req.paymentMethod ?? '').trim().toLowerCase() === 'cash';
}

/** Approved spend paid from the employee's personal cash/card — firm must reimburse them. */
export function isAwaitingEmployeeReimbursement(req: {
    status?: string | null;
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    return req.status === 'approved' && isEmployeePersonalFundsPayout(req);
}

/** Approved reimbursable spend that is not a personal-card payout — vendor/bank payment. */
export function isAwaitingVendorPayment(req: {
    status?: string | null;
    isReimbursable?: boolean | null;
    paymentMethod?: string | null;
    expenseType?: string | null;
}): boolean {
    return req.status === 'approved'
        && Boolean(req.isReimbursable)
        && !isEmployeePersonalFundsPayout(req);
}
