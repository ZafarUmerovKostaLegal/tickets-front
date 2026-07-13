import type { CalendarEvent } from './calendarApi';

function asRecord(x: unknown): Record<string, unknown> | null {
    return x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
}

function pickDateTimeBlock(raw: unknown): CalendarEvent['start'] | undefined {
    const block = asRecord(raw);
    if (!block)
        return undefined;
    const dateTime = typeof block.dateTime === 'string' ? block.dateTime : undefined;
    const date = typeof block.date === 'string' ? block.date.trim().slice(0, 10) : undefined;
    const timeZone = typeof block.timeZone === 'string' ? block.timeZone : undefined;
    if (!dateTime && !date)
        return undefined;
    return { dateTime, date, timeZone };
}

export function normalizeCalendarEvent(raw: unknown): CalendarEvent | null {
    const o = asRecord(raw);
    if (!o)
        return null;
    const id = String(o.id ?? '').trim();
    if (!id)
        return null;
    const start = pickDateTimeBlock(o.start);
    const end = pickDateTimeBlock(o.end);
    const isAllDay = Boolean(o.isAllDay ?? o.is_all_day) || Boolean(start?.date);
    const bodyBlock = asRecord(o.body);
    const bodyContent = bodyBlock && typeof bodyBlock.content === 'string' ? bodyBlock.content : undefined;
    return {
        id,
        subject: typeof o.subject === 'string' ? o.subject : undefined,
        isAllDay,
        start,
        end,
        body: bodyContent ? { content: bodyContent } : undefined,
    };
}

export function normalizeCalendarEvents(raw: unknown): CalendarEvent[] {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map(normalizeCalendarEvent)
        .filter((ev): ev is CalendarEvent => ev != null);
}
