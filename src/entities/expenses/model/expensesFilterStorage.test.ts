import { describe, expect, it } from 'vitest';
import { normalizeExpensesSavedFilters } from './expensesFilterStorage';

describe('normalizeExpensesSavedFilters', () => {
    it('restores valid company filters', () => {
        expect(normalizeExpensesSavedFilters({
            search: 'такси',
            status: 'approved',
            type: 'transport',
            reimbursable: 'reimbursable',
            period: 'custom',
            dateFrom: '2026-07-01',
            dateTo: '2026-07-31',
            sortBy: 'expenseDate',
        }, 'default')).toMatchObject({
            search: 'такси',
            status: 'approved',
            type: 'transport',
            reimbursable: 'reimbursable',
            period: 'custom',
            dateFrom: '2026-07-01',
            dateTo: '2026-07-31',
            sortBy: 'expenseDate',
        });
    });

    it('keeps filters isolated by page variant', () => {
        const raw = {
            status: 'rejected',
            type: 'partner_expense',
            subtype: 'partner_fuel',
            partnerUserId: 42,
        };

        expect(normalizeExpensesSavedFilters(raw, 'moderationQueue').status).toBe('');
        expect(normalizeExpensesSavedFilters(raw, 'default')).toMatchObject({
            type: '',
            subtype: '',
            partnerUserId: '',
        });
        expect(normalizeExpensesSavedFilters(raw, 'partner')).toMatchObject({
            type: '',
            subtype: 'partner_fuel',
            partnerUserId: 42,
        });
    });

    it('restores authorUserId', () => {
        expect(normalizeExpensesSavedFilters({
            authorUserId: 38,
        }, 'default')).toMatchObject({
            authorUserId: 38,
        });
    });

    it('drops invalid persisted values', () => {
        expect(normalizeExpensesSavedFilters({
            status: 'unknown',
            type: 'unknown',
            partnerUserId: -1,
            authorUserId: 0,
            reimbursable: 'yes',
            period: 'forever',
            dateFrom: '31.07.2026',
            sortBy: 'amount',
        }, 'default')).toEqual({
            search: '',
            status: '',
            type: '',
            subtype: '',
            partnerUserId: '',
            authorUserId: '',
            reimbursable: '',
            period: 'all',
            dateFrom: '',
            dateTo: '',
            sortBy: 'createdAt',
        });
    });
});
