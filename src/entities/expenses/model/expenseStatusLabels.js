import { STATUS_META } from './constants';
import { isAwaitingEmployeeReimbursement, isAwaitingVendorPayment, isEmployeePersonalFundsPayout, } from './expensePaymentDetails';
export const AWAITING_PAYMENT_STATUS_FILTER = 'awaiting_payment';
export const AWAITING_REIMBURSEMENT_STATUS_FILTER = 'awaiting_reimbursement';
export const EXPENSE_STATUS_FILTER_OPTIONS = [
    { value: 'draft', label: STATUS_META.draft.label },
    { value: 'pending_approval', label: STATUS_META.pending_approval.label },
    { value: 'revision_required', label: STATUS_META.revision_required.label },
    { value: 'approved', label: STATUS_META.approved.label },
    { value: AWAITING_REIMBURSEMENT_STATUS_FILTER, label: 'Ожидает компенсацию' },
    { value: AWAITING_PAYMENT_STATUS_FILTER, label: 'Ожидает оплаты' },
    { value: 'paid', label: STATUS_META.paid.label },
    { value: 'rejected', label: STATUS_META.rejected.label },
    { value: 'withdrawn', label: STATUS_META.withdrawn.label },
];
const SYNTHETIC_STATUS_FILTERS = new Set([
    AWAITING_PAYMENT_STATUS_FILTER,
    AWAITING_REIMBURSEMENT_STATUS_FILTER,
]);
export function isSyntheticExpenseStatusFilter(value) {
    return SYNTHETIC_STATUS_FILTERS.has(value);
}
export function expenseUiStatusFilterLabel(filter) {
    if (!filter)
        return 'Статус';
    if (filter === AWAITING_REIMBURSEMENT_STATUS_FILTER)
        return 'Ожидает компенсацию';
    if (filter === AWAITING_PAYMENT_STATUS_FILTER)
        return 'Ожидает оплаты';
    return STATUS_META[filter]?.label ?? filter;
}
export function isExpensesUiStatusFilter(value) {
    return EXPENSE_STATUS_FILTER_OPTIONS.some((item) => item.value === value);
}
export function expenseStatusBadgeClass(expense) {
    const base = `exp-status exp-status--${expense.status}`;
    if (isAwaitingEmployeeReimbursement(expense))
        return `${base} exp-status--awaiting_reimbursement`;
    if (isAwaitingVendorPayment(expense))
        return `${base} exp-status--awaiting_payment`;
    return base;
}
/** Human-readable status: employee personal-funds payout vs vendor payment. */
export function expenseStatusLabel(expense) {
    const status = expense.status;
    const reimbursable = Boolean(expense.isReimbursable);
    if (isAwaitingEmployeeReimbursement(expense))
        return 'Ожидает компенсацию';
    if (status === 'paid' && isEmployeePersonalFundsPayout(expense))
        return 'Возмещено';
    if (isAwaitingVendorPayment(expense))
        return 'Ожидает оплаты';
    if (status === 'paid' && reimbursable)
        return 'Оплачено';
    return STATUS_META[status]?.label ?? status;
}
export function expensePayActionLabel(expense) {
    if (isEmployeePersonalFundsPayout(expense))
        return 'Возмещено';
    return 'Оплачено';
}
