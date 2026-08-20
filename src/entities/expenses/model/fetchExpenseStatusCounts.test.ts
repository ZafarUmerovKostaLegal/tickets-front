import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./expensesApi', () => ({
    fetchExpenses: vi.fn(),
}));

import { fetchExpenses } from './expensesApi';
import { fetchExpenseStatusCounts, formatExpenseStatusCount } from './fetchExpenseStatusCounts';

describe('formatExpenseStatusCount', () => {
    it('formats counts for badges', () => {
        expect(formatExpenseStatusCount(undefined)).toBeNull();
        expect(formatExpenseStatusCount(0)).toBe('0');
        expect(formatExpenseStatusCount(12)).toBe('12');
        expect(formatExpenseStatusCount(100)).toBe('99+');
    });
});

describe('fetchExpenseStatusCounts', () => {
    beforeEach(() => {
        vi.mocked(fetchExpenses).mockReset();
    });

    it('loads all + per-status totals with status cleared from base filters', async () => {
        vi.mocked(fetchExpenses).mockImplementation(async (params) => ({
            items: [],
            total: params.status === 'approved' ? 7 : params.status ? 1 : 20,
            skip: 0,
            limit: 1,
        }));

        const counts = await fetchExpenseStatusCounts({
            search: '',
            filterType: 'transport',
            filterReimb: '',
            filterPeriod: 'all',
            scopeMode: 'company',
        });

        expect(counts.all).toBe(20);
        expect(counts.approved).toBe(7);
        expect(counts.draft).toBe(1);
        expect(vi.mocked(fetchExpenses).mock.calls.some(([p]) => p.status === undefined || p.status === '')).toBe(true);
        expect(vi.mocked(fetchExpenses).mock.calls.some(([p]) => p.expenseType === 'transport')).toBe(true);
    });
});
