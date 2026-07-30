import { fetchAllExpenses } from '@entities/expenses/lib/fetchAllExpenses';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import type { ExpenseRequest } from '@entities/expenses/model/types';

/** Statuses that block client invoice create until paid. */
export const INVOICE_BLOCKING_EXPENSE_STATUSES = new Set([
    'approved',
    'pending_approval',
    'revision_required',
    'draft',
]);

function isBlockingUnpaidExpense(r: ExpenseRequest): boolean {
    if (!r.isReimbursable)
        return false;
    if (String(r.expenseType ?? '').trim() === 'partner_expense')
        return false;
    return INVOICE_BLOCKING_EXPENSE_STATUSES.has(String(r.status ?? '').trim());
}

/**
 * Reimbursable company expenses on the project that are not yet paid.
 * Fail-closed: network/API errors propagate so invoice create cannot skip the gate.
 */
export async function fetchApprovedUnpaidProjectExpenses(
    projectId: string,
    signal?: AbortSignal,
): Promise<ExpenseRequest[]> {
    const id = String(projectId ?? '').trim();
    if (!id)
        return [];
    const init = { getReuseWindowMs: 0 as const, ...(signal ? { signal } : {}) };

    const approved = await fetchAllExpenses({
        projectId: id,
        status: 'approved',
        isReimbursable: true,
        scopeMode: 'company',
        sortBy: 'expenseDate',
        sortOrder: 'desc',
    }, init);

    const approvedHits = approved.filter(isBlockingUnpaidExpense);
    if (approvedHits.length > 0)
        return approvedHits;

    const all = await fetchAllExpenses({
        projectId: id,
        isReimbursable: true,
        scopeMode: 'company',
        sortBy: 'expenseDate',
        sortOrder: 'desc',
    }, init);
    const pidLower = id.toLowerCase();
    return all.filter((r) => {
        const rowPid = String(r.projectId ?? '').trim().toLowerCase();
        if (rowPid && rowPid !== pidLower)
            return false;
        return isBlockingUnpaidExpense(r);
    });
}

export function formatUnpaidExpenseListLines(
    rows: readonly ExpenseRequest[],
    maxItems = 12,
): string {
    const slice = rows.slice(0, Math.max(1, maxItems));
    const lines = slice.map((r) => {
        const id = String(r.id ?? '').trim() || '—';
        const status = String(r.status ?? '').trim();
        const dateRaw = String(r.expenseDate ?? '').trim().slice(0, 10);
        let dateRu = dateRaw;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
            const [y, m, d] = dateRaw.split('-');
            dateRu = `${d}.${m}.${y}`;
        }
        const desc = String(r.description ?? '').trim().replace(/\s+/g, ' ').slice(0, 72);
        const uzs = asExpenseNumber(r.amountUzs).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
        const parts = [`• ${id}`];
        if (status)
            parts.push(`[${status}]`);
        if (dateRu)
            parts.push(dateRu);
        parts.push(desc || '—');
        parts.push(`${uzs} UZS`);
        return parts.join(' — ');
    });
    if (rows.length > slice.length)
        lines.push(`… +${rows.length - slice.length}`);
    return lines.join('\n');
}

export class ProjectUnpaidExpensesError extends Error {
    readonly expenses: ExpenseRequest[];

    constructor(expenses: ExpenseRequest[]) {
        super('PROJECT_UNPAID_EXPENSES');
        this.name = 'ProjectUnpaidExpensesError';
        this.expenses = expenses;
    }
}

export function isProjectUnpaidExpensesError(e: unknown): e is ProjectUnpaidExpensesError {
    if (e instanceof ProjectUnpaidExpensesError)
        return true;
    if (e && typeof e === 'object' && (e as { name?: string }).name === 'ProjectUnpaidExpensesError') {
        return Array.isArray((e as ProjectUnpaidExpensesError).expenses);
    }
    return false;
}

export async function assertNoApprovedUnpaidProjectExpenses(
    projectId: string,
    signal?: AbortSignal,
): Promise<void> {
    const unpaid = await fetchApprovedUnpaidProjectExpenses(projectId, signal);
    if (unpaid.length > 0)
        throw new ProjectUnpaidExpensesError(unpaid);
}
