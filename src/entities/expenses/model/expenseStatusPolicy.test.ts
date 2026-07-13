import { describe, expect, it } from 'vitest';
import type { ExpenseRequest } from './types';
import { showDeleteExpenseAction } from './expenseStatusPolicy';

function expense(overrides: Partial<ExpenseRequest> = {}): ExpenseRequest {
    return {
        id: 'KL000001',
        description: 'test',
        expenseDate: '2026-01-01',
        amountUzs: 1000,
        exchangeRate: 12000,
        equivalentAmount: 0.08,
        expenseType: 'client_expense',
        isReimbursable: true,
        status: 'draft',
        createdByUserId: 42,
        ...overrides,
    } as ExpenseRequest;
}

describe('showDeleteExpenseAction', () => {
    it('allows author to delete draft, revision, pending, withdrawn, rejected', () => {
        expect(showDeleteExpenseAction(expense({ status: 'draft' }), 42, 'Сотрудник')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'revision_required' }), 42, 'Сотрудник')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'pending_approval' }), 42, 'Сотрудник')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'withdrawn' }), 42, 'Сотрудник')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'rejected' }), 42, 'Сотрудник')).toBe(true);
    });

    it('denies author delete for approved, paid, closed', () => {
        expect(showDeleteExpenseAction(expense({ status: 'approved' }), 42, 'Сотрудник')).toBe(false);
        expect(showDeleteExpenseAction(expense({ status: 'paid' }), 42, 'Сотрудник')).toBe(false);
        expect(showDeleteExpenseAction(expense({ status: 'closed' }), 42, 'Сотрудник')).toBe(false);
    });

    it('denies non-author delete for employees', () => {
        expect(showDeleteExpenseAction(expense({ status: 'draft' }), 99, 'Сотрудник')).toBe(false);
    });

    it('allows administrators to delete any expense', () => {
        expect(showDeleteExpenseAction(expense({ status: 'approved', createdByUserId: 99 }), 42, 'Администратор')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'paid', createdByUserId: 99 }), 42, 'Главный администратор')).toBe(true);
    });

    it('allows moderators to delete except paid and closed', () => {
        expect(showDeleteExpenseAction(expense({ status: 'pending_approval', createdByUserId: 99 }), 42, 'Партнер')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'approved', createdByUserId: 99 }), 42, 'Партнёр')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'paid', createdByUserId: 99 }), 42, 'Партнер')).toBe(false);
        expect(showDeleteExpenseAction(expense({ status: 'closed', createdByUserId: 99 }), 42, 'Партнер')).toBe(false);
    });
});
