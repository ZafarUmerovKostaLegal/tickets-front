import { fetchExpenses } from '@entities/expenses/model/expensesApi';
import type { ExpenseRequest, ListParams } from '@entities/expenses/model/types';
import type { RequestInitAuth } from '@shared/api';

const PAGE = 200;

export async function fetchAllExpenses(
    base: Omit<ListParams, 'skip' | 'limit'>,
    initOrSignal?: RequestInitAuth | AbortSignal,
): Promise<ExpenseRequest[]> {
    const init: RequestInitAuth | undefined =
        initOrSignal instanceof AbortSignal
            ? { signal: initOrSignal }
            : initOrSignal;
    const out: ExpenseRequest[] = [];
    let skip = 0;
    for (;;) {
        const data = await fetchExpenses({
            ...base,
            skip,
            limit: PAGE,
            sortBy: base.sortBy ?? 'expenseDate',
            sortOrder: base.sortOrder ?? 'desc',
        }, init);
        out.push(...data.items);
        if (data.items.length < PAGE)
            break;
        if (typeof data.total === 'number' && out.length >= data.total)
            break;
        skip += PAGE;
        if (data.items.length === 0)
            break;
    }
    return out;
}
