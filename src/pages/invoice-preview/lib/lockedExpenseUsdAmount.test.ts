import { describe, expect, it } from 'vitest';
import { lockedExpenseUsdAmount } from './lockedExpenseUsdAmount';

describe('lockedExpenseUsdAmount (invoice-preview re-export)', () => {
    it('re-exports registry-locked USD helper', () => {
        expect(lockedExpenseUsdAmount({
            amountUzs: 120200,
            exchangeRate: 11948.31,
            equivalentAmount: 10.06,
        })).toBe(10.06);
    });
});
