import { describe, expect, it } from 'vitest';
import { dueDateFromCalendarDays, invoiceCalendarDayCount, invoiceWorkingDayCount } from './invoiceDueDays';

describe('invoiceDueDays', () => {
    it('counts calendar and working days without the end date', () => {
        expect(invoiceCalendarDayCount('2026-10-13', '2026-10-28', false)).toBe(15);
        expect(invoiceWorkingDayCount('2026-10-13', '2026-10-28', false)).toBe(11);
    });

    it('includes the end date when asked', () => {
        expect(invoiceCalendarDayCount('2026-10-13', '2026-10-28', true)).toBe(16);
        expect(invoiceWorkingDayCount('2026-10-13', '2026-10-28', true)).toBe(12);
    });

    it('moves the due date from a calendar-day count', () => {
        expect(dueDateFromCalendarDays('2026-10-13', 15, false)).toBe('2026-10-28');
        expect(dueDateFromCalendarDays('2026-10-13', 16, true)).toBe('2026-10-28');
    });
});
