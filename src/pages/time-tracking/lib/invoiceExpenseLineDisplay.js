import { fetchExpenseById } from '@entities/expenses/model/expensesApi';
import { lockedExpenseUsdAmount } from '@entities/expenses/model/lockedExpenseUsdAmount';
import { roundMoney2 } from '@entities/expenses/model/expenseCurrency';
import { getInvoice } from '@entities/time-tracking/api/domains/invoices';
const missingExpenseIds = new Set();
/** FX / float noise between server total and sum(lines); real tax/discount is larger. */
const DISPLAY_TOTAL_RESIDUAL_EPS = 0.02;
function lineKindSlug(ln) {
    const k = (ln.lineKind ?? '').toLowerCase().trim();
    if (k === 'time' || Boolean(ln.timeEntryId))
        return 'time';
    if (k === 'expense' || Boolean(ln.expenseRequestId))
        return 'expense';
    if (k === 'manual')
        return 'manual';
    return 'other';
}
async function mapWithLimit(items, limit, run) {
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
 * Manual billed lines + zeroed time/expense linkage — registry must not re-add
 * expense USD onto intentionally zeroed expense rows.
 */
export function invoiceHasBilledOverrideLines(lines) {
    const all = lines ?? [];
    const zeroTimeExpense = all.filter((ln) => {
        const slug = lineKindSlug(ln);
        if (slug !== 'time' && slug !== 'expense')
            return false;
        return Math.abs(Number(ln.lineTotal) || 0) < 1e-9;
    });
    const moneyManual = all.filter((ln) => {
        return lineKindSlug(ln) === 'manual' && Math.abs(Number(ln.lineTotal) || 0) > 1e-9;
    });
    return moneyManual.length > 0 && zeroTimeExpense.length > 0;
}
/**
 * Load registry USD for invoice expense lines (by expenseRequestId).
 * Used so «Строки счёта» match the expenses list, not invoice issue-date FX.
 */
export async function loadInvoiceExpenseRegistryUsd(lines) {
    const out = new Map();
    const ids = [...new Set((lines ?? [])
            .filter((ln) => lineKindSlug(ln) === 'expense')
            .map((ln) => (ln.expenseRequestId ?? '').trim())
            .filter((id) => id && !missingExpenseIds.has(id)))];
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
export function invoiceExpenseLineDisplayAmounts(ln, invoiceCurrency, registryUsdByExpenseId, opts) {
    const cur = (invoiceCurrency || '').trim().toUpperCase();
    const qty = Number(ln.quantity);
    const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const unit = Number(ln.unitAmount);
    const total = Number(ln.lineTotal);
    const fallbackUnit = Number.isFinite(unit) ? unit : 0;
    const fallbackTotal = Number.isFinite(total) ? total : roundMoney2(fallbackUnit * q);
    if (cur !== 'USD' || lineKindSlug(ln) !== 'expense')
        return { unitAmount: fallbackUnit, lineTotal: fallbackTotal };
    if (opts?.skipRegistryForZeroExpense && Math.abs(fallbackTotal) < 1e-9)
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
 * Expense lines use registry USD when available; residual keeps real tax/discount only.
 */
export function invoiceDisplayMoneyTotals(invoice, registryUsdByExpenseId) {
    const base = Number(invoice.totalAmount);
    const paid = Number(invoice.amountPaid);
    const paidSafe = Number.isFinite(paid) ? paid : 0;
    const lines = invoice.lines ?? [];
    const skipRegistryForZeroExpense = invoiceHasBilledOverrideLines(lines);
    let storedLinesSum = 0;
    let displayLinesSum = 0;
    for (const ln of lines) {
        const stored = Number(ln.lineTotal);
        const storedSafe = Number.isFinite(stored) ? stored : 0;
        storedLinesSum += storedSafe;
        displayLinesSum += invoiceExpenseLineDisplayAmounts(ln, invoice.currency, registryUsdByExpenseId, { skipRegistryForZeroExpense }).lineTotal;
    }
    storedLinesSum = roundMoney2(storedLinesSum);
    displayLinesSum = roundMoney2(displayLinesSum);
    let totalAmount;
    if (Number.isFinite(base) && lines.length > 0) {
        // Preserve tax/discount (total − sum of stored lines), apply display line amounts.
        // Drop sub-cent / FX noise so server 596.61 with lines 596.60 becomes 596.60.
        const residual = roundMoney2(base - storedLinesSum);
        const residualSafe = Math.abs(residual) <= DISPLAY_TOTAL_RESIDUAL_EPS ? 0 : residual;
        totalAmount = roundMoney2(displayLinesSum + residualSafe);
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
/** Apply registry-based display totals onto an invoice DTO (list / PDF / cover). */
export function withInvoiceDisplayMoney(invoice, registryUsdByExpenseId) {
    const money = invoiceDisplayMoneyTotals(invoice, registryUsdByExpenseId);
    if (money.totalAmount === invoice.totalAmount
        && money.balanceDue === invoice.balanceDue) {
        return invoice;
    }
    return {
        ...invoice,
        totalAmount: money.totalAmount,
        balanceDue: money.balanceDue,
    };
}
export async function resolveInvoiceDisplayMoney(invoice) {
    const registry = await loadInvoiceExpenseRegistryUsd(invoice.lines);
    return invoiceDisplayMoneyTotals(invoice, registry);
}
/**
 * Correct list/detail money for USD invoices using lines + expense registry.
 * Fetches full invoice when the list row has no lines.
 */
export async function enrichInvoiceWithDisplayMoney(invoice) {
    const cur = (invoice.currency || '').trim().toUpperCase();
    if (cur !== 'USD')
        return invoice;
    let inv = invoice;
    if (!(inv.lines?.length)) {
        try {
            inv = await getInvoice(inv.id, false);
        }
        catch {
            return invoice;
        }
    }
    const registry = await loadInvoiceExpenseRegistryUsd(inv.lines);
    const money = invoiceDisplayMoneyTotals(inv, registry);
    return {
        ...invoice,
        lines: inv.lines ?? invoice.lines,
        totalAmount: money.totalAmount,
        balanceDue: money.balanceDue,
        amountPaid: inv.amountPaid ?? invoice.amountPaid,
    };
}
export async function enrichInvoicesWithDisplayMoney(invoices, signal) {
    const out = invoices.slice();
    await mapWithLimit(out.map((_, i) => i), 4, async (i) => {
        if (signal?.aborted)
            return;
        out[i] = await enrichInvoiceWithDisplayMoney(out[i]);
    });
    return out;
}
