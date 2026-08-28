import { EXPENSE_REGISTRY_STATUSES } from './constants';
import { AWAITING_PAYMENT_STATUS_FILTER } from './expenseStatusLabels';
import { awaitingVendorPaymentQuery, buildExpensesListParams, type ExpensesUiFilterPeriod, type ExpensesUiSortBy } from './expensesListParams';
import { fetchExpenses } from './expensesApi';
import type { ExpenseStatus, ExpenseType, ExpensesScopeMode, PartnerExpenseCategory } from './types';
import type { RequestInitAuth } from '@shared/api';

export type ExpenseStatusCountMap = Partial<Record<ExpenseStatus | 'all' | typeof AWAITING_PAYMENT_STATUS_FILTER, number>>;

export function formatExpenseStatusCount(n: number | undefined): string | null {
    if (n == null || !Number.isFinite(n) || n < 0)
        return null;
    const v = Math.trunc(n);
    return v > 99 ? '99+' : String(v);
}

export async function fetchExpenseStatusCounts(
    args: {
        search: string;
        filterType: ExpenseType | '';
        filterSubtype?: PartnerExpenseCategory | '';
        filterPartnerUserId?: number | '';
        filterAuthorUserId?: number | '';
        filterReimb: 'reimbursable' | 'non_reimbursable' | '';
        filterPeriod: ExpensesUiFilterPeriod;
        filterDateFrom?: string;
        filterDateTo?: string;
        sortBy?: ExpensesUiSortBy;
        scopeMode?: ExpensesScopeMode;
        forceExpenseType?: ExpenseType;
        excludeExpenseType?: ExpenseType;
    },
    init?: RequestInitAuth,
): Promise<ExpenseStatusCountMap> {
    const base = buildExpensesListParams({
        isModerationQueue: false,
        search: args.search,
        filterStatus: '',
        filterType: args.filterType,
        filterSubtype: args.filterSubtype,
        filterPartnerUserId: args.filterPartnerUserId,
        filterAuthorUserId: args.filterAuthorUserId,
        filterReimb: args.filterReimb,
        filterPeriod: args.filterPeriod,
        filterDateFrom: args.filterDateFrom,
        filterDateTo: args.filterDateTo,
        sortBy: args.sortBy,
        page: 1,
        pageSize: 1,
        scopeMode: args.scopeMode,
        forceExpenseType: args.forceExpenseType,
        excludeExpenseType: args.excludeExpenseType,
    });

    const jobs: Array<Promise<readonly [ExpenseStatus | 'all' | typeof AWAITING_PAYMENT_STATUS_FILTER, number]>> = [
        fetchExpenses({ ...base, skip: 0, limit: 1 }, init).then((res) => [
            'all',
            typeof res.total === 'number' ? Math.max(0, res.total) : 0,
        ] as const),
    ];
    for (const status of EXPENSE_REGISTRY_STATUSES) {
        jobs.push(
            fetchExpenses({ ...base, status, skip: 0, limit: 1 }, init).then((res) => [
                status,
                typeof res.total === 'number' ? Math.max(0, res.total) : 0,
            ] as const),
        );
    }
    jobs.push(
        fetchExpenses(
            awaitingVendorPaymentQuery({
                ...base,
                skip: 0,
                limit: 1,
                ...(args.filterReimb === 'non_reimbursable' ? { isReimbursable: false } : {}),
            }),
            init,
        ).then((res) => [
            AWAITING_PAYMENT_STATUS_FILTER,
            typeof res.total === 'number' ? Math.max(0, res.total) : 0,
        ] as const),
    );

    const entries = await Promise.all(jobs);
    const out: ExpenseStatusCountMap = {};
    for (const [key, total] of entries)
        out[key] = total;
    return out;
}
