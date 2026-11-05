import { describe, expect, it } from 'vitest';
import type { TimeManagerClientProjectRow } from '@entities/time-tracking';
import {
    applyCombinedExpenseAmounts,
    buildCombinedShares,
    combinedExpenseAmount,
    formatCombinedShareNote,
    type CombinedExpenseLine,
    type CombinedReportSnapshot,
    type CombinedTimeLine,
} from './combinedInvoice';

function project(id: string, name: string, clientId: string): TimeManagerClientProjectRow {
    return { id, name, client_id: clientId } as TimeManagerClientProjectRow;
}

function timeLine(projectId: string, amount: number, hours = 1): CombinedTimeLine {
    return {
        id: `${projectId}-${amount}`,
        authUserId: 1,
        workDate: '2026-06-01',
        hours,
        description: null,
        billableAmount: amount,
        currency: 'USD',
        projectId,
    };
}

function expenseLine(projectId: string, amount: number): CombinedExpenseLine {
    return {
        id: `${projectId}-e-${amount}`,
        expenseDate: '2026-06-02',
        description: null,
        equivalentAmount: amount,
        status: 'approved',
        projectId,
    };
}

describe('buildCombinedShares', () => {
    const clients = new Map([
        ['c1', 'Nur Solar'],
        ['c2', 'Other'],
    ]);
    const projects = [
        project('p1', 'Nur A', 'c1'),
        project('p2', 'Nur B', 'c2'),
    ];

    it('splits by timesheet amounts', () => {
        const shares = buildCombinedShares(
            projects,
            clients,
            [timeLine('p1', 80, 8), timeLine('p2', 20, 2)],
            [expenseLine('p1', 10)],
            'hours',
        );
        expect(shares).toHaveLength(2);
        expect(shares[0]!.percent).toBe(80);
        expect(shares[0]!.fees).toBe(80);
        expect(shares[0]!.expenses).toBe(10);
        expect(shares[0]!.total).toBe(90);
        expect(shares[1]!.percent).toBe(20);
        expect(shares[1]!.fees).toBe(20);
        expect(shares[1]!.expenses).toBe(0);
    });

    it('splits fees and expenses equally across projects', () => {
        const shares = buildCombinedShares(
            projects,
            clients,
            [timeLine('p1', 80), timeLine('p2', 20)],
            [expenseLine('p1', 10)],
            'equal',
        );
        expect(shares[0]!.percent).toBe(50);
        expect(shares[1]!.percent).toBe(50);
        expect(shares[0]!.fees).toBe(50);
        expect(shares[1]!.fees).toBe(50);
        expect(shares[0]!.expenses).toBe(5);
        expect(shares[1]!.expenses).toBe(5);
        expect(shares[0]!.total).toBe(55);
    });

    it('uses the som amount when the report is in UZS', () => {
        const line = expenseLine('p1', 16.78);
        line.amountUzs = 213_000;
        const shares = buildCombinedShares(
            [project('p1', 'Nur Kashkadarya Solar', 'c1')],
            clients,
            [timeLine('p1', 25_642_050, 14.72)],
            [line],
            'hours',
            'UZS',
        );
        expect(combinedExpenseAmount(line, 'USD')).toBe(16.78);
        expect(shares[0]!.expenses).toBe(213_000);
        expect(shares[0]!.total).toBe(25_642_050 + 213_000);
    });
});

describe('applyCombinedExpenseAmounts', () => {
    it('replaces dollar expense lines on a saved sums report', () => {
        const report: CombinedReportSnapshot = {
            feeTitle: 'Fees',
            currency: 'UZS',
            projects: [],
            people: [],
            expenses: [
                { description: 'state fee', date: '2026-09-10', amount: 16.78 },
                { description: 'state fee', date: '2026-09-10', amount: 16.78 },
                { description: 'state fee', date: '2026-09-11', amount: 16.8 },
            ],
            shares: [{ name: 'Nur Kashkadarya Solar', percent: 100, expenses: 50.36, total: 25_642_100.36 }],
            totalHours: 14.72,
            totalFees: 25_642_050,
            totalExpenses: 50.36,
        };
        const next = applyCombinedExpenseAmounts(report, [213_000, 213_000, 214_000]);
        expect(next.totalExpenses).toBe(640_000);
        expect(next.expenses.map((line) => line.amount)).toEqual([213_000, 213_000, 214_000]);
        expect(next.shares[0]!.expenses).toBe(640_000);
        expect(next.shares[0]!.total).toBe(25_642_050 + 640_000);
    });

    it('leaves a USD report unchanged', () => {
        const report: CombinedReportSnapshot = {
            feeTitle: 'Fees',
            currency: 'USD',
            projects: [],
            people: [],
            expenses: [{ description: 'state fee', date: '2026-09-10', amount: 16.78 }],
            shares: [{ name: 'Nur', percent: 100, expenses: 16.78, total: 116.78 }],
            totalHours: 1,
            totalFees: 100,
            totalExpenses: 16.78,
        };
        expect(applyCombinedExpenseAmounts(report, [213_000])).toBe(report);
    });
});

describe('formatCombinedShareNote', () => {
    it('prints one line per share', () => {
        const note = formatCombinedShareNote([
            {
                projectId: 'p1',
                projectName: 'Nur A',
                clientName: 'Nur Solar',
                percent: 50,
                fees: 100,
                expenses: 10,
                total: 110,
            },
        ]);
        expect(note).toContain('Nur A (Nur Solar): 50.00%');
        expect(note).toContain('110.00');
    });
});
