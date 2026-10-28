import { fetchExpenses } from '@entities/expenses/model/expensesApi';
const PAGE = 200;
export async function fetchAllExpenses(base, initOrSignal) {
    const init = initOrSignal instanceof AbortSignal
        ? { signal: initOrSignal }
        : initOrSignal;
    const out = [];
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
