import { describe, expect, it } from 'vitest';
import type { ExpenseRequest } from './types';
import { showDeleteExpenseAction, showPayExpenseAction } from './expenseStatusPolicy';
import { expensePayActionLabel, expenseStatusLabel } from './expenseStatusLabels';

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

describe('showPayExpenseAction', () => {
    it('allows only payment confirmer for approved reimbursable', () => {
        const approved = expense({ status: 'approved', isReimbursable: true });
        expect(showPayExpenseAction(approved, false)).toBe(false);
        expect(showPayExpenseAction(approved, false, { isPaymentConfirmer: true })).toBe(true);
        expect(showPayExpenseAction(approved, true, { isPaymentConfirmer: true })).toBe(false);
    });

    it('hides pay for non-reimbursable and non-approved', () => {
        expect(showPayExpenseAction(expense({ status: 'approved', isReimbursable: false }), false, { isPaymentConfirmer: true })).toBe(false);
        expect(showPayExpenseAction(expense({ status: 'pending_approval', isReimbursable: true }), false, { isPaymentConfirmer: true })).toBe(false);
    });
});

describe('expenseStatusLabels', () => {
    it('uses reimbursement wording for reimbursable approved/paid', () => {
        expect(expenseStatusLabel(expense({ status: 'approved', isReimbursable: true }))).toBe('Ожидает возмещения');
        expect(expenseStatusLabel(expense({ status: 'paid', isReimbursable: true }))).toBe('Возмещено');
        expect(expensePayActionLabel(expense({ isReimbursable: true }))).toBe('Возмещено');
    });
});
