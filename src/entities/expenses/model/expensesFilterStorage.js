import { EXPENSE_REGISTRY_STATUSES, EXPENSE_TYPES, PARTNER_EXPENSE_CATEGORIES } from './constants';
const STORAGE_PREFIX = 'tickets.expenses.filters.v3';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set([
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
const SORTS = new Set(['createdAt', 'expenseDate']);
const STATUSES = new Set(EXPENSE_REGISTRY_STATUSES);
const TYPES = new Set([...EXPENSE_TYPES.map(item => item.value), 'company_expense']);
const SUBTYPES = new Set(PARTNER_EXPENSE_CATEGORIES.map(item => item.value));
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function dateValue(value) {
    return typeof value === 'string' && ISO_DATE_RE.test(value) ? value : '';
}
export function defaultExpensesSavedFilters() {
    return {
        search: '',
        status: '',
        type: '',
        subtype: '',
        partnerUserId: '',
        authorUserId: '',
        reimbursable: '',
        period: 'all',
        dateFrom: '',
        dateTo: '',
        sortBy: 'createdAt',
    };
}
function positiveUserId(value) {
    return typeof value === 'number'
        && Number.isInteger(value)
        && value > 0
        ? value
        : '';
}
export function normalizeExpensesSavedFilters(value, variant) {
    const fallback = defaultExpensesSavedFilters();
    if (!isRecord(value))
        return fallback;
    const status = typeof value.status === 'string' && STATUSES.has(value.status)
        ? value.status
        : '';
    const type = typeof value.type === 'string' && TYPES.has(value.type)
        ? value.type
        : '';
    const subtype = typeof value.subtype === 'string' && SUBTYPES.has(value.subtype)
        ? value.subtype
        : '';
    const partnerUserId = positiveUserId(value.partnerUserId);
    const authorUserId = positiveUserId(value.authorUserId);
    const reimbursable = value.reimbursable === 'reimbursable' || value.reimbursable === 'non_reimbursable'
        ? value.reimbursable
        : '';
    const period = typeof value.period === 'string' && PERIODS.has(value.period)
        ? value.period
        : fallback.period;
    const sortBy = typeof value.sortBy === 'string' && SORTS.has(value.sortBy)
        ? value.sortBy
        : fallback.sortBy;
    return {
        search: typeof value.search === 'string' ? value.search.slice(0, 500) : '',
        status: variant === 'moderationQueue' ? '' : status,
        type: variant === 'partner' || type === 'partner_expense' ? '' : type,
        subtype: variant === 'partner' ? subtype : '',
        partnerUserId: variant === 'partner' ? partnerUserId : '',
        authorUserId,
        reimbursable,
        period,
        dateFrom: dateValue(value.dateFrom),
        dateTo: dateValue(value.dateTo),
        sortBy,
    };
}
export function expensesFiltersStorageKey(userId, variant) {
    return `${STORAGE_PREFIX}:${userId}:${variant}`;
}
export function loadExpensesSavedFilters(userId, variant) {
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
export function clearExpensesSavedFilters(userId, variant) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.removeItem(expensesFiltersStorageKey(userId, variant));
    }
    catch {
        // Filtering must remain usable even when browser storage is unavailable.
    }
}
export function saveExpensesSavedFilters(userId, variant, filters) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(expensesFiltersStorageKey(userId, variant), JSON.stringify(normalizeExpensesSavedFilters(filters, variant)));
    }
    catch {
        // Filtering must remain usable even when browser storage is unavailable.
    }
}
