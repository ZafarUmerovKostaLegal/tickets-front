import { describe, expect, it } from 'vitest';
import {
    buildAttendanceDayExportRows,
    formatIntervalHm,
    fmtYmdDot,
} from './exportAttendanceEmployeePeriodExcel';
import type { PeriodAttendanceItem } from '../model/dailyReportTypes';

function item(partial: Partial<PeriodAttendanceItem> & Pick<PeriodAttendanceItem, 'date'>): PeriodAttendanceItem {
    return {
        app_user_id: 1,
        display_name: 'Madina',
        email: null,
        role: null,
        camera_employee_no: '42',
        camera_name: null,
        status: partial.first_event_time ? 'present_on_time' : 'absent',
        first_event_time: null,
        last_event_time: null,
        ...partial,
    };
}

describe('exportAttendanceEmployeePeriodExcel helpers', () => {
    it('formats dates as DD.MM.YYYY', () => {
        expect(fmtYmdDot('2026-08-10')).toBe('10.08.2026');
    });

    it('formats interval from first/last only', () => {
        expect(formatIntervalHm('2026-08-10T10:09:00+05:00', '2026-08-10T16:39:00+05:00')).toBe('6:30');
        expect(formatIntervalHm('2026-08-10T10:09:00+05:00', null)).toBe('');
    });

    it('builds weekday rows and mark status for the period', () => {
        const rows = buildAttendanceDayExportRows('2026-08-10', '2026-08-14', [
            item({
                date: '2026-08-10',
                first_event_time: '2026-08-10T10:09:00+05:00',
                last_event_time: '2026-08-10T16:39:00+05:00',
                event_count: 4,
                unique_event_count: 4,
            }),
            item({ date: '2026-08-11' }),
        ]);
        // Mon 10 .. Fri 14 = 5 weekdays
        expect(rows).toHaveLength(5);
        expect(rows[0]?.hasMarks).toBe(true);
        expect(rows[0]?.interval).toBe('6:30');
        expect(rows[1]?.hasMarks).toBe(false);
        expect(rows.filter((r) => r.hasMarks)).toHaveLength(1);
    });
});
