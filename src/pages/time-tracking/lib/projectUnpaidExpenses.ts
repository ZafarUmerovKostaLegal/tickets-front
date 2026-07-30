import { fetchAllExpenses } from '@entities/expenses/lib/fetchAllExpenses';
import { asExpenseNumber } from '@entities/expenses/model/coerceExpense';
import type { ExpenseRequest } from '@entities/expenses/model/types';

/** Reimbursable expenses approved but not yet paid — block client invoice create. */
export async function fetchApprovedUnpaidProjectExpenses(
    projectId: string,
    signal?: AbortSignal,
): Promise<ExpenseRequest[]> {
    const id = String(projectId ?? '').trim();
    if (!id)
        return [];
    return fetchAllExpenses({
        projectId: id,
        status: 'approved',
        isReimbursable: true,
        scopeMode: 'company',
        sortBy: 'expenseDate',
        sortOrder: 'desc',
    }, signal);
}

export function formatUnpaidExpenseListLines(
    rows: readonly ExpenseRequest[],
    maxItems = 12,
): string {
    const slice = rows.slice(0, Math.max(1, maxItems));
    const lines = slice.map((r) => {
        const id = String(r.id ?? '').trim() || '—';
        const dateRaw = String(r.expenseDate ?? '').trim().slice(0, 10);
        let dateRu = dateRaw;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
            const [y, m, d] = dateRaw.split('-');
            dateRu = `${d}.${m}.${y}`;
        }
        const desc = String(r.description ?? '').trim().replace(/\s+/g, ' ').slice(0, 72);
        const uzs = asExpenseNumber(r.amountUzs).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
        const parts = [`• ${id}`];
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

export async function assertNoApprovedUnpaidProjectExpenses(
    projectId: string,
    signal?: AbortSignal,
): Promise<void> {
    const unpaid = await fetchApprovedUnpaidProjectExpenses(projectId, signal);
    if (unpaid.length > 0)
        throw new ProjectUnpaidExpensesError(unpaid);
}
