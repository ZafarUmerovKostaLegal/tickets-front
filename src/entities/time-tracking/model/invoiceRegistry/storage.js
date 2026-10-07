const STORAGE_PREFIX = 'tt-invoice-registry-rows-v1:';
function storageKey(year) {
    return `${STORAGE_PREFIX}${year}`;
}
export function readInvoiceRegistryOverrides(year) {
    try {
        const raw = localStorage.getItem(storageKey(year));
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return null;
        return parsed.filter((r) => Boolean(r && typeof r === 'object' && typeof r.id === 'string'));
    }
    catch {
        return null;
    }
}
export function writeInvoiceRegistryOverrides(year, rows) {
    try {
        localStorage.setItem(storageKey(year), JSON.stringify(rows));
    }
    catch {
        /* quota / private mode */
    }
}
export function clearInvoiceRegistryOverrides(year) {
    try {
        localStorage.removeItem(storageKey(year));
    }
    catch {
        /* ignore */
    }
}
