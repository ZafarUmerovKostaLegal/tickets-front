import { STATUS_META } from './constants';
import {
    isAwaitingEmployeeReimbursement,
    isAwaitingVendorPayment,
    isEmployeePersonalFundsPayout,
} from './expensePaymentDetails';
import type { ExpenseRequest, ExpenseStatus } from './types';

export const AWAITING_PAYMENT_STATUS_FILTER = 'awaiting_payment' as const;
export const AWAITING_REIMBURSEMENT_STATUS_FILTER = 'awaiting_reimbursement' as const;
export type ExpensesUiStatusFilter =
    | ExpenseStatus
    | typeof AWAITING_PAYMENT_STATUS_FILTER
    | typeof AWAITING_REIMBURSEMENT_STATUS_FILTER;

export const EXPENSE_STATUS_FILTER_OPTIONS: ReadonlyArray<{
    value: ExpensesUiStatusFilter;
    label: string;
}> = [
    { value: 'draft', label: STATUS_META.draft.label },
    { value: 'pending_approval', label: STATUS_META.pending_approval.label },
    { value: 'revision_required', label: STATUS_META.revision_required.label },
    { value: 'approved', label: STATUS_META.approved.label },
    { value: AWAITING_REIMBURSEMENT_STATUS_FILTER, label: 'Ожидает возмещения' },
    { value: AWAITING_PAYMENT_STATUS_FILTER, label: 'Ожидает оплаты' },
    { value: 'paid', label: STATUS_META.paid.label },
    { value: 'rejected', label: STATUS_META.rejected.label },
    { value: 'withdrawn', label: STATUS_META.withdrawn.label },
];

const SYNTHETIC_STATUS_FILTERS = new Set<string>([
    AWAITING_PAYMENT_STATUS_FILTER,
    AWAITING_REIMBURSEMENT_STATUS_FILTER,
]);

export function isSyntheticExpenseStatusFilter(value: string): boolean {
    return SYNTHETIC_STATUS_FILTERS.has(value);
}

export function expenseUiStatusFilterLabel(filter: ExpensesUiStatusFilter | ''): string {
    if (!filter)
        return 'Статус';
    if (filter === AWAITING_REIMBURSEMENT_STATUS_FILTER)
        return 'Ожидает возмещения';
    if (filter === AWAITING_PAYMENT_STATUS_FILTER)
        return 'Ожидает оплаты';
    return STATUS_META[filter]?.label ?? filter;
}

export function isExpensesUiStatusFilter(value: string): value is ExpensesUiStatusFilter {
    return EXPENSE_STATUS_FILTER_OPTIONS.some((item) => item.value === value);
}

export function expenseStatusBadgeClass(
    expense: Pick<ExpenseRequest, 'status' | 'isReimbursable' | 'paymentMethod' | 'expenseType'> | {
        status: ExpenseStatus;
        isReimbursable?: boolean;
        paymentMethod?: string | null;
        expenseType?: string | null;
    },
): string {
    const base = `exp-status exp-status--${expense.status}`;
    if (isAwaitingEmployeeReimbursement(expense))
        return `${base} exp-status--awaiting_reimbursement`;
    if (isAwaitingVendorPayment(expense))
        return `${base} exp-status--awaiting_payment`;
    return base;
}

/** Human-readable status: employee personal-funds payout vs vendor payment. */
export function expenseStatusLabel(
    expense: Pick<ExpenseRequest, 'status' | 'isReimbursable' | 'paymentMethod' | 'expenseType'> | { status: ExpenseStatus; isReimbursable?: boolean; paymentMethod?: string | null; expenseType?: string | null },
): string {
    const status = expense.status;
    const reimbursable = Boolean(expense.isReimbursable);
    if (isAwaitingEmployeeReimbursement(expense))
        return 'Ожидает возмещения';
    if (status === 'paid' && isEmployeePersonalFundsPayout(expense))
        return 'Возмещено';
    if (isAwaitingVendorPayment(expense))
        return 'Ожидает оплаты';
    if (status === 'paid' && reimbursable)
        return 'Оплачено';
    return STATUS_META[status]?.label ?? status;
}

export function expensePayActionLabel(
    expense: Pick<ExpenseRequest, 'isReimbursable' | 'paymentMethod' | 'expenseType'>,
): string {
    if (isEmployeePersonalFundsPayout(expense))
        return 'Возмещено';
    return 'Оплачено';
}
