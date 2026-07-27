import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    addDays,
    addMonths,
    endOfMonth,
    fmtDateHeading,
    fmtHours,
    fmtShort,
    formatDate,
    getTodayDate,
    isFutureCalendarDay,
    isFutureWorkDateYmd,
    isSameDay,
    isSameMonth,
    parseYmd,
    readStoredTimesheetViewMode,
    readStoredWeekDayOrder,
    reorderWeekDaysFromToday,
    startOfMonth,
    startOfWeek,
    weekdayLabels,
    writeStoredTimesheetViewMode,
    writeStoredWeekDayOrder,
} from './timesheetDateUtils';

afterEach(() => vi.unstubAllGlobals());

describe('timesheetDateUtils', () => {
    it('calculates week and month boundaries without mutating the source', () => {
        const sunday = new Date(2026, 7, 2, 15, 30);
        const monday = startOfWeek(sunday);
        expect(formatDate(monday)).toBe('2026-07-27');
        expect(monday.getHours()).toBe(0);
        expect(sunday.getHours()).toBe(15);
        expect(formatDate(addDays(monday, 7))).toBe('2026-08-03');
        expect(formatDate(startOfMonth(sunday))).toBe('2026-08-01');
        expect(formatDate(endOfMonth(sunday))).toBe('2026-08-31');
        expect(formatDate(addMonths(sunday, 1))).toBe('2026-09-02');
        expect(isSameMonth(sunday, new Date(2026, 7, 30))).toBe(true);
        expect(isSameMonth(sunday, new Date(2026, 8, 2))).toBe(false);
    });

    it('orders only the current week from today', () => {
        const weekStart = new Date(2026, 6, 27);
        const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
        const reordered = reorderWeekDaysFromToday(days, weekStart, new Date(2026, 6, 30));
        expect(reordered.map(formatDate)).toEqual([
            '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02',
            '2026-07-27', '2026-07-28', '2026-07-29',
        ]);
        expect(reorderWeekDaysFromToday(days, weekStart, weekStart)).toBe(days);
        expect(reorderWeekDaysFromToday(days, addDays(weekStart, -7), new Date(2026, 6, 30))).toBe(days);
        expect(isSameDay(days[0], new Date(2026, 6, 27, 23))).toBe(true);
        expect(isSameDay(days[0], days[1])).toBe(false);
    });

    it('validates future work dates and parses YMD locally', () => {
        const today = new Date(2026, 6, 27);
        expect(parseYmd('2026-08-01')).toEqual(new Date(2026, 7, 1));
        expect(isFutureCalendarDay(new Date(2026, 6, 28, 23), today)).toBe(true);
        expect(isFutureCalendarDay(new Date(2026, 6, 27, 23), today)).toBe(false);
        expect(isFutureWorkDateYmd('2026-07-28T00:00:00Z', today)).toBe(true);
        expect(isFutureWorkDateYmd('tomorrow', today)).toBe(false);
    });

    it('reads and writes persisted view preferences defensively', () => {
        const store = new Map<string, string>();
        const localStorage = {
            getItem: vi.fn((key: string) => store.get(key) ?? null),
            setItem: vi.fn((key: string, value: string) => store.set(key, value)),
        };
        vi.stubGlobal('window', { localStorage });

        expect(readStoredTimesheetViewMode()).toBeNull();
        expect(readStoredWeekDayOrder()).toBe('monday');
        writeStoredTimesheetViewMode('calendar');
        writeStoredWeekDayOrder('today');
        expect(readStoredTimesheetViewMode()).toBe('calendar');
        expect(readStoredWeekDayOrder()).toBe('today');
        expect(localStorage.setItem).toHaveBeenCalledTimes(2);

        store.set('tt-timesheet-view-mode-v1', 'unknown');
        store.set('tt-timesheet-week-day-order-v1', 'unknown');
        expect(readStoredTimesheetViewMode()).toBeNull();
        expect(readStoredWeekDayOrder()).toBe('monday');
    });

    it('formats labels through the supplied locale and translator', () => {
        const labels = weekdayLabels((key) => String(key).split('.').at(-1) ?? '');
        expect(labels).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
        expect(fmtShort(new Date(2026, 6, 27), 'en-US')).toBe('MON');
        expect(fmtDateHeading(new Date(2026, 6, 27), 'en-US')).toContain('27');
        expect(fmtHours(1.5)).toBe('1:30');
        const today = getTodayDate();
        expect(today.getHours()).toBe(0);
        expect(today.getMinutes()).toBe(0);
    });
});
