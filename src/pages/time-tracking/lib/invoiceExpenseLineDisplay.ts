import { fetchExpenseById } from '@entities/expenses/model/expensesApi';
import { lockedExpenseUsdAmount } from '@entities/expenses/model/lockedExpenseUsdAmount';
import { roundMoney2 } from '@entities/expenses/model/expenseCurrency';
import type { InvoiceLineDto } from '@entities/time-tracking';
import { invoiceLineKindSlug } from './invoicePageShared';

/**
 * Load registry USD for invoice expense lines (by expenseRequestId).
 * Used so «Строки счёта» match the expenses list, not invoice issue-date FX.
 */
export async function loadInvoiceExpenseRegistryUsd(
    lines: readonly InvoiceLineDto[] | null | undefined,
): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const ids = [...new Set(
        (lines ?? [])
            .filter((ln) => invoiceLineKindSlug(ln) === 'expense')
            .map((ln) => (ln.expenseRequestId ?? '').trim())
            .filter(Boolean),
    )];
    await Promise.all(ids.map(async (id) => {
        try {
            const req = await fetchExpenseById(id);
            const locked = lockedExpenseUsdAmount(req);
            if (locked != null && locked > 0)
                out.set(id, locked);
        }
        catch {
            // keep invoice line amount
        }
    }));
    return out;
}

export function invoiceExpenseLineDisplayAmounts(
    ln: InvoiceLineDto,
    invoiceCurrency: string,
    registryUsdByExpenseId: ReadonlyMap<string, number>,
): { unitAmount: number; lineTotal: number } {
    const cur = (invoiceCurrency || '').trim().toUpperCase();
    const qty = Number(ln.quantity);
    const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const unit = Number(ln.unitAmount);
    const total = Number(ln.lineTotal);
    const fallbackUnit = Number.isFinite(unit) ? unit : 0;
    const fallbackTotal = Number.isFinite(total) ? total : roundMoney2(fallbackUnit * q);

    if (cur !== 'USD' || invoiceLineKindSlug(ln) !== 'expense')
        return { unitAmount: fallbackUnit, lineTotal: fallbackTotal };

    const rid = (ln.expenseRequestId ?? '').trim();
    const locked = rid ? registryUsdByExpenseId.get(rid) : undefined;
    if (locked == null || !(locked > 0))
        return { unitAmount: fallbackUnit, lineTotal: fallbackTotal };

    // Expense lines are billed as qty 1 × USD; keep qty-scaled total if qty ≠ 1.
    const unitAmount = roundMoney2(locked);
    const lineTotal = roundMoney2(unitAmount * q);
    return { unitAmount, lineTotal };
}
