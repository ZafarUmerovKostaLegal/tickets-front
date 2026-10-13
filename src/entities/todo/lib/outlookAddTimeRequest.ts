import type { CalendarEvent } from './calendarApi';

export const OUTLOOK_ADD_TIME_EVENT = 'tt-outlook-add-time';

const STORAGE_KEY = 'tt-outlook-add-time-pending';

export function queueOutlookAddTime(event: CalendarEvent): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    }
    catch {
        /* private mode */
    }
    window.dispatchEvent(new CustomEvent(OUTLOOK_ADD_TIME_EVENT));
}

export function takeQueuedOutlookAddTime(): CalendarEvent | null {
    let raw: string | null = null;
    try {
        raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw)
            sessionStorage.removeItem(STORAGE_KEY);
    }
    catch {
        return null;
    }
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw) as CalendarEvent;
        if (!parsed || typeof parsed !== 'object' || !parsed.id)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
