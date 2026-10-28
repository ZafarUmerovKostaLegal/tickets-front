import { EXPENSE_REGISTRY_STATUSES } from './constants';
import { AWAITING_PAYMENT_STATUS_FILTER, AWAITING_REIMBURSEMENT_STATUS_FILTER, } from './expenseStatusLabels';
import { awaitingEmployeeReimbursementQuery, awaitingVendorPaymentQuery, buildExpensesListParams, } from './expensesListParams';
import { fetchExpenses } from './expensesApi';
export function formatExpenseStatusCount(n) {
    if (n == null || !Number.isFinite(n) || n < 0)
        return null;
    const v = Math.trunc(n);
    return v > 99 ? '99+' : String(v);
}
export async function fetchExpenseStatusCounts(args, init) {
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
    const jobs = [
        fetchExpenses({ ...base, skip: 0, limit: 1 }, init).then((res) => [
            'all',
            typeof res.total === 'number' ? Math.max(0, res.total) : 0,
        ]),
    ];
    for (const status of EXPENSE_REGISTRY_STATUSES) {
        jobs.push(fetchExpenses({ ...base, status, skip: 0, limit: 1 }, init).then((res) => [
            status,
            typeof res.total === 'number' ? Math.max(0, res.total) : 0,
        ]));
    }
    jobs.push(fetchExpenses(awaitingVendorPaymentQuery({
        ...base,
        skip: 0,
        limit: 1,
        ...(args.filterReimb === 'non_reimbursable' ? { isReimbursable: false } : {}),
    }), init).then((res) => [
        AWAITING_PAYMENT_STATUS_FILTER,
        typeof res.total === 'number' ? Math.max(0, res.total) : 0,
    ]), fetchExpenses(awaitingEmployeeReimbursementQuery({
        ...base,
        skip: 0,
        limit: 1,
    }), init).then((res) => [
        AWAITING_REIMBURSEMENT_STATUS_FILTER,
        typeof res.total === 'number' ? Math.max(0, res.total) : 0,
    ]));
    const entries = await Promise.all(jobs);
    const out = {};
    for (const [key, total] of entries)
        out[key] = total;
    return out;
}
