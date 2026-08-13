/** Designated user who confirms reimbursement (card payout) after approval. */
export const EXPENSE_PAYMENT_CONFIRMER_EMAIL = 'aakhmadjonov@kostalegal.com';

export function isExpensePaymentConfirmer(email: string | null | undefined): boolean {
    return (email ?? '').trim().toLowerCase() === EXPENSE_PAYMENT_CONFIRMER_EMAIL;
}
