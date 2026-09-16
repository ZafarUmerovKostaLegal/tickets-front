import { describe, expect, it } from 'vitest';
import { lockedExpenseUsdAmount } from './lockedExpenseUsdAmount';

describe('lockedExpenseUsdAmount', () => {
    it('prefers equivalentAmount (registry column) over UZS÷rate', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 12008,
            equivalentAmount: 10.06,
        })).toBe(10.06);
    });

    it('uses UZS÷rate when equivalent is missing', () => {
        // 120200 / 11948.31 ≈ 10.060… → 10.06
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 11948.31,
            equivalentAmount: 0,
        })).toBe(10.06);
    });

    it('ignores inverted / tiny rates that would explode into billions', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 0.000083,
            equivalentAmount: 0,
        })).toBeNull();

        // equivalent still wins even if rate is garbage
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 0.000083,
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
