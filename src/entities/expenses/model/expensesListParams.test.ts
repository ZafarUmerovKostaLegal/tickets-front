import { describe, expect, it } from 'vitest';
import { buildExpensesListParams } from './expensesListParams';

const base = {
    isModerationQueue: false,
    search: '',
    filterStatus: '' as const,
    filterType: '' as const,
    filterReimb: '' as const,
    page: 1,
};

describe('buildExpensesListParams', () => {
    it('maps month preset to dateFrom/dateTo', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'month',
        });
        expect(p.dateFrom).toMatch(/^\d{4}-\d{2}-01$/);
        expect(p.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.sortBy).toBe('createdAt');
    });

    it('maps custom range and normalizes reversed dates', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'custom',
            filterDateFrom: '2026-06-30',
            filterDateTo: '2026-06-01',
        });
        expect(p.dateFrom).toBe('2026-06-01');
        expect(p.dateTo).toBe('2026-06-30');
    });

    it('uses expenseDate sort when requested', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            sortBy: 'expenseDate',
        });
        expect(p.sortBy).toBe('expenseDate');
    });

    it('forces pending_approval on moderation queue', () => {
        const p = buildExpensesListParams({
            ...base,
            isModerationQueue: true,
            filterPeriod: 'all',
            filterStatus: 'approved',
        });
        expect(p.status).toBe('pending_approval');
    });

    it('applies company scopeMode and skips partner_expense type filter', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            filterType: 'partner_expense' as const,
            scopeMode: 'company',
        });
        expect(p.scopeMode).toBe('company');
        expect(p.expenseType).toBeUndefined();
    });

    it('sends the selected expense type together with company scope', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            filterType: 'transport',
            scopeMode: 'company',
        });
        expect(p.scopeMode).toBe('company');
        expect(p.expenseType).toBe('transport');
    });

    it('applies partner scope with subtype and partnerUserId', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            scopeMode: 'partner',
            filterSubtype: 'partner_fuel',
            filterPartnerUserId: 42,
        });
        expect(p.scopeMode).toBe('partner');
        expect(p.expenseType).toBe('partner_expense');
        expect(p.expenseSubtype).toBe('partner_fuel');
        expect(p.partnerUserId).toBe(42);
    });

    it('forces client_expense type for client tab', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            scopeMode: 'company',
            forceExpenseType: 'client_expense',
        });
        expect(p.expenseType).toBe('client_expense');
        expect(p.excludeExpenseType).toBeUndefined();
    });

    it('includes client_expense on company tab when not filtered', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            scopeMode: 'company',
        });
        expect(p.excludeExpenseType).toBeUndefined();
        expect(p.expenseType).toBeUndefined();
    });

    it('can still exclude client_expense when requested', () => {
        const p = buildExpensesListParams({
            ...base,
            filterPeriod: 'all',
            scopeMode: 'company',
            excludeExpenseType: 'client_expense',
        });
        expect(p.excludeExpenseType).toBe('client_expense');
        expect(p.expenseType).toBeUndefined();
    });
});
