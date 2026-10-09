import { describe, expect, it } from 'vitest';
import {
    splitDetailRowsForPagedTimeReport,
    TIME_REPORT_PDF_ROWS_LAST_CHUNK,
    TIME_REPORT_PDF_ROWS_MID_CHUNK,
} from './invoiceTimeReportChunking';
import type { InvoiceTimeReportDetailRow } from './invoiceTimeReportModel';

function row(id: string): InvoiceTimeReportDetailRow {
    return {
        date: id,
        initials: 'EB',
        task: '',
        description: `Row ${id}`,
        hours: '1:00',
        hourlyRate: '100,00',
        amount: '100,00',
    };
}

function chunkSizes(n: number): number[] {
    return splitDetailRowsForPagedTimeReport(Array.from({ length: n }, (_, i) => row(String(i + 1)))).map((c) => c.length);
}

describe('splitDetailRowsForPagedTimeReport', () => {
    it('keeps short reports on one page', () => {
        expect(chunkSizes(5)).toEqual([5]);
        expect(chunkSizes(8)).toEqual([8]);
        expect(chunkSizes(TIME_REPORT_PDF_ROWS_LAST_CHUNK)).toEqual([TIME_REPORT_PDF_ROWS_LAST_CHUNK]);
    });

    it('does not create sparse balanced pairs like [4,4]', () => {
        for (let n = 1; n <= TIME_REPORT_PDF_ROWS_LAST_CHUNK; n += 1)
            expect(chunkSizes(n)).toEqual([n]);
        // Just over last-page capacity: fill mid, then last — never half/half.
        expect(chunkSizes(TIME_REPORT_PDF_ROWS_LAST_CHUNK + 1).length).toBeGreaterThanOrEqual(1);
        const over = chunkSizes(TIME_REPORT_PDF_ROWS_LAST_CHUNK + 8);
        expect(over.reduce((a, b) => a + b, 0)).toBe(TIME_REPORT_PDF_ROWS_LAST_CHUNK + 8);
        expect(over[over.length - 1]).toBeLessThanOrEqual(TIME_REPORT_PDF_ROWS_LAST_CHUNK + 5);
    });

    it('keeps the summary page within capacity and mid pages dense', () => {
        expect(chunkSizes(19)).toEqual([19]);
        expect(chunkSizes(24)).toEqual([8, 16]);
        expect(chunkSizes(25)).toEqual([9, 16]);
    });

    it('respects mid-page capacity on longer reports', () => {
        const sizes = chunkSizes(55);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(55);
        for (let i = 0; i < sizes.length - 1; i += 1)
            expect(sizes[i]).toBeLessThanOrEqual(TIME_REPORT_PDF_ROWS_MID_CHUNK);
        expect(sizes[sizes.length - 1]).toBeLessThanOrEqual(TIME_REPORT_PDF_ROWS_LAST_CHUNK + 5);
    });

    it('splits wrapped descriptions before they run into the footer', () => {
        const long = Array.from({ length: 12 }, (_, i) => ({
            ...row(String(i + 1)),
            description: 'Review of the registration with tax authorities issue and related correspondence with the client accountant and the lessor office',
        }));
        const sizes = splitDetailRowsForPagedTimeReport(long).map((c) => c.length);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(12);
        expect(sizes.length).toBeGreaterThan(1);
        expect(Math.max(...sizes)).toBeLessThan(12);
    });

    it('folds tiny penultimate pages into the last page', () => {
        // remaining-LAST would be 3 (< MIN_DENSE_MID_CHUNK) → single page
        expect(chunkSizes(TIME_REPORT_PDF_ROWS_LAST_CHUNK + 3)).toEqual([TIME_REPORT_PDF_ROWS_LAST_CHUNK + 3]);
    });
});
