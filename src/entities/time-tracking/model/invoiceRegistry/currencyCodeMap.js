/** Canonical currency code fixes for invoice registry typos. */
const CURRENCY_CODE_MAP = {
    USZ: 'UZS',
    UZD: 'UZS',
    GBH: 'GBP',
};
export function mapInvoiceRegistryCurrencyCode(raw) {
    const t = raw.trim();
    if (!t)
        return t;
    const up = t.toUpperCase();
    return CURRENCY_CODE_MAP[up] ?? up;
}
export function applyInvoiceRegistryCurrencyCodeFixes(row) {
    if (typeof row.currency !== 'string' || !row.currency.trim())
        return row;
    const next = mapInvoiceRegistryCurrencyCode(row.currency);
    if (next === row.currency)
        return row;
    return { ...row, currency: next };
}
