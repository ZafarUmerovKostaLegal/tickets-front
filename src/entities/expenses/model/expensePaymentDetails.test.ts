import { describe, expect, it } from 'vitest';
import {
    formatReimbursementCardNumber,
    isValidReimbursementCardNumber,
    reimbursementCardDigits,
} from './expensePaymentDetails';

describe('expense payment details', () => {
    it('formats a reimbursement card number in groups of four', () => {
        expect(formatReimbursementCardNumber('8600123412345678')).toBe('8600 1234 1234 5678');
    });

    it('normalizes separators and limits input to 16 digits', () => {
        expect(reimbursementCardDigits('8600-1234 1234-5678-99')).toBe('8600123412345678');
    });

    it('requires exactly 16 digits', () => {
        expect(isValidReimbursementCardNumber('8600 1234 1234 5678')).toBe(true);
        expect(isValidReimbursementCardNumber('8600 1234')).toBe(false);
    });
});
