import { canAccessAdminOnlyModules } from '@shared/lib/orgRoles';
import { canModerateExpenseRequests } from './expenseModeration';
import { isEmployeePersonalFundsPayout } from './expensePaymentDetails';
/** Who may mark employee payout / vendor payment as paid. */
export function canConfirmExpensePayout(expense, opts) {
    if (isEmployeePersonalFundsPayout(expense))
        return Boolean(opts?.isPaymentConfirmer || opts?.canModerate);
    // Bank transfer / company card: mark vendor payment even if the client does not reimburse.
    return Boolean(opts?.canModerate);
}
export function resolveExpensePanelMode(status) {
    return status === 'draft' || status === 'revision_required' ? 'edit' : 'view';
}
const RECEIPT_UPLOAD_ALLOWED_STATUSES = new Set([
    'pending_approval',
    'approved',
    'paid',
    'not_reimbursable',
]);
export function isReceiptUploadAllowedForExpenseStatus(status) {
    return RECEIPT_UPLOAD_ALLOWED_STATUSES.has(status);
}
export function isExpenseAuthor(currentUserId, expense) {
    if (currentUserId == null)
        return false;
    const authorId = expense.createdByUserId || expense.createdBy?.id;
    if (authorId == null)
        return false;
    return currentUserId === authorId;
}
export function isModerationBlockedForOwnExpense(canModerate, currentUserId, expense) {
    if (!canModerate)
        return false;
    return isExpenseAuthor(currentUserId, expense);
}
export function showPendingApprovalModeration(expense, canModerate, blockedForOwn) {
    return expense.status === 'pending_approval' && canModerate && !blockedForOwn;
}
export function showOwnPendingModerationBlockedHint(expense, canModerate, blockedForOwn) {
    if (expense.expenseType === 'partner_expense')
        return false;
    return expense.status === 'pending_approval' && canModerate && blockedForOwn;
}
/**
 * Employee personal-funds payout: approved → paid.
 * Cash / personal card → confirmer or registry moderator.
 * Transfer/card vendor payment → registry moderator (reimbursable or not).
 */
export function showPayExpenseAction(expense, blockedForOwn, opts) {
    if (blockedForOwn)
        return false;
    if (expense.status !== 'approved')
        return false;
    return canConfirmExpensePayout(expense, opts);
}
export function showUnpayExpenseAction(expense, blockedForOwn, opts) {
    if (blockedForOwn)
        return false;
    if (expense.status !== 'paid')
        return false;
    return canConfirmExpensePayout(expense, opts);
}
export function showUnapproveExpenseAction(expense, canModerate, blockedForOwn) {
    if (blockedForOwn || !canModerate)
        return false;
    return expense.status === 'approved';
}
/** @deprecated Close-expense actions removed from UI; always null. */
export function getCloseExpenseUi(_expense, _blockedForOwn) {
    return null;
}
const WITHDRAW_FORBIDDEN = new Set([
    'paid',
    'closed',
    'rejected',
    'withdrawn',
]);
export function showWithdrawExpenseAction(expense, currentUserId) {
    if (!isExpenseAuthor(currentUserId, expense))
        return false;
    return !WITHDRAW_FORBIDDEN.has(expense.status);
}
const DELETE_AUTHOR_STATUSES = new Set([
    'draft',
    'revision_required',
    'pending_approval',
    'withdrawn',
    'rejected',
]);
const DELETE_MODERATOR_FORBIDDEN = new Set([
    'paid',
    'closed',
]);
export function showDeleteExpenseAction(expense, currentUserId, role) {
    if (canAccessAdminOnlyModules(role))
        return true;
    if (canModerateExpenseRequests(role))
        return !DELETE_MODERATOR_FORBIDDEN.has(expense.status);
    if (!isExpenseAuthor(currentUserId, expense))
        return false;
    return DELETE_AUTHOR_STATUSES.has(expense.status);
}
export function showLifecycleModerationRow(expense, canModerate, blockedForOwn, opts) {
    if (blockedForOwn)
        return false;
    return (showPayExpenseAction(expense, false, opts)
        || showUnpayExpenseAction(expense, false, opts)
        || showUnapproveExpenseAction(expense, canModerate, false));
}
