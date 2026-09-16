import { asExpenseNumber } from './coerceExpense';
import { roundMoney2 } from './expenseCurrency';
import type { ExpenseRequest } from './types';

/** CBU UZS-per-USD rates are thousands; reject inverted / garbage rates. */
function plausibleUzsPerUsd(rate: number): boolean {
    return Number.isFinite(rate) && rate >= 100 && rate <= 200_000;
}

/**
 * USD billed for an expense must match the expenses registry column
 * (`equivalentAmount`), same as ExpensesPanel — not a later invoice FX snapshot.
 */
export function lockedExpenseUsdAmount(
    req: Pick<ExpenseRequest, 'amountUzs' | 'exchangeRate' | 'equivalentAmount'>,
): number | null {
    const eq = asExpenseNumber(req.equivalentAmount);
    if (eq > 0 && eq < 1_000_000)
        return roundMoney2(eq);

    const uzs = asExpenseNumber(req.amountUzs);
    const rate = asExpenseNumber(req.exchangeRate);
    if (uzs > 0 && plausibleUzsPerUsd(rate)) {
        const fromRate = roundMoney2(uzs / rate);
        if (fromRate > 0 && fromRate < 1_000_000)
            return fromRate;
    }
    return null;
}
