import type { ExpenseStatus, ExpenseType, PartnerExpenseCategory } from './types';
import { EXPENSE_REGISTRY_STATUSES, EXPENSE_TYPES, PARTNER_EXPENSE_CATEGORIES } from './constants';
import type { ExpensesUiFilterPeriod, ExpensesUiSortBy } from './expensesListParams';

export type ExpensesFiltersVariant = 'default' | 'moderationQueue' | 'partner' | 'client';
export type ExpensesReimbursableFilter = 'reimbursable' | 'non_reimbursable' | '';

export type ExpensesSavedFilters = {
    search: string;
    status: ExpenseStatus | '';
    type: ExpenseType | '';
    subtype: PartnerExpenseCategory | '';
    partnerUserId: number | '';
    reimbursable: ExpensesReimbursableFilter;
    period: ExpensesUiFilterPeriod;
    dateFrom: string;
    dateTo: string;
    sortBy: ExpensesUiSortBy;
};

const STORAGE_PREFIX = 'tickets.expenses.filters.v2';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set<ExpensesUiFilterPeriod>([
    'all',
    'today',
    'week',
    'month',
    'prev_month',
    'quarter',
    'ytd',
    'last_90',
    'custom',
]);
const SORTS = new Set<ExpensesUiSortBy>(['createdAt', 'expenseDate']);
const STATUSES = new Set<ExpenseStatus>(EXPENSE_REGISTRY_STATUSES);
const TYPES = new Set<ExpenseType>(EXPENSE_TYPES.map(item => item.value));
const SUBTYPES = new Set<PartnerExpenseCategory>(PARTNER_EXPENSE_CATEGORIES.map(item => item.value));

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dateValue(value: unknown): string {
    return typeof value === 'string' && ISO_DATE_RE.test(value) ? value : '';
}

export function defaultExpensesSavedFilters(): ExpensesSavedFilters {
    return {
        search: '',
        status: '',
        type: '',
        subtype: '',
        partnerUserId: '',
        reimbursable: '',
        period: 'all',
        dateFrom: '',
        dateTo: '',
        sortBy: 'createdAt',
    };
}

export function normalizeExpensesSavedFilters(
    value: unknown,
    variant: ExpensesFiltersVariant,
): ExpensesSavedFilters {
    const fallback = defaultExpensesSavedFilters();
    if (!isRecord(value))
        return fallback;

    const status = typeof value.status === 'string' && STATUSES.has(value.status as ExpenseStatus)
        ? value.status as ExpenseStatus
        : '';
    const type = typeof value.type === 'string' && TYPES.has(value.type as ExpenseType)
        ? value.type as ExpenseType
        : '';
    const subtype = typeof value.subtype === 'string' && SUBTYPES.has(value.subtype as PartnerExpenseCategory)
        ? value.subtype as PartnerExpenseCategory
        : '';
    const partnerUserId = typeof value.partnerUserId === 'number'
        && Number.isInteger(value.partnerUserId)
        && value.partnerUserId > 0
        ? value.partnerUserId
        : '';
    const reimbursable = value.reimbursable === 'reimbursable' || value.reimbursable === 'non_reimbursable'
        ? value.reimbursable
        : '';
    const period = typeof value.period === 'string' && PERIODS.has(value.period as ExpensesUiFilterPeriod)
        ? value.period as ExpensesUiFilterPeriod
        : fallback.period;
    const sortBy = typeof value.sortBy === 'string' && SORTS.has(value.sortBy as ExpensesUiSortBy)
        ? value.sortBy as ExpensesUiSortBy
        : fallback.sortBy;

    return {
        search: typeof value.search === 'string' ? value.search.slice(0, 500) : '',
        status: variant === 'moderationQueue' ? '' : status,
        type: variant === 'partner' || type === 'partner_expense' ? '' : type,
        subtype: variant === 'partner' ? subtype : '',
        partnerUserId: variant === 'partner' ? partnerUserId : '',
        reimbursable,
        period,
        dateFrom: dateValue(value.dateFrom),
        dateTo: dateValue(value.dateTo),
        sortBy,
    };
}

export function expensesFiltersStorageKey(userId: number, variant: ExpensesFiltersVariant): string {
    return `${STORAGE_PREFIX}:${userId}:${variant}`;
}

export function loadExpensesSavedFilters(
    userId: number,
    variant: ExpensesFiltersVariant,
): ExpensesSavedFilters {
    if (typeof window === 'undefined')
        return defaultExpensesSavedFilters();
    try {
        const raw = window.localStorage.getItem(expensesFiltersStorageKey(userId, variant));
        return normalizeExpensesSavedFilters(raw ? JSON.parse(raw) : null, variant);
    }
    catch {
        return defaultExpensesSavedFilters();
    }
}

export function saveExpensesSavedFilters(
    userId: number,
    variant: ExpensesFiltersVariant,
    filters: ExpensesSavedFilters,
): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(
            expensesFiltersStorageKey(userId, variant),
            JSON.stringify(normalizeExpensesSavedFilters(filters, variant)),
        );
    }
    catch {
        // Filtering must remain usable even when browser storage is unavailable.
    }
}
