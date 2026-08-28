import { describe, expect, it } from 'vitest';
import { isExpensePaymentConfirmer } from './expensePaymentConfirmer';

describe('isExpensePaymentConfirmer', () => {
    it('matches Azizbek and the testeracc admin account', () => {
        expect(isExpensePaymentConfirmer('aakhmadjonov@kostalegal.com')).toBe(true);
        expect(isExpensePaymentConfirmer('Aakhmadjonov@KostaLegal.com')).toBe(true);
        expect(isExpensePaymentConfirmer('testeracc@kostalegal.com')).toBe(true);
        expect(isExpensePaymentConfirmer('testeracc@example.com')).toBe(true);
        expect(isExpensePaymentConfirmer('azizbek.aakhmadjonov@office.kostalegal.com')).toBe(true);
        expect(isExpensePaymentConfirmer(null, { displayName: 'testeracc' })).toBe(true);
        expect(isExpensePaymentConfirmer(null, { displayName: 'Azizbek Akhmadjonov' })).toBe(true);
        expect(isExpensePaymentConfirmer('oidrisova@kostalegal.com')).toBe(false);
        expect(isExpensePaymentConfirmer('')).toBe(false);
    });
});
