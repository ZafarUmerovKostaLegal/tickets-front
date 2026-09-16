import { describe, expect, it } from 'vitest';
import { lockedExpenseUsdAmount } from './lockedExpenseUsdAmount';

describe('lockedExpenseUsdAmount', () => {
    it('prefers amountUzs ÷ exchangeRate (registry truth) over a stale equivalent', () => {
        // 120200 / 11948.31 ≈ 10.060… → 10.06; invoice FX had produced 10.01
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 11948.31,
            equivalentAmount: 10.01,
        })).toBe(10.06);
    });

    it('falls back to equivalentAmount when rate is missing', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 0,
            equivalentAmount: 10.06,
        })).toBe(10.06);
    });

    it('returns null when nothing usable', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 0,
            exchangeRate: 0,
            equivalentAmount: 0,
        })).toBeNull();
    });
});
