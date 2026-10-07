import { describe, expect, it } from 'vitest';
import {
    emptyInvoiceTimeReportPack,
    ensureMehnatSeparatedPack,
    formatTimeReportHours,
    sumRoundedTimeReportHours,
} from './invoiceTimeReportModel';

describe('sumRoundedTimeReportHours', () => {
    it('matches the sum of hours shown on each line, not the raw total', () => {
        const lines = [0.083333, 0.25, 0.083333];
        const total = sumRoundedTimeReportHours(lines);
        expect(total).toBe(0.41);
        expect(formatTimeReportHours(total)).toBe('0,41');
        expect(lines.map((n) => formatTimeReportHours(n))).toEqual(['0,08', '0,25', '0,08']);
    });

    it('rewrites a saved pack total from the hours already printed on each line', () => {
        const base = emptyInvoiceTimeReportPack('UZS');
        const row = (initials: string, hours: string) => ({
            date: '04.09.2026',
            initials,
            task: 'Emails',
            description: 'note',
            hours,
            hourlyRate: 'UZS 1,375,000.00',
            amount: 'UZS 110,000.00',
        });
        const pack = ensureMehnatSeparatedPack({
            ...base,
            detailSlots: [row('ADA', '0,08'), row('DSHD', '0,25'), row('ADA', '0,08')],
            detailTotalHoursDisplay: '0,42',
            summaryGrandHoursDisplay: '0,42',
            summarySlots: [
                { initials: 'DSHD', name: 'Dilnoza', title: 'Associate', hours: '0,25', hourlyRate: '—', totalPrice: '—' },
                { initials: 'ADA', name: 'Alina', title: 'Junior Associate', hours: '0,17', hourlyRate: '—', totalPrice: '—' },
                ...base.summarySlots.slice(2),
            ],
        });
        expect(pack.detailTotalHoursDisplay).toBe('0,41');
        expect(pack.summaryGrandHoursDisplay).toBe('0,41');
        expect(pack.summarySlots[1]?.hours).toBe('0,16');
    });

    it('rounds each line before adding, so 0.083 + 0.084 is 0.16 not 0.17', () => {
        const base = emptyInvoiceTimeReportPack('UZS');
        const row = (initials: string, hours: string) => ({
            date: '04.09.2026',
            initials,
            task: 'Emails',
            description: 'note',
            hours,
            hourlyRate: 'UZS 1,375,000.00',
            amount: 'UZS 110,000.00',
        });
        const pack = ensureMehnatSeparatedPack({
            ...base,
            detailSlots: [row('ADA', '0.083'), row('DSHD', '0.25'), row('ADA', '0.084')],
            detailTotalHoursDisplay: '0.42',
            summaryGrandHoursDisplay: '0.42',
            summarySlots: [
                { initials: 'DSHD', name: 'Dilnoza', title: 'Associate', hours: '0.25', hourlyRate: '—', totalPrice: '—' },
                { initials: 'ADA', name: 'Alina', title: 'Junior Associate', hours: '0.17', hourlyRate: '—', totalPrice: '—' },
                ...base.summarySlots.slice(2),
            ],
        });
        expect(pack.detailSlots[0]?.hours).toBe('0,08');
        expect(pack.detailSlots[2]?.hours).toBe('0,08');
        expect(pack.summarySlots[1]?.hours).toBe('0,16');
        expect(pack.detailTotalHoursDisplay).toBe('0,41');
        expect(pack.summaryGrandHoursDisplay).toBe('0,41');
    });
});
