import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import { roundMoney2 } from '@entities/expenses/model/expenseCurrency';
import type { ExpenseRequest } from '@entities/expenses/model/types';

/**
 * USD billed for an expense must match the registry (amountUzs ÷ expense CBU rate),
 * not a later invoice FX re-conversion which under/overstates the line.
 */
export function lockedExpenseUsdAmount(
    req: Pick<ExpenseRequest, 'amountUzs' | 'exchangeRate' | 'equivalentAmount'>,
): number | null {
    const uzs = asExpenseNumber(req.amountUzs);
    const rate = asExpenseNumber(req.exchangeRate);
    if (uzs > 0 && rate > 0)
        return roundMoney2(uzs / rate);
    const eq = asExpenseNumber(req.equivalentAmount);
    if (eq > 0)
        return roundMoney2(eq);
    return null;
}
