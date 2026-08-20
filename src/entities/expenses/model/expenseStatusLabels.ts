import { STATUS_META } from './constants';
import type { ExpenseRequest, ExpenseStatus } from './types';

function paymentMethodOf(expense: Pick<ExpenseRequest, 'paymentMethod'> | { paymentMethod?: string | null }): string {
    return String(expense.paymentMethod ?? '').trim().toLowerCase();
}

/** Human-readable status for reimbursable payout flow. */
export function expenseStatusLabel(
    expense: Pick<ExpenseRequest, 'status' | 'isReimbursable' | 'paymentMethod'> | { status: ExpenseStatus; isReimbursable?: boolean; paymentMethod?: string | null },
): string {
    const status = expense.status;
    const reimbursable = Boolean(expense.isReimbursable);
    const method = paymentMethodOf(expense);
    if (status === 'approved' && reimbursable) {
        return method === 'cash' ? 'Ожидает возмещения' : 'Ожидает оплаты';
    }
    if (status === 'paid' && reimbursable) {
        return method === 'cash' ? 'Возмещено' : 'Оплачено';
    }
    return STATUS_META[status]?.label ?? status;
}

export function expensePayActionLabel(
    expense: Pick<ExpenseRequest, 'isReimbursable' | 'paymentMethod'>,
): string {
    if (!expense.isReimbursable)
        return 'Оплачено';
    return paymentMethodOf(expense) === 'cash' ? 'Возмещено' : 'Оплачено';
}
