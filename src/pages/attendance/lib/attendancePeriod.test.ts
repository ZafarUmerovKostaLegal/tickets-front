import { describe, expect, it } from 'vitest';
import {
    formatDuration,
    formatMinuteOfDay,
    relevantPeriodRows,
    summarizeByEmployee,
    workedTime,
    type AttendanceDayRow,
} from './attendancePeriod';

function row(partial: Partial<AttendanceDayRow> & { date: string }): AttendanceDayRow {
    return {
        app_user_id: 1,
        display_name: 'Iroda Tokhirova',
        email: null,
        role: 'Сотрудник',
        camera_employee_no: '00000025',
        camera_name: 'Iroda Tokhirova',
        status: 'present_on_time',
        first_event_time: null,
        last_event_time: null,
        ...partial,
    };
}

const at = (date: string, hm: string) => new Date(`${date}T${hm}:00`).toISOString();
const NOW = new Date('2026-11-20T15:00:00');

describe('workedTime', () => {
    it('uses the first and last punch', () => {
        const w = workedTime(row({ date: '2026-11-18', first_event_time: at('2026-11-18', '09:10'), last_event_time: at('2026-11-18', '18:40') }), NOW);
        expect(formatDuration(w.ms)).toBe('9:30');
        expect(w.noExit).toBe(false);
    });

    it('counts today up to now while there is no exit punch', () => {
        const w = workedTime(row({ date: '2026-11-20', first_event_time: at('2026-11-20', '10:00') }), NOW);
        expect(w.ongoing).toBe(true);
        expect(formatDuration(w.ms)).toBe('5:00');
    });

    it('does not invent a departure for a past day', () => {
        const w = workedTime(row({ date: '2026-11-18', first_event_time: at('2026-11-18', '10:00') }), NOW);
        expect(w).toEqual({ ms: null, ongoing: false, noExit: true });
    });
});

describe('relevantPeriodRows', () => {
    it('drops weekend absences and future days but keeps weekend visits', () => {
        const rows = [
            row({ date: '2026-11-14', status: 'absent' }), // Saturday off
            row({ date: '2026-11-15', status: 'late', first_event_time: at('2026-11-15', '11:00') }), // came on Sunday
            row({ date: '2026-11-16', status: 'absent' }), // Monday
            row({ date: '2026-11-23', status: 'absent' }), // future
        ];
        expect(relevantPeriodRows(rows, '2026-11-20').map((r) => r.date)).toEqual(['2026-11-15', '2026-11-16']);
    });
});

describe('summarizeByEmployee', () => {
    it('totals days, lateness, hours and average times per person', () => {
        const rows = [
            row({ date: '2026-11-16', first_event_time: at('2026-11-16', '09:00'), last_event_time: at('2026-11-16', '18:00') }),
            row({ date: '2026-11-17', status: 'late', first_event_time: at('2026-11-17', '10:30'), last_event_time: at('2026-11-17', '19:00') }),
            row({ date: '2026-11-18', status: 'absent' }),
            row({ date: '2026-11-19', first_event_time: at('2026-11-19', '09:30') }),
            row({ date: '2026-11-16', app_user_id: 2, camera_employee_no: '00000057', display_name: 'Iroda Bekmurodova', status: 'absent' }),
        ];
        const [first, second] = summarizeByEmployee(rows, NOW);
        expect(first).toMatchObject({ name: 'Iroda Tokhirova', days: 4, present: 3, onTime: 2, late: 1, absent: 1, noExit: 1 });
        expect(formatDuration(first.workedMs)).toBe('17:30');
        expect(formatMinuteOfDay(first.avgArrival)).toBe('09:40');
        expect(formatMinuteOfDay(first.avgDeparture)).toBe('18:30');
        expect(formatMinuteOfDay(first.latestArrival)).toBe('10:30');
        expect(second).toMatchObject({ name: 'Iroda Bekmurodova', days: 1, absent: 1, present: 0 });
        expect(second.avgArrival).toBeNull();
    });
});
