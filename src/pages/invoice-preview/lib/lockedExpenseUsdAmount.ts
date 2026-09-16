import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { roundMoney2 } from '@entities/expenses/model/expenseCurrency';
import type { ExpenseRequest } from '@entities/expenses/model/types';

/**
 * USD billed for an expense must match the expenses registry, not a later invoice FX
 * re-conversion which under/overstates the line.
 *
 * Registry UI prefers `equivalentAmount`, then UZS÷CBU. When both exist and disagree
 * (stale equivalent vs updated rate, or the reverse), take the larger so the invoice
 * does not understate either registry signal.
 */
export function lockedExpenseUsdAmount(
    req: Pick<ExpenseRequest, 'amountUzs' | 'exchangeRate' | 'equivalentAmount'>,
): number | null {
    const eq = asExpenseNumber(req.equivalentAmount);
    const fromEq = eq > 0 ? roundMoney2(eq) : null;

    const uzs = asExpenseNumber(req.amountUzs);
    const rate = asExpenseNumber(req.exchangeRate);
    const fromRate = uzs > 0 && rate > 0 ? roundMoney2(uzs / rate) : null;

    if (fromEq != null && fromRate != null)
        return Math.max(fromEq, fromRate);
    if (fromEq != null)
        return fromEq;
    if (fromRate != null)
        return fromRate;
    return null;
}
