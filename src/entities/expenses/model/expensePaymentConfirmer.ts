/** Designated users who confirm employee personal-card payouts after approval. */
export const EXPENSE_PAYMENT_CONFIRMER_EMAIL = 'aakhmadjonov@kostalegal.com';
export const EXPENSE_PAYMENT_CONFIRMER_EMAILS = [
    EXPENSE_PAYMENT_CONFIRMER_EMAIL,
    'testeracc@kostalegal.com',
] as const;

const CONFIRMER_EMAILS = new Set(EXPENSE_PAYMENT_CONFIRMER_EMAILS.map((email) => email.toLowerCase()));
const CONFIRMER_LOCAL_PARTS = new Set(
    [...CONFIRMER_EMAILS].map((email) => email.split('@', 1)[0] ?? email),
);

function identityLooksLikeConfirmer(value: string | null | undefined): boolean {
    const raw = (value ?? '').trim().toLowerCase();
    if (!raw)
        return false;
    if (CONFIRMER_EMAILS.has(raw))
        return true;
    const local = raw.includes('@') ? (raw.split('@', 1)[0] ?? raw) : raw;
    return CONFIRMER_LOCAL_PARTS.has(local);
}

export function isExpensePaymentConfirmer(
    email: string | null | undefined,
    extra?: { displayName?: string | null },
): boolean {
    if (identityLooksLikeConfirmer(email))
        return true;
    return identityLooksLikeConfirmer(extra?.displayName);
}
