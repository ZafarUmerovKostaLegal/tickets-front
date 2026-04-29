import type { ExpenseStatus, ExpenseType, ListParams } from './types';

export const EXPENSES_LIST_PAGE_SIZE = 50;
export type ExpensesUiFilterPeriod = 'all' | 'today' | 'week' | 'month';
function todayIsoLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function weekStartIsoLocal(): string {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function monthStartIsoLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
export function buildExpensesListParams(args: {
    isModerationQueue: boolean;
    search: string;
    filterStatus: ExpenseStatus | '';
    filterType: ExpenseType | '';
    filterReimb: 'reimbursable' | 'non_reimbursable' | '';
    filterPeriod: ExpensesUiFilterPeriod;
    page: number;
    pageSize?: number;
}): ListParams {
    const pageSize = args.pageSize ?? EXPENSES_LIST_PAGE_SIZE;
    const page = Math.max(1, args.page);
    const p: ListParams = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc',
    };
    const q = args.search.trim();
    if (q)
        p.q = q;
    if (args.isModerationQueue) {
        p.status = 'pending_approval';
    }
    else if (args.filterStatus) {
        p.status = args.filterStatus;
    }
    if (args.filterType)
        p.expenseType = args.filterType;
    if (args.filterReimb === 'reimbursable')
        p.isReimbursable = true;
    if (args.filterReimb === 'non_reimbursable')
        p.isReimbursable = false;
    const today = todayIsoLocal();
    if (args.filterPeriod === 'today') {
        p.dateFrom = today;
        p.dateTo = today;
    }
    else if (args.filterPeriod === 'week') {
        p.dateFrom = weekStartIsoLocal();
        p.dateTo = today;
    }
    else if (args.filterPeriod === 'month') {
        p.dateFrom = monthStartIsoLocal();
        p.dateTo = today;
    }
    return p;
}
