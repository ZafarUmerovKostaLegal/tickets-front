import { STATUS_META } from './constants';
import type { ExpenseRequest, ExpenseStatus } from './types';

/** Human-readable status for reimbursable payout flow. */
export function expenseStatusLabel(
    expense: Pick<ExpenseRequest, 'status' | 'isReimbursable'> | { status: ExpenseStatus; isReimbursable?: boolean },
): string {
    const status = expense.status;
    const reimbursable = Boolean(expense.isReimbursable);
    if (status === 'approved' && reimbursable)
        return 'Ожидает возмещения';
    if (status === 'paid' && reimbursable)
        return 'Возмещено';
    return STATUS_META[status]?.label ?? status;
}

export function expensePayActionLabel(expense: Pick<ExpenseRequest, 'isReimbursable'>): string {
    return expense.isReimbursable ? 'Возмещено' : 'Оплачено';
}
