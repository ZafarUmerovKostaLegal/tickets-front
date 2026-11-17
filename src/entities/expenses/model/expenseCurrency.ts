import type { ExpenseAmountCurrency } from './types';

export function parseExpenseMoney(raw: string): number {
    const t = String(raw ?? '')
        .trim()
        .replace(/\u00a0/g, '')
        .replace(/\s/g, '')
        .replace(',', '.');
    if (!t)
        return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
}

export function roundMoney2(n: number): number {
    if (!Number.isFinite(n))
        return NaN;
    const sign = n < 0 ? -1 : 1;
    const scaled = Math.abs(n) * 100;
    const whole = Math.floor(scaled + 1e-9);
    const frac = scaled - whole;
    const rounded = frac >= 0.5 - 1e-12 ? whole + 1 : whole;
    return (sign * rounded) / 100;
}

export function formatExchangeRate(n: number): string {
    if (!Number.isFinite(n) || n <= 0)
        return '';
    const fixed = n.toFixed(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return fixed;
}

export function needsForeignUsdRate(c: ExpenseAmountCurrency): boolean {
    return c === 'RUB' || c === 'GBP' || c === 'EUR';
}

export function computeUsdEquivalent(
    currency: ExpenseAmountCurrency,
    amountStr: string,
    uzsPerUsdStr: string,
    foreignPerUsdStr: string,
): number | null {
    const amt = parseExpenseMoney(amountStr);
    if (!Number.isFinite(amt) || amt <= 0)
        return null;
    if (currency === 'USD')
        return amt;
    if (currency === 'UZS') {
        const uzsPerUsd = parseExpenseMoney(uzsPerUsdStr);
        if (!Number.isFinite(uzsPerUsd) || uzsPerUsd <= 0)
            return null;
        return amt / uzsPerUsd;
    }
    const fx = parseExpenseMoney(foreignPerUsdStr);
    if (!Number.isFinite(fx) || fx <= 0)
        return null;
    return amt / fx;
}

export function computeAmountUzsForApi(
    currency: ExpenseAmountCurrency,
    amountStr: string,
    uzsPerUsdStr: string,
    foreignPerUsdStr: string,
): number {
    const amt = parseExpenseMoney(amountStr);
    if (!Number.isFinite(amt) || amt <= 0)
        return 0;

    if (currency === 'UZS')
        return roundMoney2(amt);

    const uzsPerUsd = parseExpenseMoney(uzsPerUsdStr);
    if (!Number.isFinite(uzsPerUsd) || uzsPerUsd <= 0)
        return 0;

    if (currency === 'USD')
        return roundMoney2(amt * uzsPerUsd);

    const fx = parseExpenseMoney(foreignPerUsdStr);
    if (!Number.isFinite(fx) || fx <= 0)
        return 0;
    return roundMoney2((amt / fx) * uzsPerUsd);
}
