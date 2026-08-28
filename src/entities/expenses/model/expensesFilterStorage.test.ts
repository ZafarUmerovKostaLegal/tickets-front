import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearExpensesSavedFilters,
    defaultExpensesSavedFilters,
    loadExpensesSavedFilters,
    normalizeExpensesSavedFilters,
    saveExpensesSavedFilters,
} from './expensesFilterStorage';

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

describe('clearExpensesSavedFilters', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('removes stored filters so the next load is empty', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('window', {
            localStorage: {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value);
                },
                removeItem: (key: string) => {
                    store.delete(key);
                },
            },
        });

        saveExpensesSavedFilters(7, 'default', {
            ...defaultExpensesSavedFilters(),
            status: 'approved',
        });
        expect(loadExpensesSavedFilters(7, 'default').status).toBe('approved');

        clearExpensesSavedFilters(7, 'default');
        expect(loadExpensesSavedFilters(7, 'default')).toEqual(defaultExpensesSavedFilters());
    });
});
