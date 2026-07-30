import { describe, expect, it } from 'vitest';
import { formatUnpaidExpenseListLines } from './projectUnpaidExpenses';
import type { ExpenseRequest } from '@entities/expenses/model/types';

function stub(partial: Partial<ExpenseRequest> & Pick<ExpenseRequest, 'id'>): ExpenseRequest {
    return {
        description: '',
        expenseDate: '2026-07-15',
        amountUzs: 1000,
        exchangeRate: 12000,
        equivalentAmount: 0.08,
        expenseType: 'client_expense',
        isReimbursable: true,
        status: 'approved',
        createdByUserId: 1,
        updatedByUserId: 1,
        createdAt: '',
        updatedAt: '',
        ...partial,
    } as ExpenseRequest;
}

describe('formatUnpaidExpenseListLines', () => {
    it('formats id, date, description and amount', () => {
        const text = formatUnpaidExpenseListLines([
            stub({ id: 'KL001290', description: 'Taxi', amountUzs: 300000 }),
        ]);
        expect(text).toContain('KL001290');
        expect(text).toContain('15.07.2026');
        expect(text).toContain('Taxi');
        expect(text).toContain('300');
        expect(text).toContain('UZS');
    });

    it('truncates long lists', () => {
        const rows = Array.from({ length: 14 }, (_, i) => stub({ id: `KL${i}` }));
        const text = formatUnpaidExpenseListLines(rows, 3);
        expect(text.split('\n')).toHaveLength(4);
        expect(text).toContain('… +11');
    });
});
