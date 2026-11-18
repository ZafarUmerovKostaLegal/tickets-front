export type InvoiceRegistryFilters = {
    search: string;
    partners: string[];
    clients: string[];
    currencies: string[];
    statuses: string[];
    numberQuery: string;
    dateFrom: string;
    dateTo: string;
    months: number[];
};

export type InvoiceRegistryScroll = { top: number; left: number };

const FILTERS_KEY = 'tt-inv-reg-filters:';
const SCROLL_KEY = 'tt-inv-reg-scroll:';

export const EMPTY_INVOICE_REGISTRY_FILTERS: InvoiceRegistryFilters = {
    search: '',
    partners: [],
    clients: [],
    currencies: [],
    statuses: [],
    numberQuery: '',
    dateFrom: '',
    dateTo: '',
    months: [],
};

function storage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    }
    catch {
        return null;
    }
}

function readJson(key: string): unknown {
    try {
        const raw = storage()?.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}

function writeJson(key: string, value: unknown | null): void {
    try {
        const store = storage();
        if (!store)
            return;
        if (value === null)
            store.removeItem(key);
        else
            store.setItem(key, JSON.stringify(value));
    }
    catch {
    }
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function isEmptyInvoiceRegistryFilters(filters: InvoiceRegistryFilters): boolean {
    return !filters.search && !filters.numberQuery && !filters.dateFrom && !filters.dateTo
        && filters.partners.length === 0 && filters.clients.length === 0 && filters.currencies.length === 0
        && filters.statuses.length === 0 && filters.months.length === 0;
}

export function readInvoiceRegistryFilters(year: string): InvoiceRegistryFilters {
    const raw = readJson(FILTERS_KEY + year);
    if (!raw || typeof raw !== 'object')
        return EMPTY_INVOICE_REGISTRY_FILTERS;
    const o = raw as Record<string, unknown>;
    return {
        search: text(o.search),
        partners: strings(o.partners),
        clients: strings(o.clients),
        currencies: strings(o.currencies),
        statuses: strings(o.statuses),
        numberQuery: text(o.numberQuery),
        dateFrom: text(o.dateFrom),
        dateTo: text(o.dateTo),
        months: Array.isArray(o.months)
            ? o.months.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12)
            : [],
    };
}

export function writeInvoiceRegistryFilters(year: string, filters: InvoiceRegistryFilters): void {
    writeJson(FILTERS_KEY + year, isEmptyInvoiceRegistryFilters(filters) ? null : filters);
}

export function readInvoiceRegistryScroll(year: string): InvoiceRegistryScroll | null {
    const raw = readJson(SCROLL_KEY + year);
    if (!raw || typeof raw !== 'object')
        return null;
    const { top, left } = raw as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
    const scroll = { top: n(top), left: n(left) };
    return scroll.top || scroll.left ? scroll : null;
}

export function writeInvoiceRegistryScroll(year: string, scroll: InvoiceRegistryScroll): void {
    writeJson(SCROLL_KEY + year, scroll.top > 0 || scroll.left > 0 ? { top: Math.round(scroll.top), left: Math.round(scroll.left) } : null);
}
