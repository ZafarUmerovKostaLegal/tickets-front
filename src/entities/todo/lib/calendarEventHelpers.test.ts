import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from './calendarApi';
import {
    calendarDateKey,
    calendarEventDurationHours,
    calendarEventIntervalOnDay,
    calendarEventNotesDefault,
    calendarEventOverlapsDay,
    calendarEventStartMs,
    formatCalendarEventCellLabel,
    formatCalendarEventTime,
    indexCalendarEventsByDays,
    matchTelephoneCallsTask,
    parseCalendarDateTime,
} from './calendarEventHelpers';

function event(partial: Partial<CalendarEvent> = {}): CalendarEvent {
    return { id: 'event-1', subject: 'Client call', ...partial };
}

describe('calendarEventHelpers', () => {
    it('parses explicit offsets, UTC aliases and Windows time zones', () => {
        expect(parseCalendarDateTime('2026-07-27T09:00:00Z')?.toISOString())
            .toBe('2026-07-27T09:00:00.000Z');
        expect(parseCalendarDateTime('2026-07-27T09:00:00', 'UTC')?.toISOString())
            .toBe('2026-07-27T09:00:00.000Z');
        expect(parseCalendarDateTime('2026-07-27T09:00:00.1234567Z')?.toISOString())
            .toBe('2026-07-27T09:00:00.123Z');
        expect(parseCalendarDateTime('', 'UTC')).toBeNull();
        expect(parseCalendarDateTime('not-a-date')).toBeNull();
    });

    it('treats an all-day end date as exclusive', () => {
        const ev = event({
            isAllDay: true,
            start: { date: '2026-07-27' },
            end: { date: '2026-07-29' },
        });
        expect(calendarDateKey(new Date(2026, 6, 27))).toBe('2026-07-27');
        expect(calendarEventOverlapsDay(ev, new Date(2026, 6, 27))).toBe(true);
        expect(calendarEventOverlapsDay(ev, new Date(2026, 6, 28))).toBe(true);
        expect(calendarEventOverlapsDay(ev, new Date(2026, 6, 29))).toBe(false);
        expect(calendarEventIntervalOnDay(ev, new Date(2026, 6, 28))).toEqual({ startH: 0, endH: 24 });
        expect(calendarEventDurationHours(ev, new Date(2026, 6, 28))).toBe(0);
    });

    it('clips timed events to the selected day and derives labels', () => {
        const ev = event({
            start: { dateTime: '2026-07-27T09:30:00' },
            end: { dateTime: '2026-07-27T11:00:00' },
        });
        const day = new Date(2026, 6, 27);
        expect(calendarEventOverlapsDay(ev, day)).toBe(true);
        expect(calendarEventIntervalOnDay(ev, day)).toEqual({ startH: 9.5, endH: 11 });
        expect(calendarEventDurationHours(ev, day)).toBe(1.5);
        expect(formatCalendarEventTime(ev)).toContain('09:30');
        expect(formatCalendarEventCellLabel(ev)).toEqual({ time: '09:30', subject: 'Client call' });
        expect(calendarEventStartMs(ev)).toBe(new Date(2026, 6, 27, 9, 30).getTime());
    });

    it('uses a one-hour fallback, rejects very long timed events, and creates useful notes', () => {
        const day = new Date(2026, 6, 27);
        const oneHour = event({ subject: 'Call', start: { dateTime: '2026-07-27T13:00:00' } });
        const tooLong = event({
            start: { dateTime: '2026-07-27T01:00:00' },
            end: { dateTime: '2026-07-27T12:00:00' },
        });
        expect(calendarEventDurationHours(oneHour, day)).toBe(1);
        expect(calendarEventDurationHours(tooLong, day)).toBe(0);
        expect(calendarEventNotesDefault(event({ subject: 'Planning' }))).toBe('Planning');
        expect(calendarEventNotesDefault(oneHour)).toContain('13:00');
    });

    it('matches the telephone task and indexes overlapping events in start order', () => {
        const exact = { id: 't1', name: ' Telephone calls ' };
        const tasks = [{ id: 't0', name: 'Email' }, exact];
        expect(matchTelephoneCallsTask(tasks)).toBe(exact);
        expect(matchTelephoneCallsTask([{ name: 'Telephone call' }])?.name).toBe('Telephone call');
        expect(matchTelephoneCallsTask([{ name: 'Meeting' }])).toBeUndefined();

        const later = event({ id: 'later', start: { dateTime: '2026-07-27T15:00:00' } });
        const earlier = event({ id: 'earlier', start: { dateTime: '2026-07-27T08:00:00' } });
        const indexed = indexCalendarEventsByDays([later, earlier], [
            new Date(2026, 6, 27),
            new Date(2026, 6, 28),
        ]);
        expect(indexed.get('2026-07-27')?.map((item) => item.id)).toEqual(['earlier', 'later']);
        expect(indexed.has('2026-07-28')).toBe(false);
    });
});
