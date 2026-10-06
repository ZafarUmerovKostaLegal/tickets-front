import { describe, expect, it } from 'vitest';
import { expenseFormValuesToApiBody, resolveAmountUzsForApi } from './saveExpenseFromForm';
import type { ExpenseFormValues } from './types';

function baseValues(over: Partial<ExpenseFormValues> = {}): ExpenseFormValues {
    return {
        description: 'test',
        expenseDate: '2026-10-06',
        expenseType: 'client_expense',
        expenseSubtype: '',
        isReimbursable: false,
        amountCurrency: 'UZS',
        foreignPerUsd: '',
        amountUzs: '44000',
        lockedAmountUzs: null,
        exchangeRate: '11763.90',
        paymentMethod: 'transfer',
        reimbursementCardNumber: '',
        projectId: 'proj-1',
        expenseCategoryId: '',
        vendor: 'HUMANS',
        businessPurpose: '',
        comment: '',
        partnerUserId: '',
        ...over,
    };
}

describe('resolveAmountUzsForApi / locked UZS', () => {
    it('keeps exact UZS when locked even if currency is USD (rounded display)', () => {
        // 44000 / 11763.90 ≈ 3.74; rebuilding from 3.74 would store 43997
        const rebuilt = Math.round(3.74 * 11763.9);
        expect(rebuilt).toBe(43997);

        const values = baseValues({
            amountCurrency: 'USD',
            amountUzs: '3.74',
            lockedAmountUzs: 44000,
            exchangeRate: '11763.90',
        });
        expect(resolveAmountUzsForApi(values)).toBe(44000);
        expect(expenseFormValuesToApiBody(values).amountUzs).toBe(44000);
    });

    it('rebuilds from USD when there is no UZS lock', () => {
        const values = baseValues({
            amountCurrency: 'USD',
            amountUzs: '3.74',
            lockedAmountUzs: null,
            exchangeRate: '11763.90',
        });
        expect(resolveAmountUzsForApi(values)).toBe(43997);
    });

    it('stores exact entered UZS when currency is UZS', () => {
        const values = baseValues({
            amountCurrency: 'UZS',
            amountUzs: '44000',
            lockedAmountUzs: 44000,
            exchangeRate: '11778.45',
        });
        expect(resolveAmountUzsForApi(values)).toBe(44000);
    });
});
