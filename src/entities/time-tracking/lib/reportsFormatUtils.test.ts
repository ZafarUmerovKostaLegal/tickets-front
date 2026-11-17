import { describe, expect, it } from 'vitest';
import type { BudgetRow } from '../api';
import { fmtAmtWithIso, fmtH, formatIsoTimeOnlyRu, formatReportWorkDate, pct, sortCurrencyBuckets } from './reportsFormatUtils';
import { budgetReportHoursMetrics, budgetReportMoneyMetrics, budgetReportRowProgressPercent } from './projectBudgetReportMetrics';

describe('reportsFormatUtils', () => {
    it('formats hours, hiding invalid values', () => {
        expect(fmtH(null)).toBe('—');
        expect(fmtH(-1)).toBe('—');
        expect(fmtH(Number.NaN)).toBe('—');
        expect(fmtH(1.5)).toMatch(/1.*30/);
    });

    it('formats amounts with an ISO currency', () => {
        expect(fmtAmtWithIso(null, 'USD')).toBe('—');
        expect(fmtAmtWithIso(1500, 'uzs')).toMatch(/1\s?500/);
        expect(fmtAmtWithIso(1500, 'uzs')).not.toMatch(/,\d/);
    });

    it('computes percentages safely', () => {
        expect(pct(1, 4)).toBe('25%');
        expect(pct(1, 0)).toBe('—');
        expect(pct(null, 2)).toBe('—');
    });

    it('sorts currency buckets USD, UZS, then the rest by code', () => {
        const sorted = sortCurrencyBuckets([{ currency: 'rub' }, { currency: 'UZS' }, { currency: 'eur' }, { currency: 'USD' }]);
        expect(sorted.map((x) => x.currency)).toEqual(['USD', 'UZS', 'eur', 'rub']);
    });

    it('formats times and work dates', () => {
        expect(formatIsoTimeOnlyRu(null)).toBe('—');
        expect(formatIsoTimeOnlyRu('nope')).toBe('nope');
        expect(formatIsoTimeOnlyRu(new Date(2026, 0, 1, 9, 5, 7).toISOString())).toBe('09:05:07');
        expect(formatReportWorkDate('')).toBe('—');
        expect(formatReportWorkDate('2026-11-17')).toBe('17.11.2026');
        expect(formatReportWorkDate('bad')).toBe('bad');
    });
});

const row = (p: Partial<BudgetRow>) => ({ budget: 100, budget_spent: 40, budget_remaining: 60, ...p } as BudgetRow);

describe('projectBudgetReportMetrics', () => {
    it('returns zeroes for projects without a budget', () => {
        expect(budgetReportHoursMetrics(row({ budget_by: 'none' }))).toEqual({ budget: 0, spent: 0, remaining: 0 });
        expect(budgetReportMoneyMetrics(row({ budget_by: 'none' }))).toEqual({ budget: 0, spent: 0, remaining: 0 });
        expect(budgetReportRowProgressPercent(row({ budget_by: 'none' }))).toBe(0);
        expect(budgetReportRowProgressPercent(row({ budget_by: 'money', has_budget: false }))).toBe(0);
    });

    it('picks the hours or money slice', () => {
        expect(budgetReportHoursMetrics(row({ budget_by: 'hours' }))).toEqual({ budget: 100, spent: 40, remaining: 60 });
        expect(budgetReportMoneyMetrics(row({ budget_by: 'hours' }))).toEqual({ budget: 0, spent: 0, remaining: 0 });
        expect(budgetReportRowProgressPercent(row({ budget_by: 'money' }))).toBe(40);
    });

    it('uses separate limits for "hours and money" and reports the higher progress', () => {
        const r = row({
            budget_by: 'hours_and_money',
            budget_hours_budget: 10,
            budget_hours_spent: 9,
            budget_money_budget: 1000,
            budget_money_spent: 200,
        });
        expect(budgetReportHoursMetrics(r).budget).toBe(10);
        expect(budgetReportMoneyMetrics(r).budget).toBe(1000);
        expect(budgetReportRowProgressPercent(r)).toBe(90);
    });

    it('prefers the backend progress percent when present', () => {
        expect(budgetReportRowProgressPercent(row({ budget_by: 'money', progress_percent: 72.6 }))).toBe(73);
        expect(budgetReportRowProgressPercent(row({ budget_by: 'money', progress_percent: -5 }))).toBe(0);
    });
});
