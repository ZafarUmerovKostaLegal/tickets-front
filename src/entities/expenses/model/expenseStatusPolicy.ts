import { canAccessAdminOnlyModules } from '@shared/lib/orgRoles';
import { canModerateExpenseRequests } from './expenseModeration';
import type { ExpenseRequest, ExpenseStatus } from './types';

export type ExpensePayActionOpts = {
    /** Only the designated payment confirmer may mark reimbursable expenses as paid. */
    isPaymentConfirmer?: boolean;
};

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
    const authorId = expense.createdByUserId || expense.createdBy?.id;
    if (authorId == null)
        return false;
    return currentUserId === authorId;
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

/**
 * Reimbursable payout: approved → confirmer marks «Возмещено» (paid).
 * Close / «Не оплачено» lifecycle actions are not offered in the UI.
 */
export function showPayExpenseAction(
    expense: ExpenseRequest,
    blockedForOwn: boolean,
    opts?: ExpensePayActionOpts,
): boolean {
    if (blockedForOwn)
        return false;
    if (expense.status !== 'approved')
        return false;
    if (!expense.isReimbursable)
        return false;
    return Boolean(opts?.isPaymentConfirmer);
}
export type CloseExpenseUi = {
    label: string;
    confirmMessage: string;
};
/** @deprecated Close-expense actions removed from UI; always null. */
export function getCloseExpenseUi(_expense: ExpenseRequest, _blockedForOwn: boolean): CloseExpenseUi | null {
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
const DELETE_AUTHOR_STATUSES: ReadonlySet<ExpenseStatus> = new Set([
    'draft',
    'revision_required',
    'pending_approval',
    'withdrawn',
    'rejected',
]);
const DELETE_MODERATOR_FORBIDDEN: ReadonlySet<ExpenseStatus> = new Set([
    'paid',
    'closed',
]);
export function showDeleteExpenseAction(expense: ExpenseRequest, currentUserId: number | null | undefined, role: string | null | undefined): boolean {
    if (canAccessAdminOnlyModules(role))
        return true;
    if (canModerateExpenseRequests(role))
        return !DELETE_MODERATOR_FORBIDDEN.has(expense.status);
    if (!isExpenseAuthor(currentUserId, expense))
        return false;
    return DELETE_AUTHOR_STATUSES.has(expense.status);
}
export function showLifecycleModerationRow(
    expense: ExpenseRequest,
    _canModerate: boolean,
    blockedForOwn: boolean,
    opts?: ExpensePayActionOpts,
): boolean {
    if (blockedForOwn)
        return false;
    return showPayExpenseAction(expense, false, opts);
}
