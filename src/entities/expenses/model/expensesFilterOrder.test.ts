import { describe, expect, it } from 'vitest';
import {
    availableExpensesFilterSlots,
    mergeExpensesFilterOrder,
    normalizeExpensesFilterOrder,
    reorderExpensesFilterOrder,
} from './expensesFilterOrder';

describe('expensesFilterOrder', () => {
    it('builds available slots by variant', () => {
        expect(availableExpensesFilterSlots({ variant: 'default', canModerate: true })).toEqual([
            'status',
            'type',
            'author',
            'reimbursable',
            'period',
            'sort',
        ]);
        expect(availableExpensesFilterSlots({ variant: 'partner', canModerate: false })).toEqual([
            'status',
            'subtype',
            'partner',
            'reimbursable',
            'period',
            'sort',
        ]);
        expect(availableExpensesFilterSlots({ variant: 'moderationQueue', canModerate: true })).toEqual([
            'type',
            'author',
            'reimbursable',
            'period',
            'sort',
        ]);
    });

    it('merges saved order with newly available slots', () => {
        expect(mergeExpensesFilterOrder(
            ['period', 'status', 'type'],
            ['status', 'type', 'author', 'reimbursable', 'period', 'sort'],
        )).toEqual(['period', 'status', 'type', 'author', 'reimbursable', 'sort']);
    });

    it('reorders by drop target', () => {
        expect(reorderExpensesFilterOrder(
            ['status', 'type', 'author', 'period'],
            'author',
            'status',
        )).toEqual(['author', 'status', 'type', 'period']);
    });

    it('normalizes persisted values', () => {
        expect(normalizeExpensesFilterOrder(['period', 'nope', 'status', 'status'])).toEqual([
            'period',
            'status',
        ]);
        expect(normalizeExpensesFilterOrder(null)).toBeNull();
    });
});
