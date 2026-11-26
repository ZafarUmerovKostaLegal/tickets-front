import { describe, expect, it } from 'vitest';
import { projectExpenseIndexes, type CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import { combinedProjectTotals, planCombinedReportPreviewPages } from './combinedReportPreviewPages';

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

describe('summary by project', () => {
    const two = () => report({
        projects: [
            { name: 'Jizzakh', lines: [{ date: '2026-09-10', user: 'A', initials: 'SRA', description: 'x', hours: 10, rate: 100, amount: 1000 }] },
            { name: 'Quva', lines: [
                { date: '2026-09-11', user: 'B', initials: 'IFT', description: 'y', hours: 2.5, rate: 200, amount: 500 },
                { date: '2026-09-12', user: 'B', initials: 'IFT', description: 'z', hours: 1.5, rate: 200, amount: 300 },
            ] },
        ],
        expenses: [{ description: 'Taxi', date: '2026-09-11', amount: 40, projectName: 'Quva' }],
    });

    it('is added once, after the last project, only for several projects', () => {
        const pages = planCombinedReportPreviewPages(two());
        expect(pages.filter((page) => page.showProjectsSummary)).toHaveLength(1);
        expect(pages[pages.length - 1]!.showProjectsSummary).toBe(true);
        expect(planCombinedReportPreviewPages(report()).some((page) => page.showProjectsSummary)).toBe(false);
        expect(planCombinedReportPreviewPages({ ...two(), layout: undefined }).some((page) => page.showProjectsSummary)).toBe(false);
    });

    it('totals hours, fees and expenses per project', () => {
        const { rows, total } = combinedProjectTotals(two());
        expect(rows).toEqual([
            { name: 'Jizzakh', hours: 10, fees: 1000, expenses: 0, total: 1000 },
            { name: 'Quva', hours: 4, fees: 800, expenses: 40, total: 840 },
        ]);
        expect(total).toMatchObject({ hours: 14, fees: 1800, expenses: 40, total: 1840 });
    });
});
