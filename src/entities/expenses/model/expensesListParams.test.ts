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
});
