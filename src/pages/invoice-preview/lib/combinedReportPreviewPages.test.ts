import { describe, expect, it } from 'vitest';
import { projectExpenseIndexes, type CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import { planCombinedReportPreviewPages } from './combinedReportPreviewPages';

function report(overrides: Partial<CombinedReportSnapshot> = {}): CombinedReportSnapshot {
    return {
        feeTitle: 'Fees',
        currency: 'UZS',
        layout: 'perProject',
        projects: [{
            name: 'Nur Kashkadarya Solar',
            lines: [{
                date: '2026-09-10',
                user: 'Alina Abdullaeva',
                initials: 'ADA',
                description: 'Review',
                hours: 11.98,
                rate: 1_500_000,
                amount: 17_970_000,
            }],
        }],
        people: [],
        expenses: [{
            description: 'Travel',
            date: '2026-09-10',
            amount: 594_000,
        }],
        shares: [],
        totalHours: 11.98,
        totalFees: 17_970_000,
        totalExpenses: 594_000,
        ...overrides,
    };
}

describe('per-project combined report pages', () => {
    it('places reimbursable expenses on the project sheet', () => {
        const pages = planCombinedReportPreviewPages(report());
        const withExpenses = pages.filter((page) => page.showExpensesTotal || page.expensesTo > page.expensesFrom);
        expect(withExpenses.length).toBeGreaterThan(0);
        expect(withExpenses.some((page) => page.projectIndex === 0)).toBe(true);
        expect(projectExpenseIndexes(report(), 0)).toEqual([0]);
    });

    it('keeps another project’s expenses off this sheet', () => {
        const snapshot = report({
            projects: [
                { name: 'Nur Kashkadarya Solar', lines: [{ date: '2026-09-10', user: 'Ada', description: 'Review', hours: 1, amount: 100 }] },
                { name: 'Other', lines: [{ date: '2026-09-11', user: 'Ada', description: 'Call', hours: 1, amount: 50 }] },
            ],
            expenses: [
                { description: 'Travel', date: '2026-09-10', amount: 594_000, projectName: 'Nur Kashkadarya Solar' },
                { description: 'Taxi', date: '2026-09-11', amount: 20_000, projectName: 'Other' },
            ],
        });
        expect(projectExpenseIndexes(snapshot, 0)).toEqual([0]);
        expect(projectExpenseIndexes(snapshot, 1)).toEqual([1]);
        const pages = planCombinedReportPreviewPages(snapshot);
        const nur = pages.filter((page) => page.projectIndex === 0 && (page.showExpensesTotal || page.expensesTo > page.expensesFrom));
        expect(nur.length).toBeGreaterThan(0);
        expect(nur.some((page) => page.expensesFrom === 0)).toBe(true);
    });
});
