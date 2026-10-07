export const REIMBURSEMENT_CARD_NUMBER_DIGITS = 16;
export function reimbursementCardDigits(value) {
    return String(value ?? '').replace(/\D/g, '').slice(0, REIMBURSEMENT_CARD_NUMBER_DIGITS);
}
export function formatReimbursementCardNumber(value) {
    return reimbursementCardDigits(value).replace(/(\d{4})(?=\d)/g, '$1 ');
}
export function isValidReimbursementCardNumber(value) {
    return reimbursementCardDigits(value).length === REIMBURSEMENT_CARD_NUMBER_DIGITS;
}
export function expenseHasReimbursementCard(req) {
    if (reimbursementCardDigits(req.reimbursementCardNumber).length > 0)
        return true;
    if (req.hasReimbursementCard === true)
        return true;
    if (req.hasReimbursementCard === false)
        return false;
    return isEmployeePersonalFundsPayout(req);
}
/** Сотрудник оплатил из личных средств / личной карты — фирме нужно вернуть ему деньги. */
export function isEmployeePersonalFundsPayout(req) {
    if (req.expenseType === 'partner_expense')
        return false;
    return String(req.paymentMethod ?? '').trim().toLowerCase() === 'cash';
}
/** Approved spend paid from the employee's personal cash/card — firm must reimburse them. */
export function isAwaitingEmployeeReimbursement(req) {
    return req.status === 'approved' && isEmployeePersonalFundsPayout(req);
}
/** Approved company spend paid by transfer/company card — vendor/bank payment. */
export function isAwaitingVendorPayment(req) {
    if ((req.expenseType || '').trim() === 'partner_expense')
        return false;
    return req.status === 'approved'
        && !isEmployeePersonalFundsPayout(req);
}
