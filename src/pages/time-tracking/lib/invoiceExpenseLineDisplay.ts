import { fetchExpenseById } from '@entities/expenses/model/expensesApi';
import { lockedExpenseUsdAmount } from '@entities/expenses/model/lockedExpenseUsdAmount';
import { roundMoney2 } from '@entities/expenses/model/expenseCurrency';
import type { InvoiceLineDto } from '@entities/time-tracking';
import { invoiceLineKindSlug } from './invoicePageShared';

const missingExpenseIds = new Set<string>();

async function mapWithLimit<T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next];
            next += 1;
            await run(item);
        }
    });
    await Promise.all(workers);
}

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
            .filter((id) => id && !missingExpenseIds.has(id)),
    )];
    await mapWithLimit(ids, 4, async (id) => {
        try {
            const req = await fetchExpenseById(id);
            const locked = lockedExpenseUsdAmount(req);
            if (locked != null && locked > 0)
                out.set(id, locked);
        }
        catch {
            missingExpenseIds.add(id);
        }
    });
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

/**
 * KPI totals: rebuild from displayed line amounts so «Сумма» and «Остаток» never drift.
 * Expense lines use registry USD when available; residual keeps tax/discount from server total.
 */
export function invoiceDisplayMoneyTotals(
    invoice: {
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
        currency: string;
        lines?: readonly InvoiceLineDto[] | null;
    },
    registryUsdByExpenseId: ReadonlyMap<string, number>,
): { totalAmount: number; balanceDue: number } {
    const base = Number(invoice.totalAmount);
    const paid = Number(invoice.amountPaid);
    const paidSafe = Number.isFinite(paid) ? paid : 0;
    const lines = invoice.lines ?? [];

    let storedLinesSum = 0;
    let displayLinesSum = 0;
    for (const ln of lines) {
        const stored = Number(ln.lineTotal);
        const storedSafe = Number.isFinite(stored) ? stored : 0;
        storedLinesSum += storedSafe;
        displayLinesSum += invoiceExpenseLineDisplayAmounts(
            ln,
            invoice.currency,
            registryUsdByExpenseId,
        ).lineTotal;
    }
    storedLinesSum = roundMoney2(storedLinesSum);
    displayLinesSum = roundMoney2(displayLinesSum);

    let totalAmount: number;
    if (Number.isFinite(base) && lines.length > 0) {
        // Preserve tax/discount (total − sum of stored lines), apply display line amounts.
        const residual = roundMoney2(base - storedLinesSum);
        totalAmount = roundMoney2(displayLinesSum + residual);
    }
    else if (Number.isFinite(base)) {
        totalAmount = roundMoney2(base);
    }
    else if (lines.length > 0) {
        totalAmount = displayLinesSum;
    }
    else {
        return {
            totalAmount: 0,
            balanceDue: 0,
        };
    }

    const balanceDue = roundMoney2(Math.max(0, totalAmount - paidSafe));
    return { totalAmount, balanceDue };
}
