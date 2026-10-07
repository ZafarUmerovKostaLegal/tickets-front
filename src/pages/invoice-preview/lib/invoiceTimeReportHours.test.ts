import { describe, expect, it } from 'vitest';
import { formatTimeReportHours, sumRoundedTimeReportHours } from './invoiceTimeReportModel';

describe('sumRoundedTimeReportHours', () => {
    it('matches the sum of hours shown on each line, not the raw total', () => {
        const lines = [0.083333, 0.25, 0.083333];
        const total = sumRoundedTimeReportHours(lines);
        expect(total).toBe(0.41);
        expect(formatTimeReportHours(total)).toBe('0,41');
        expect(lines.map((n) => formatTimeReportHours(n))).toEqual(['0,08', '0,25', '0,08']);
    });
});
