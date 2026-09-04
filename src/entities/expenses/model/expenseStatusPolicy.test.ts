import { describe, expect, it } from 'vitest';
import type { ExpenseRequest } from './types';
import {
    showDeleteExpenseAction,
    showPayExpenseAction,
    showUnapproveExpenseAction,
    showUnpayExpenseAction,
} from './expenseStatusPolicy';
import { expensePayActionLabel, expenseStatusBadgeClass, expenseStatusLabel } from './expenseStatusLabels';

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
        paymentMethod: 'cash',
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

    it('allows admin delete always; partner except paid/closed', () => {
        expect(showDeleteExpenseAction(expense({ status: 'paid', createdByUserId: 99 }), 42, 'Администратор')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'closed', createdByUserId: 99 }), 42, 'Главный администратор')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'pending_approval', createdByUserId: 99 }), 42, 'Партнер')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'approved', createdByUserId: 99 }), 42, 'Партнёр')).toBe(true);
        expect(showDeleteExpenseAction(expense({ status: 'paid', createdByUserId: 99 }), 42, 'Партнер')).toBe(false);
        expect(showDeleteExpenseAction(expense({ status: 'closed', createdByUserId: 99 }), 42, 'Партнер')).toBe(false);
    });
});

describe('showPayExpenseAction', () => {
    it('allows payment confirmer or moderator for cash reimbursable', () => {
        const approved = expense({ status: 'approved', isReimbursable: true, paymentMethod: 'cash' });
        expect(showPayExpenseAction(approved, false)).toBe(false);
        expect(showPayExpenseAction(approved, false, { isPaymentConfirmer: true })).toBe(true);
        expect(showPayExpenseAction(approved, false, { canModerate: true })).toBe(true);
        expect(showPayExpenseAction(approved, true, { isPaymentConfirmer: true })).toBe(false);
        expect(showPayExpenseAction(approved, true, { canModerate: true })).toBe(false);
    });

    it('allows moderators for transfer reimbursable', () => {
        const approved = expense({ status: 'approved', isReimbursable: true, paymentMethod: 'transfer' });
        expect(showPayExpenseAction(approved, false, { isPaymentConfirmer: true })).toBe(false);
        expect(showPayExpenseAction(approved, false, { canModerate: true })).toBe(true);
        expect(showPayExpenseAction(approved, true, { canModerate: true })).toBe(false);
    });

    it('allows confirmer or moderator for cash even when the client will not reimburse', () => {
        const approved = expense({ status: 'approved', isReimbursable: false, paymentMethod: 'cash' });
        expect(showPayExpenseAction(approved, false, { isPaymentConfirmer: true })).toBe(true);
        expect(showPayExpenseAction(approved, false, { canModerate: true })).toBe(true);
    });

    it('allows moderators for bank transfer even when the client will not reimburse', () => {
        const approved = expense({ status: 'approved', isReimbursable: false, paymentMethod: 'transfer' });
        expect(showPayExpenseAction(approved, false, { isPaymentConfirmer: true })).toBe(false);
        expect(showPayExpenseAction(approved, false, { canModerate: true })).toBe(true);
    });

    it('hides pay for non-approved', () => {
        expect(showPayExpenseAction(expense({ status: 'pending_approval', isReimbursable: true }), false, { isPaymentConfirmer: true })).toBe(false);
    });
});

describe('showUnpayExpenseAction', () => {
    it('mirrors pay rights for paid cash/transfer', () => {
        const paidCash = expense({ status: 'paid', isReimbursable: true, paymentMethod: 'cash' });
        expect(showUnpayExpenseAction(paidCash, false, { isPaymentConfirmer: true })).toBe(true);
        expect(showUnpayExpenseAction(paidCash, false, { canModerate: true })).toBe(true);

        const paidTransfer = expense({ status: 'paid', isReimbursable: true, paymentMethod: 'transfer' });
        expect(showUnpayExpenseAction(paidTransfer, false, { canModerate: true })).toBe(true);
        expect(showUnpayExpenseAction(paidTransfer, false, { isPaymentConfirmer: true })).toBe(false);
    });
});

describe('showUnapproveExpenseAction', () => {
    it('allows moderator for approved (not own)', () => {
        const approved = expense({ status: 'approved' });
        expect(showUnapproveExpenseAction(approved, true, false)).toBe(true);
        expect(showUnapproveExpenseAction(approved, true, true)).toBe(false);
        expect(showUnapproveExpenseAction(approved, false, false)).toBe(false);
        expect(showUnapproveExpenseAction(expense({ status: 'paid' }), true, false)).toBe(false);
    });
});

describe('expenseStatusLabels', () => {
    it('uses reimbursement wording for cash reimbursable approved/paid', () => {
        expect(expenseStatusLabel(expense({ status: 'approved', isReimbursable: true, paymentMethod: 'cash' }))).toBe('Ожидает компенсацию');
        expect(expenseStatusLabel(expense({ status: 'paid', isReimbursable: true, paymentMethod: 'cash' }))).toBe('Возмещено');
        expect(expensePayActionLabel(expense({ isReimbursable: true, paymentMethod: 'cash' }))).toBe('Возмещено');
    });

    it('uses reimbursement wording for cash personal funds even if the client will not reimburse', () => {
        expect(expenseStatusLabel(expense({ status: 'approved', isReimbursable: false, paymentMethod: 'cash' }))).toBe('Ожидает компенсацию');
        expect(expenseStatusLabel(expense({ status: 'paid', isReimbursable: false, paymentMethod: 'cash' }))).toBe('Возмещено');
        expect(expensePayActionLabel(expense({ isReimbursable: false, paymentMethod: 'cash' }))).toBe('Возмещено');
    });

    it('uses payment wording for transfer reimbursable', () => {
        expect(expenseStatusLabel(expense({ status: 'approved', isReimbursable: true, paymentMethod: 'transfer' }))).toBe('Ожидает оплаты');
        expect(expenseStatusLabel(expense({ status: 'paid', isReimbursable: true, paymentMethod: 'transfer' }))).toBe('Оплачено');
        expect(expensePayActionLabel(expense({ isReimbursable: true, paymentMethod: 'transfer' }))).toBe('Оплачено');
        expect(expenseStatusLabel(expense({ status: 'approved', isReimbursable: false, paymentMethod: 'transfer' }))).toBe('Ожидает оплаты');
        expect(expenseStatusLabel(expense({ status: 'paid', isReimbursable: false, paymentMethod: 'transfer' }))).toBe('Оплачено');
        expect(expenseStatusBadgeClass(expense({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'transfer',
        }))).toContain('exp-status--awaiting_payment');
        expect(expenseStatusBadgeClass(expense({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'cash',
        }))).toContain('exp-status--awaiting_reimbursement');
        expect(expenseStatusBadgeClass(expense({
            status: 'approved',
            isReimbursable: true,
            paymentMethod: 'cash',
        }))).not.toContain('exp-status--awaiting_payment');
    });
});
