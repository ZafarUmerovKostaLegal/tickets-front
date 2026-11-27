import { describe, expect, it } from 'vitest';
import {
    buildCombinedReportSnapshot,
    combinedLineRate,
    combinedPeopleRows,
    combinedReportDetailLines,
    combinedReportFlatLines,
    flatFeeTableTitle,
    projectSummaryRows,
    type CombinedReportLine,
    type CombinedReportSnapshot,
} from '@pages/time-tracking/lib/combinedInvoice';
import type { TimeManagerClientProjectRow } from '@entities/time-tracking';
import { combinedProjectTotals, planCombinedReportPreviewPages } from './combinedReportPreviewPages';

const ADA = { user: 'Alina Abdullaeva', initials: 'ADA' };
const lines: CombinedReportLine[] = [
    { ...ADA, date: '2026-10-23', task: 'Drafting', description: 'Employment contract', hours: 2.85, rate: 1_500_000, amount: 4_275_000 },
    { ...ADA, date: '2026-10-24', task: 'Calls', description: 'Calls', hours: 5.15, rate: 1_500_000, amount: 7_725_000 },
    { ...ADA, date: '2026-09-08', task: 'My mehnat registration', description: 'Vacancy removed', hours: 0.4, rate: 575_000, amount: 230_000 },
    { user: 'Vazgen Grigoryan', initials: 'VBG', date: '2026-10-01', task: 'Review', description: 'Review', hours: 10.41, rate: 3_600_000, amount: 37_476_000 },
];

function snapshot(overrides: Partial<CombinedReportSnapshot> = {}): CombinedReportSnapshot {
    return {
        feeTitle: 'Fees for services',
        currency: 'UZS',
        layout: 'perProject',
        projects: [{ name: 'Nur Bukhara Solar', lines }],
        people: [],
        expenses: [],
        shares: [],
        totalHours: 18.81,
        totalFees: 49_706_000,
        totalExpenses: 0,
        ...overrides,
    };
}

describe('combined invoice rates', () => {
    it('keeps every rate as charged: hourly per person and price per My Mehnat entry', () => {
        const rows = projectSummaryRows(snapshot(), 0);
        const ada = rows.filter((row) => row.initials === 'ADA');
        expect(ada).toHaveLength(2);
        expect(ada[0]).toMatchObject({ rate: 1_500_000, hours: 8, amount: 12_000_000 });
        expect(ada[1]).toMatchObject({ rate: 230_000, entries: 1, hours: 0, amount: 230_000 });
        expect(rows.some((row) => Math.abs(row.rate - 1_455_952.38) < 1)).toBe(false);
        expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(49_706_000);
    });

    it('splits a person billed at two hourly rates into two rows', () => {
        const twoRates = snapshot({
            projects: [{
                name: 'P',
                lines: [
                    { ...ADA, date: '2026-10-01', description: 'a', hours: 2, rate: 1_500_000, amount: 3_000_000 },
                    { ...ADA, date: '2026-10-02', description: 'b', hours: 1, rate: 2_000_000, amount: 2_000_000 },
                ],
            }],
        });
        expect(projectSummaryRows(twoRates, 0).map((row) => [row.rate, row.hours])).toEqual([[2_000_000, 1], [1_500_000, 2]]);
    });

    it('moves My Mehnat entries out of the hourly table and prices them per entry', () => {
        const report = snapshot();
        expect(combinedReportDetailLines(report).map((line) => line.task)).not.toContain('My mehnat registration');
        const flat = combinedReportFlatLines(report);
        expect(flat).toHaveLength(1);
        expect(combinedLineRate(flat[0]!)).toBe(230_000);
        expect(flatFeeTableTitle(flat)).toBe('My Mehnat');
        const totals = combinedProjectTotals(report).total;
        expect(totals.fees).toBe(49_706_000);
        expect(totals.hours).toBeCloseTo(18.41, 5);
    });

    it('rebuilds old snapshots saved with one averaged row per person, keeps hand-edited ones', () => {
        const averaged = {
            initials: 'ADA', name: 'Alina Abdullaeva', title: 'Junior Associate', hours: 8.4, rate: 1_455_952.38, amount: 12_230_000,
        };
        const vazgen = { initials: 'VBG', name: 'Vazgen Grigoryan', title: 'Partner', hours: 10.41, rate: 3_600_000, amount: 37_476_000 };
        const old = snapshot({ layout: 'merged', people: [averaged, vazgen], projects: [{ name: 'P', lines, summary: [averaged, vazgen] }] });
        const people = combinedPeopleRows(old);
        expect(people.filter((row) => row.initials === 'ADA').map((row) => row.rate)).toEqual([1_500_000, 230_000]);
        expect(people.find((row) => row.initials === 'ADA')?.title).toBe('Junior Associate');
        expect(projectSummaryRows(old, 0).filter((row) => row.initials === 'ADA')).toHaveLength(2);

        const edited = snapshot({ layout: 'merged', people: [{ ...averaged, amount: 12_500_000, rate: 1_488_095.24 }, vazgen] });
        expect(combinedPeopleRows(edited)[0]!.amount).toBe(12_500_000);
    });

    it('builds new snapshots with the flat-fee flag from the server', () => {
        const report = buildCombinedReportSnapshot({
            feeTitle: 'Fees',
            currency: 'UZS',
            layout: 'perProject',
            projects: [{ id: 'p1', name: 'P' } as TimeManagerClientProjectRow],
            time: [
                { id: 't1', projectId: 'p1', authUserId: 5, workDate: '2026-10-01', hours: 2, description: 'x', billableAmount: 3_000_000, currency: 'UZS' },
                { id: 't2', projectId: 'p1', authUserId: 5, workDate: '2026-10-02', hours: 0.4, description: 'Registration', taskName: 'Registration', billableAmount: 230_000, currency: 'UZS', flatFee: true },
            ],
            expenses: [],
            shares: [],
            users: [{ id: 5, display_name: 'Alina Abdullaeva', position: 'Junior Associate', initials: 'ADA' }],
            totalHours: 2.4,
            totalFees: 3_230_000,
            totalExpenses: 0,
        });
        expect(report.projects[0]!.lines[1]).toMatchObject({ flatFee: true, rate: 230_000 });
        expect(report.people.map((row) => [row.rate, row.entries ?? null])).toEqual([[1_500_000, null], [230_000, 1]]);
    });

    it('plans a page section for the fixed-price table and the letterhead on the first page', () => {
        const pages = planCombinedReportPreviewPages(snapshot());
        expect(pages[0]!.showLetterhead).toBe(true);
        expect(pages.some((page) => page.showFlatTotal && page.flatTo === 1)).toBe(true);
        expect(pages.filter((page) => page.showLetterhead)).toHaveLength(1);
        const merged = planCombinedReportPreviewPages(snapshot({ layout: 'merged' }));
        expect(merged.some((page) => page.showFlatTotal)).toBe(true);
    });
});
