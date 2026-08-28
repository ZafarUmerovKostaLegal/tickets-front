import { canAccessAdminOnlyModules } from '@shared/lib/orgRoles';
import { canModerateExpenseRequests } from './expenseModeration';
import { isEmployeePersonalFundsPayout } from './expensePaymentDetails';
import type { ExpenseRequest, ExpenseStatus } from './types';

export type ExpensePayActionOpts = {
    /** Designated payment confirmer (cash reimbursements). */
    isPaymentConfirmer?: boolean;
    /** Registry moderator (admin / partner) — vendor payment and employee reimbursement. */
    canModerate?: boolean;
};

/** Who may mark employee payout / vendor payment as paid. */
export function canConfirmExpensePayout(
    expense: ExpenseRequest,
    opts?: ExpensePayActionOpts,
): boolean {
    if (isEmployeePersonalFundsPayout(expense))
        return Boolean(opts?.isPaymentConfirmer || opts?.canModerate);
    if (!expense.isReimbursable)
        return false;
    // transfer, card, or unknown non-cash → registry moderators
    return Boolean(opts?.canModerate);
}

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
 * Employee personal-funds payout: approved → paid.
 * Cash / personal card → confirmer or registry moderator.
 * Transfer/card vendor payment → registry moderator, reimbursable only.
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
    return canConfirmExpensePayout(expense, opts);
}

export function showUnpayExpenseAction(
    expense: ExpenseRequest,
    blockedForOwn: boolean,
    opts?: ExpensePayActionOpts,
): boolean {
    if (blockedForOwn)
        return false;
    if (expense.status !== 'paid')
        return false;
    return canConfirmExpensePayout(expense, opts);
}

export function showUnapproveExpenseAction(
    expense: ExpenseRequest,
    canModerate: boolean,
    blockedForOwn: boolean,
): boolean {
    if (blockedForOwn || !canModerate)
        return false;
    return expense.status === 'approved';
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
    canModerate: boolean,
    blockedForOwn: boolean,
    opts?: ExpensePayActionOpts,
): boolean {
    if (blockedForOwn)
        return false;
    return (
        showPayExpenseAction(expense, false, opts)
        || showUnpayExpenseAction(expense, false, opts)
        || showUnapproveExpenseAction(expense, canModerate, false)
    );
}
