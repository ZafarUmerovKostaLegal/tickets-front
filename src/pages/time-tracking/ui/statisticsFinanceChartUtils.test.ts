import { describe, expect, it } from 'vitest';
import {
    applyFinanceTopN,
    computeCollectionRatio,
    filterRowsByCurrency,
    financeRowsSummary,
    listCurrencies,
    pickDefaultCurrency,
    sortFinanceRows,
    teamFinanceToChartRows,
} from './statisticsFinanceChartUtils';

describe('statisticsFinanceChartUtils', () => {
    const rows = [
        { currency: 'EUR', billable_amount: 100, paid_amount: 10, payment: 0 },
        { currency: 'USD', billable_amount: 500, paid_amount: 0, payment: 0 },
        { currency: 'eur', billable_amount: 50, paid_amount: 5, payment: 0 },
    ];

    it('lists currencies by accrued weight', () => {
        expect(listCurrencies(rows)).toEqual(['USD', 'EUR']);
    });

    it('picks default currency with highest weight', () => {
        expect(pickDefaultCurrency(rows)).toBe('USD');
    });

    it('filters by currency case-insensitively', () => {
        expect(filterRowsByCurrency(rows, 'eur')).toHaveLength(2);
        expect(filterRowsByCurrency(rows, null)).toHaveLength(3);
    });

    it('maps team finance rows with collection ratio', () => {
        const mapped = teamFinanceToChartRows([{
            team_id: 't1',
            team_name: 'Banking',
            hours: 10,
            billable_hours: 8,
            billable_amount: 1000,
            paid_amount: 200,
            currency: 'usd',
        }]);
        expect(mapped[0]).toMatchObject({
            id: 't1',
            name: 'Banking',
            hours: 10,
            billableHours: 8,
            accrued: 1000,
            paid: 200,
            currency: 'USD',
            collectionRatio: 20,
        });
    });

    it('computes collection ratio', () => {
        expect(computeCollectionRatio(1000, 250)).toBe(25);
        expect(computeCollectionRatio(0, 0)).toBe(0);
        expect(computeCollectionRatio(0, 50)).toBe(100);
    });

    it('sorts finance rows', () => {
        const chartRows = [
            {
                id: 'a',
                name: 'Alpha',
                hours: 5,
                billableHours: 4,
                accrued: 100,
                paid: 80,
                ratePerHour: 16,
                currency: 'USD',
                collectionRatio: 80,
            },
            {
                id: 'b',
                name: 'Beta',
                hours: 12,
                billableHours: 10,
                accrued: 400,
                paid: 100,
                ratePerHour: 8,
                currency: 'USD',
                collectionRatio: 25,
            },
        ];
        expect(sortFinanceRows(chartRows, 'hours').map((r) => r.id)).toEqual(['b', 'a']);
        expect(sortFinanceRows(chartRows, 'collectionRatio').map((r) => r.id)).toEqual(['a', 'b']);
        expect(sortFinanceRows(chartRows, 'name', 'asc').map((r) => r.id)).toEqual(['a', 'b']);
    });

    it('applies top N with Other bucket', () => {
        const chartRows = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
            id: String(n),
            name: `Row ${n}`,
            hours: n * 10,
            billableHours: n * 8,
            accrued: n * 100,
            paid: n * 40,
            ratePerHour: 4,
            currency: 'USD',
            collectionRatio: 40,
        }));
        const limited = applyFinanceTopN(sortFinanceRows(chartRows, 'hours'), 5, 'Other');
        expect(limited).toHaveLength(6);
        expect(limited.slice(0, 5).map((r) => r.id)).toEqual(['7', '6', '5', '4', '3']);
        expect(limited[5]).toMatchObject({
            id: '__other__',
            name: 'Other',
            hours: 30,
            accrued: 300,
            paid: 120,
            collectionRatio: 40,
        });
    });

    it('summarizes finance rows', () => {
        const summary = financeRowsSummary([
            {
                id: 'a',
                name: 'A',
                hours: 10,
                billableHours: 8,
                accrued: 200,
                paid: 50,
                ratePerHour: 5,
                currency: 'USD',
                collectionRatio: 25,
            },
            {
                id: 'b',
                name: 'B',
                hours: 5,
                billableHours: 5,
                accrued: 100,
                paid: 100,
                ratePerHour: 20,
                currency: 'USD',
                collectionRatio: 100,
            },
        ]);
        expect(summary).toEqual({
            hours: 15,
            billableHours: 13,
            accrued: 300,
            paid: 150,
            collectionRatio: 50,
        });
    });
});
