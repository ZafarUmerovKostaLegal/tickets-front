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
        expect(chunkSizes(TIME_REPORT_PDF_ROWS_LAST_CHUNK)).toEqual([TIME_REPORT_PDF_ROWS_LAST_CHUNK]);
    });

    it('keeps the summary page within its reduced capacity', () => {
        expect(chunkSizes(19)).toEqual([12, 7]);
        expect(chunkSizes(23)).toEqual([16, 7]);
        expect(chunkSizes(24)).toEqual([17, 7]);
    });

    it('respects last-page and mid-page capacity limits', () => {
        const sizes = chunkSizes(35);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(35);
        expect(sizes[sizes.length - 1]).toBeLessThanOrEqual(TIME_REPORT_PDF_ROWS_LAST_CHUNK);
        for (let i = 0; i < sizes.length - 1; i += 1)
            expect(sizes[i]).toBeLessThanOrEqual(TIME_REPORT_PDF_ROWS_MID_CHUNK);
    });

    it('avoids tiny first pages when a balanced two-page split fits', () => {
        for (let n = TIME_REPORT_PDF_ROWS_LAST_CHUNK + 1; n <= TIME_REPORT_PDF_ROWS_LAST_CHUNK + TIME_REPORT_PDF_ROWS_MID_CHUNK; n += 1) {
            const sizes = chunkSizes(n);
            if (sizes.length !== 2)
                continue;
            const [first, second] = sizes;
            expect(second).toBeLessThanOrEqual(TIME_REPORT_PDF_ROWS_LAST_CHUNK);
            if (n <= TIME_REPORT_PDF_ROWS_LAST_CHUNK * 2)
                expect(Math.abs(first - second)).toBeLessThanOrEqual(2);
        }
    });
});
