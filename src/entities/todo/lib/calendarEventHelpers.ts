import { fromZonedTime } from 'date-fns-tz';
import type { CalendarEvent } from './calendarApi';

function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

const WINDOWS_TO_IANA: Record<string, string> = {
    UTC: 'UTC',
    'GMT Standard Time': 'Europe/London',
    'W. Europe Standard Time': 'Europe/Berlin',
    'Russian Standard Time': 'Europe/Moscow',
    'Central Asia Standard Time': 'Asia/Tashkent',
    'Ekaterinburg Standard Time': 'Asia/Yekaterinburg',
    'Azerbaijan Standard Time': 'Asia/Baku',
    'Georgian Standard Time': 'Asia/Tbilisi',
    'Arabian Standard Time': 'Asia/Dubai',
    'Turkey Standard Time': 'Europe/Istanbul',
};

function resolveIanaTimeZone(timeZone?: string): string | null {
    const tz = (timeZone ?? '').trim();
    if (!tz)
        return null;
    if (tz.includes('/'))
        return tz;
    return WINDOWS_TO_IANA[tz] ?? null;
}

function stripFractionalSeconds(value: string): string {
    return value.replace(/(\.\d{3})\d+/, '$1');
}

export function calendarDateKey(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseCalendarDateTime(dateTime: string, timeZone?: string): Date | null {
    const raw = stripFractionalSeconds((dateTime || '').trim());
    if (!raw)
        return null;
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if ((timeZone ?? '').trim() === 'UTC') {
        const d = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    const iana = resolveIanaTimeZone(timeZone);
    if (iana) {
        try {
            const d = fromZonedTime(raw.replace(/Z$/, ''), iana);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        catch {

        }
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function dayBounds(d: Date): { start: Date; end: Date } {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

function calendarEventUsesAllDayDates(ev: CalendarEvent): boolean {
    return Boolean(ev.isAllDay || ev.start?.date);
}

function calendarEventOverlapsAllDay(ev: CalendarEvent, day: Date): boolean {
    const startDate = ev.start?.date?.trim().slice(0, 10);
    if (!startDate)
        return false;
    const dayKey = calendarDateKey(day);
    const endDate = ev.end?.date?.trim().slice(0, 10);
    if (endDate)
        return dayKey >= startDate && dayKey < endDate;
    return dayKey === startDate;
}

export function calendarEventOverlapsDay(ev: CalendarEvent, day: Date): boolean {
    if (calendarEventUsesAllDayDates(ev))
        return calendarEventOverlapsAllDay(ev, day);
    if (!ev.start?.dateTime)
        return false;
    const start = parseCalendarDateTime(ev.start.dateTime, ev.start.timeZone);
    if (!start)
        return false;
    const end = ev.end?.dateTime
        ? parseCalendarDateTime(ev.end.dateTime, ev.end.timeZone)
        : new Date(start.getTime() + 60 * 60 * 1000);
    if (!end)
        return false;
    const { start: dayStart, end: dayEnd } = dayBounds(day);
    return start < dayEnd && end > dayStart;
}

export function formatCalendarEventTime(ev: CalendarEvent): string {
    if (calendarEventUsesAllDayDates(ev))
        return '';
    if (!ev.start?.dateTime)
        return '';
    const s = parseCalendarDateTime(ev.start.dateTime, ev.start.timeZone);
    if (!s)
        return '';
    const parts = [`${pad2(s.getHours())}:${pad2(s.getMinutes())}`];
    if (ev.end?.dateTime) {
        const e = parseCalendarDateTime(ev.end.dateTime, ev.end.timeZone);
        if (e)
            parts.push(`${pad2(e.getHours())}:${pad2(e.getMinutes())}`);
    }
    return parts.join(' – ');
}

export function formatCalendarEventCellLabel(ev: CalendarEvent): { time: string; subject: string } {
    const subject = ev.subject?.trim() || 'Событие';
    if (calendarEventUsesAllDayDates(ev))
        return { time: '', subject };
    const timeRange = formatCalendarEventTime(ev);
    if (!timeRange)
        return { time: '', subject };
    const startOnly = timeRange.split(' – ')[0]?.trim() ?? timeRange;
    return { time: startOnly, subject };
}

export function calendarEventStartMs(ev: CalendarEvent): number {
    if (ev.start?.date) {
        const [y, m, d] = ev.start.date.split('-').map(Number);
        if (y && m && d)
            return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
    }
    if (!ev.start?.dateTime)
        return 0;
    const s = parseCalendarDateTime(ev.start.dateTime, ev.start.timeZone);
    return s ? s.getTime() : 0;
}

export function calendarEventIntervalOnDay(ev: CalendarEvent, day: Date): { startH: number; endH: number } | null {
    if (calendarEventUsesAllDayDates(ev)) {
        if (!calendarEventOverlapsAllDay(ev, day))
            return null;
        return { startH: 0, endH: 24 };
    }
    if (!ev.start?.dateTime)
        return null;
    const start = parseCalendarDateTime(ev.start.dateTime, ev.start.timeZone);
    if (!start)
        return null;
    const rawEnd = ev.end?.dateTime
        ? parseCalendarDateTime(ev.end.dateTime, ev.end.timeZone)
        : new Date(start.getTime() + 60 * 60 * 1000);
    if (!rawEnd)
        return null;
    const { start: dayStart, end: dayEnd } = dayBounds(day);
    const clipStart = start < dayStart ? dayStart : start;
    const clipEnd = rawEnd > dayEnd ? dayEnd : rawEnd;
    if (clipStart >= clipEnd)
        return null;
    const toHours = (d: Date) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    return { startH: toHours(clipStart), endH: toHours(clipEnd) };
}

export function calendarEventDurationHours(ev: CalendarEvent, day: Date): number {
    const interval = calendarEventIntervalOnDay(ev, day);
    if (!interval)
        return 0;
    const hours = interval.endH - interval.startH;
    if (!Number.isFinite(hours) || hours <= 0)
        return 0;
    if (hours > 8 && !calendarEventUsesAllDayDates(ev))
        return 0;
    if (calendarEventUsesAllDayDates(ev))
        return 0;
    return Math.round(hours * 3600) / 3600;
}

export function calendarEventNotesDefault(ev: CalendarEvent): string {
    const subject = ev.subject?.trim() || '';
    if (subject.length >= 5)
        return subject;
    const time = formatCalendarEventTime(ev);
    const base = subject || 'Событие Outlook';
    return time ? `${base} (${time})` : `${base} — календарь`;
}

export const OUTLOOK_CALL_TASK_NAME = 'Telephone calls';

export function matchTelephoneCallsTask<T extends { name: string }>(tasks: readonly T[]): T | undefined {
    const exact = tasks.find((t) => t.name.trim().toLowerCase() === OUTLOOK_CALL_TASK_NAME.toLowerCase());
    if (exact)
        return exact;
    return tasks.find((t) => /^telephone\s*calls?$/i.test(t.name.trim()));
}

export function indexCalendarEventsByDays(events: CalendarEvent[], days: readonly Date[]): Map<string, CalendarEvent[]> {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
        const key = calendarDateKey(day);
        const matched = events
            .filter((ev) => calendarEventOverlapsDay(ev, day))
            .sort((a, b) => calendarEventStartMs(a) - calendarEventStartMs(b));
        if (matched.length > 0)
            map.set(key, matched);
    }
    return map;
}
