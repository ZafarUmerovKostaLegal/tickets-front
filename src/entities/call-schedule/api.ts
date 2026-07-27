import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { mapGraphEventToCallEvent, type CallEvent } from './mapGraphEvent';

export type { CallEvent } from './mapGraphEvent';

export type CallScheduleCalendar = {
    id: string;
    name?: string;
    color?: string;
};

export type CallCalendarsResponse = {
    mailbox: string;
    calendars: CallScheduleCalendar[];
};

const CALENDARS_CACHE_KEY = 'call-schedule-calendars';
const calendarsCache = createQueryCache<CallCalendarsResponse>({ ttlMs: 5 * 60_000 });
const eventsCache = createQueryCache<CallEvent[]>({ ttlMs: 30_000, maxEntries: 24 });

function humanizeError(status: number, text: string): string {
    const short = text && text.length < 500;
    if (status === 400)
        return short ? text : 'Неверные параметры запроса.';
    if (status === 502)
        return short
            ? text
            : 'Microsoft Graph отклонил запрос. Проверьте права приложения и логи бэкенда.';
    if (status === 503) {
        return short
            ? text
            : 'Служба расписания недоступна. Проверьте настройки CALL_SCHEDULE на сервере или подождите и повторите.';
    }
    if (status === 401 || status === 403) {
        return 'Нет доступа. Войдите в систему заново.';
    }
    if (text && text.length < 400)
        return text;
    return `Ошибка ${status}`;
}

async function readErrorDetail(res: Response): Promise<string> {
    const text = await res.text().catch(() => '');
    try {
        const j = JSON.parse(text) as { detail?: unknown };
        if (typeof j.detail === 'string' && j.detail)
            return j.detail;
    }
    catch {
    }
    return text || `HTTP ${res.status}`;
}

export class CallScheduleApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'CallScheduleApiError';
        this.status = status;
    }
}

async function fetchCallScheduleCalendarsFromApi(signal?: AbortSignal): Promise<CallCalendarsResponse> {
    const res = await apiFetch('/api/v1/call-schedule/calendars', { signal });
    if (!res.ok) {
        const d = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, d));
    }
    return res.json() as Promise<CallCalendarsResponse>;
}

export async function getCallScheduleCalendars(signal?: AbortSignal): Promise<CallCalendarsResponse> {
    return calendarsCache.fetch(CALENDARS_CACHE_KEY, fetchCallScheduleCalendarsFromApi, { signal });
}

export type GetCallScheduleEventsParams = {
    start: string;
    end: string;
    calendarId?: string;
};

export async function getCallScheduleEvents(params: GetCallScheduleEventsParams, signal?: AbortSignal): Promise<CallEvent[]> {
    const q = new URLSearchParams();
    q.set('start', params.start);
    q.set('end', params.end);
    q.set('calendarId', params.calendarId && params.calendarId.length > 0 ? params.calendarId : 'default');
    const path = `/api/v1/call-schedule/events?${q.toString()}`;
    return eventsCache.fetch(path, async (sharedSignal) => {
        const res = await apiFetch(path, { signal: sharedSignal });
        if (!res.ok) {
            const d = await readErrorDetail(res);
            throw new CallScheduleApiError(res.status, humanizeError(res.status, d));
        }
        const j = (await res.json()) as { events?: unknown[] };
        const arr = j.events;
        if (!Array.isArray(arr))
            return [];
        return arr.map(mapGraphEventToCallEvent).filter((x): x is CallEvent => x != null);
    }, { signal });
}

export type CreateCallScheduleEventInput = {
    subject: string;
    start: string;
    end: string;
    body?: string | null;
    
    meetingUrl?: string | null;
    calendarId?: string | null;
    timeZone?: string;
};

export async function createCallScheduleEvent(
    input: CreateCallScheduleEventInput,
): Promise<unknown> {
    const res = await apiFetch('/api/v1/call-schedule/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subject: input.subject,
            start: input.start,
            end: input.end,
            body: input.body ?? null,
            meetingUrl: input.meetingUrl?.trim() || null,
            calendarId: input.calendarId && input.calendarId !== 'default' ? input.calendarId : null,
            timeZone: input.timeZone ?? 'UTC',
        }),
    });
    if (!res.ok) {
        const d = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, d));
    }
    const created = await res.json() as unknown;
    eventsCache.invalidate();
    return created;
}
