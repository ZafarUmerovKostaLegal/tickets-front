/** Canonical currency code fixes for invoice registry typos. */
const CURRENCY_CODE_MAP: Record<string, string> = {
    USZ: 'UZS',
    UZD: 'UZS',
    GBH: 'GBP',
};

export function mapInvoiceRegistryCurrencyCode(raw: string): string {
    const t = raw.trim();
    if (!t)
        return t;
    const up = t.toUpperCase();
    return CURRENCY_CODE_MAP[up] ?? up;
}

type CurrencyFixableRow = {
    currency?: string;
} & Record<string, string>;

export function applyInvoiceRegistryCurrencyCodeFixes<T extends CurrencyFixableRow>(row: T): T {
    if (typeof row.currency !== 'string' || !row.currency.trim())
        return row;
    const next = mapInvoiceRegistryCurrencyCode(row.currency);
    if (next === row.currency)
        return row;
    return { ...row, currency: next };
}
