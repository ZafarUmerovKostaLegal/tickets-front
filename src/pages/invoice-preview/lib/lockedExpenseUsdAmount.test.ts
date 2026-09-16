import { describe, expect, it } from 'vitest';
import { lockedExpenseUsdAmount } from './lockedExpenseUsdAmount';

describe('lockedExpenseUsdAmount', () => {
    it('uses the larger of equivalentAmount and UZS÷rate so invoice FX cannot understate', () => {
        // Invoice FX produced 10.01; registry equivalent and/or UZS÷CBU is 10.06
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 11948.31,
            equivalentAmount: 10.01,
        })).toBe(10.06);

        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 12008,
            equivalentAmount: 10.06,
        })).toBe(10.06);
    });

    it('prefers equivalentAmount when rate is missing', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 0,
            equivalentAmount: 10.06,
        })).toBe(10.06);
    });

    it('falls back to UZS÷rate when equivalent is missing', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 11948.31,
            equivalentAmount: 0,
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
