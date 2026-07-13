import { describe, expect, it } from 'vitest';
import {
    canAccessExpensesSection,
    canModerateExpenseRequests,
    canViewExpensesRequestsAndReport,
} from './expenseModeration';

describe('expenseModeration', () => {
    it('canAccessExpensesSection — любая непустая роль', () => {
        expect(canAccessExpensesSection('Сотрудник')).toBe(true);
        expect(canAccessExpensesSection('')).toBe(false);
        expect(canAccessExpensesSection(null)).toBe(false);
    });

    it('canModerateExpenseRequests — только админы и партнёры', () => {
        expect(canModerateExpenseRequests('Администратор')).toBe(true);
        expect(canModerateExpenseRequests('Главный администратор')).toBe(true);
        expect(canModerateExpenseRequests('Партнер')).toBe(true);
        expect(canModerateExpenseRequests('Партнёр')).toBe(true);
        expect(canModerateExpenseRequests('Сотрудник')).toBe(false);
    });

    it('canViewExpensesRequestsAndReport совпадает с модерацией', () => {
        expect(canViewExpensesRequestsAndReport('Администратор')).toBe(true);
        expect(canViewExpensesRequestsAndReport('Сотрудник')).toBe(false);
    });
});
