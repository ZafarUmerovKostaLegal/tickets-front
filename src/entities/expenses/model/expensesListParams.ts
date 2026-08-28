import type { ExpenseType, ExpensesScopeMode, ListParams, PartnerExpenseCategory } from './types';
import {
    defaultExpensesCustomRange,
    expensesPeriodPresetRange,
    type ExpensesUiFilterPeriod,
} from './expensesPeriodPresets';
import { AWAITING_PAYMENT_STATUS_FILTER, type ExpensesUiStatusFilter } from './expenseStatusLabels';

export const EXPENSES_LIST_PAGE_SIZE = 100;

export type ExpensesUiSortBy = 'createdAt' | 'expenseDate';

export type { ExpensesUiFilterPeriod };

export function awaitingVendorPaymentQuery(extra: ListParams = {}): ListParams {
    return {
        status: 'approved',
        isReimbursable: true,
        awaitingPayment: true,
        ...extra,
    };
}

export function buildExpensesListParams(args: {
    isModerationQueue: boolean;
    search: string;
    filterStatus: ExpensesUiStatusFilter | '';
    filterType: ExpenseType | '';
    filterSubtype?: PartnerExpenseCategory | '';
    filterPartnerUserId?: number | '';
    /** Author (created_by) — API `employeeUserId`. */
    filterAuthorUserId?: number | '';
    filterReimb: 'reimbursable' | 'non_reimbursable' | '';
    filterPeriod: ExpensesUiFilterPeriod;
    filterDateFrom?: string;
    filterDateTo?: string;
    sortBy?: ExpensesUiSortBy;
    page: number;
    pageSize?: number;
    scopeMode?: ExpensesScopeMode;
    /** Force type (client tab) or exclude type (company tab without client expenses). */
    forceExpenseType?: ExpenseType;
    excludeExpenseType?: ExpenseType;
}): ListParams {
    const pageSize = args.pageSize ?? EXPENSES_LIST_PAGE_SIZE;
    const page = Math.max(1, args.page);
    const p: ListParams = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sortBy: args.sortBy ?? 'createdAt',
        sortOrder: 'desc',
    };
    if (args.scopeMode)
        p.scopeMode = args.scopeMode;
    const q = args.search.trim();
    if (q)
        p.q = q;
    if (args.isModerationQueue) {
        p.status = 'pending_approval';
    }
    else if (args.filterStatus && args.filterStatus !== AWAITING_PAYMENT_STATUS_FILTER) {
        p.status = args.filterStatus;
    }
    if (typeof args.filterAuthorUserId === 'number' && args.filterAuthorUserId > 0)
        p.employeeUserId = args.filterAuthorUserId;
    if (args.scopeMode === 'partner') {
        p.expenseType = 'partner_expense';
        if (args.filterSubtype)
            p.expenseSubtype = args.filterSubtype;
        if (typeof args.filterPartnerUserId === 'number' && args.filterPartnerUserId > 0)
            p.partnerUserId = args.filterPartnerUserId;
    }
    else if (args.forceExpenseType) {
        p.expenseType = args.forceExpenseType;
    }
    else if (args.filterType && args.filterType !== 'partner_expense') {
        p.expenseType = args.filterType;
    }
    else if (args.excludeExpenseType) {
        p.excludeExpenseType = args.excludeExpenseType;
    }
    if (args.filterReimb === 'reimbursable')
        p.isReimbursable = true;
    if (args.filterReimb === 'non_reimbursable')
        p.isReimbursable = false;
    if (!args.isModerationQueue && args.filterStatus === AWAITING_PAYMENT_STATUS_FILTER) {
        p.status = 'approved';
        p.isReimbursable = true;
        p.awaitingPayment = true;
    }

    if (args.filterPeriod === 'custom') {
        const from = (args.filterDateFrom ?? '').trim().slice(0, 10);
        const to = (args.filterDateTo ?? '').trim().slice(0, 10);
        if (from && to) {
            p.dateFrom = from <= to ? from : to;
            p.dateTo = from <= to ? to : from;
        }
        else if (from) {
            p.dateFrom = from;
            p.dateTo = from;
        }
        else if (to) {
            p.dateFrom = to;
            p.dateTo = to;
        }
        else {
            const fallback = defaultExpensesCustomRange();
            p.dateFrom = fallback.dateFrom;
            p.dateTo = fallback.dateTo;
        }
    }
    else if (args.filterPeriod !== 'all') {
        const range = expensesPeriodPresetRange(args.filterPeriod);
        p.dateFrom = range.dateFrom;
        p.dateTo = range.dateTo;
    }

    return p;
}
