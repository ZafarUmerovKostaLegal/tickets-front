const SYMBOLS: Record<string, string> = {
    USD: '$',
    UZS: 'сўм',
    EUR: '€',
    RUB: '₽',
    GBP: '£',
};
function isZeroDecimalCurrency(cur?: string | null): boolean {
    if (!cur)
        return false;
    const c = String(cur).trim().toUpperCase();
    if (c === 'UZS' || c === 'JPY')
        return true;
    const lo = String(cur).trim().toLowerCase();
    return lo.includes('сум') || lo.includes('сўм') || lo === "so'm" || lo === 'som';
}
export function formatBillableMoney(amount: number | null | undefined, currency: string | null | undefined): string {
    if (amount == null || !Number.isFinite(amount))
        return '—';
    const code = (currency || '').trim().toUpperCase();
    const sym = code ? (SYMBOLS[code] ?? code) : '';
    const zeroDec = isZeroDecimalCurrency(currency);
    const num = amount.toLocaleString('ru-RU', {
        minimumFractionDigits: zeroDec ? 0 : 2,
        maximumFractionDigits: zeroDec ? 0 : 2,
    });
    if (!sym)
        return num;
    return `${sym}\u00a0${num}`;
}
export function isCbuFxUnavailable(source?: string | null): boolean {
    if (!source)
        return false;
    return String(source).trim().toUpperCase() === 'CBU_UNAVAILABLE';
}
