import type { InvoiceRegistryRow, InvoiceRegistryYearId } from './types';

const STORAGE_PREFIX = 'tt-invoice-registry-rows-v1:';

function storageKey(year: InvoiceRegistryYearId): string {
    return `${STORAGE_PREFIX}${year}`;
}

export function readInvoiceRegistryOverrides(year: InvoiceRegistryYearId): InvoiceRegistryRow[] | null {
    try {
        const raw = localStorage.getItem(storageKey(year));
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed))
            return null;
        return parsed.filter((r): r is InvoiceRegistryRow =>
            Boolean(r && typeof r === 'object' && typeof (r as InvoiceRegistryRow).id === 'string'));
    }
    catch {
        return null;
    }
}

export function writeInvoiceRegistryOverrides(year: InvoiceRegistryYearId, rows: InvoiceRegistryRow[]): void {
    try {
        localStorage.setItem(storageKey(year), JSON.stringify(rows));
    }
    catch {
        /* quota / private mode */
    }
}

export function clearInvoiceRegistryOverrides(year: InvoiceRegistryYearId): void {
    try {
        localStorage.removeItem(storageKey(year));
    }
    catch {
        /* ignore */
    }
}
