import { describe, expect, it } from 'vitest';
import {
    formatReimbursementCardNumber,
    isValidReimbursementCardNumber,
    reimbursementCardDigits,
    expenseHasReimbursementCard,
    isEmployeePersonalFundsPayout,
    isAwaitingVendorPayment,
    isAwaitingEmployeeReimbursement,
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

describe('expenseHasReimbursementCard', () => {
    it('uses the list flag without exposing the card number', () => {
        expect(expenseHasReimbursementCard({ hasReimbursementCard: true })).toBe(true);
        expect(expenseHasReimbursementCard({ hasReimbursementCard: false })).toBe(false);
    });

    it('falls back to a filled card number from the detail payload', () => {
        expect(expenseHasReimbursementCard({ reimbursementCardNumber: '5614 6829 0301 8614' })).toBe(true);
        expect(expenseHasReimbursementCard({ reimbursementCardNumber: '' })).toBe(false);
    });

    it('treats cash company expenses as card payouts when the list flag is missing', () => {
        expect(expenseHasReimbursementCard({
            paymentMethod: 'cash',
            expenseType: 'services',
        })).toBe(true);
        expect(expenseHasReimbursementCard({
            paymentMethod: 'transfer',
            expenseType: 'services',
        })).toBe(false);
        expect(expenseHasReimbursementCard({
            paymentMethod: 'cash',
            expenseType: 'partner_expense',
        })).toBe(false);
    });
});

describe('isEmployeePersonalFundsPayout', () => {
    it('is cash company spend, not partner or bank transfer', () => {
        expect(isEmployeePersonalFundsPayout({ paymentMethod: 'cash', expenseType: 'services' })).toBe(true);
        expect(isEmployeePersonalFundsPayout({ paymentMethod: 'transfer', expenseType: 'services' })).toBe(false);
        expect(isEmployeePersonalFundsPayout({ paymentMethod: 'cash', expenseType: 'partner_expense' })).toBe(false);
    });
});

describe('isAwaitingVendorPayment', () => {
    it('is approved spend that is not a personal-card payout', () => {
        expect(isAwaitingVendorPayment({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'transfer',
        })).toBe(true);
        expect(isAwaitingVendorPayment({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'card',
        })).toBe(true);
        expect(isAwaitingVendorPayment({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'cash',
            expenseType: 'services',
        })).toBe(false);
        expect(isAwaitingVendorPayment({
            status: 'approved',
            isReimbursable: false,
            paymentMethod: 'transfer',
        })).toBe(true);
        expect(isAwaitingVendorPayment({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'transfer',
            expenseType: 'partner_expense',
        })).toBe(false);
        expect(isAwaitingVendorPayment({
            status: 'paid',
            isReimbursable: true,
            paymentMethod: 'transfer',
        })).toBe(false);
    });
});

describe('isAwaitingEmployeeReimbursement', () => {
    it('is approved personal-card payout, including non-client-reimbursable cash', () => {
        expect(isAwaitingEmployeeReimbursement({
            status: 'approved',
            paymentMethod: 'cash',
            expenseType: 'services',
        })).toBe(true);
        expect(isAwaitingEmployeeReimbursement({
            status: 'approved',
            paymentMethod: 'transfer',
            expenseType: 'services',
        })).toBe(false);
        expect(isAwaitingEmployeeReimbursement({
            status: 'approved',
            paymentMethod: 'cash',
            expenseType: 'partner_expense',
        })).toBe(false);
        expect(isAwaitingEmployeeReimbursement({
            status: 'paid',
            paymentMethod: 'cash',
            expenseType: 'services',
        })).toBe(false);
    });
});
