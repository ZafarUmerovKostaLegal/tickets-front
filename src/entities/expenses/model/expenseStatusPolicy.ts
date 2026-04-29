import type { ExpenseRequest, ExpenseStatus } from './types';
export function resolveExpensePanelMode(status: ExpenseStatus): 'edit' | 'view' {
    return status === 'draft' || status === 'revision_required' ? 'edit' : 'view';
}
const RECEIPT_UPLOAD_ALLOWED_STATUSES: ReadonlySet<ExpenseStatus> = new Set([
    'pending_approval',
    'approved',
    'paid',
    'not_reimbursable',
]);
export function isReceiptUploadAllowedForExpenseStatus(status: ExpenseStatus): boolean {
    return RECEIPT_UPLOAD_ALLOWED_STATUSES.has(status);
}
export function isExpenseAuthor(currentUserId: number | null | undefined, expense: ExpenseRequest): boolean {
    if (currentUserId == null)
        return false;
    return currentUserId === expense.createdByUserId;
}
export function isModerationBlockedForOwnExpense(canModerate: boolean, currentUserId: number | null | undefined, expense: ExpenseRequest): boolean {
    if (!canModerate)
        return false;
    return isExpenseAuthor(currentUserId, expense);
}
export function showPendingApprovalModeration(expense: ExpenseRequest, canModerate: boolean, blockedForOwn: boolean): boolean {
    return expense.status === 'pending_approval' && canModerate && !blockedForOwn;
}
export function showOwnPendingModerationBlockedHint(expense: ExpenseRequest, canModerate: boolean, blockedForOwn: boolean): boolean {
    if (expense.expenseType === 'partner_expense')
        return false;
    return expense.status === 'pending_approval' && canModerate && blockedForOwn;
}
export function showPayExpenseAction(expense: ExpenseRequest, blockedForOwn: boolean): boolean {
    if (blockedForOwn)
        return false;
    return expense.status === 'approved';
}
export type CloseExpenseUi = {
    label: string;
    confirmMessage: string;
};
export function getCloseExpenseUi(expense: ExpenseRequest, blockedForOwn: boolean): CloseExpenseUi | null {
    if (blockedForOwn)
        return null;
    const { status, isReimbursable } = expense;
    if (status === 'paid' || status === 'not_reimbursable') {
        return {
            label: 'Закрыть',
            confirmMessage: 'Закрыть заявку? Статус станет «Закрыто».',
        };
    }
    if (status === 'approved' && !isReimbursable) {
        return {
            label: 'Не оплачено',
            confirmMessage: 'Завершить заявку без оплаты со стороны компании? Статус станет «Невозмещаемый».',
        };
    }
    return null;
}
const WITHDRAW_FORBIDDEN: ReadonlySet<ExpenseStatus> = new Set([
    'paid',
    'closed',
    'rejected',
    'withdrawn',
]);
export function showWithdrawExpenseAction(expense: ExpenseRequest, currentUserId: number | null | undefined): boolean {
    if (!isExpenseAuthor(currentUserId, expense))
        return false;
    return !WITHDRAW_FORBIDDEN.has(expense.status);
}
export function showLifecycleModerationRow(expense: ExpenseRequest, canModerate: boolean, blockedForOwn: boolean): boolean {
    if (!canModerate || blockedForOwn)
        return false;
    return showPayExpenseAction(expense, false) || getCloseExpenseUi(expense, false) != null;
}
