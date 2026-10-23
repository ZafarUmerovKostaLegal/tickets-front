import { describe, expect, it } from 'vitest';
import { emptyInvoiceTimeReportPack } from './invoiceTimeReportModel';
import {
    isGeneratedTimeReportHeading,
    timeReportHeading,
    timeReportServicesMonthYear,
} from './invoiceTimeReportI18n';

describe('time report heading period', () => {
    it('uses months from report rows instead of a saved generated title', () => {
        const pack = emptyInvoiceTimeReportPack('EUR');
        pack.detailSlots = [{
            date: '16.10.2026',
            initials: 'ANM',
            task: 'Research',
            description: 'Review',
            hours: '1,30',
            hourlyRate: 'EUR 150.00',
            amount: 'EUR 195.00',
        }];
        pack.reportTitle = 'TIME REPORT FOR SERVICES PROVIDED IN OCTOBER 2016, NOVEMBER 2016 AND OCTOBER 2018';
        expect(isGeneratedTimeReportHeading(pack.reportTitle)).toBe(true);
        expect(timeReportServicesMonthYear(pack, 'October 2016, November 2016 and October 2018', 'ENG')).toBe('October 2026');
        expect(timeReportHeading({
            language: 'ENG',
            servicesMonthYear: timeReportServicesMonthYear(pack, 'October 2016', 'ENG'),
            continuation: false,
            reportTitle: pack.reportTitle,
        })).toBe('TIME REPORT FOR SERVICES PROVIDED IN OCTOBER 2026');
        expect(timeReportHeading({
            language: 'ENG',
            servicesMonthYear: 'October 2026',
            continuation: false,
            reportTitle: 'TIME REPORT FOR SERVICES PROVIDED IN OCTOBER 2026 — REVISED',
        })).toBe('TIME REPORT FOR SERVICES PROVIDED IN OCTOBER 2026 — REVISED');
    });

    it('keeps a custom title that is not the generated template', () => {
        expect(timeReportHeading({
            language: 'ENG',
            servicesMonthYear: 'October 2026',
            continuation: false,
            reportTitle: 'Fees for October',
        })).toBe('Fees for October');
    });
});
