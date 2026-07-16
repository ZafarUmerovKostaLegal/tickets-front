import { apiFetch } from '@shared/api';
import { assertHttpsMicrosoftOAuthRedirectUrl } from '@shared/lib/safeOAuthRedirect';
import { normalizeCalendarEvents } from './calendarEventNormalize';
export const CALENDAR_NOT_CONNECTED_MSG = 'Календарь не подключён';
export interface CalendarEvent {
    id: string;
    subject?: string;
    isAllDay?: boolean;
    start?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    end?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
    };
    body?: {
        content?: string;
    };

    calendarId?: string;
}
async function parseBody(res: Response): Promise<Record<string, unknown> | null> {
    try {
        return await res.json();
    }
    catch {
        return null;
    }
}
export async function connectOutlookCalendar(options?: { forceConsent?: boolean }): Promise<void> {
    const qs = options?.forceConsent ? '?force_consent=true' : '';
    const res = await apiFetch(`/api/v1/todos/calendar/connect${qs}`, {
        redirect: 'manual',
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (res.type === 'opaqueredirect') {
        throw new Error('Несовместимый ответ сервера при подключении календаря. Убедитесь, что сервис todos обновлён: GET /calendar/connect должен отдавать JSON { "url": "..." }, без HTTP-редиректа.');
    }
    if (res.status === 302 || res.status === 307) {
        const loc = res.headers.get('Location');
        if (loc) {
            const u = assertHttpsMicrosoftOAuthRedirectUrl(loc);
            window.location.href = u.toString();
            return;
        }
    }
    const data = await parseBody(res);
    if (data?.url && typeof data.url === 'string') {
        const u = assertHttpsMicrosoftOAuthRedirectUrl(data.url);
        window.location.href = u.toString();
        return;
    }
    if (res.ok) {
        throw new Error('Сервер вернул 200 без поля url. Обновите сервис todos и gateway: ответ подключения календаря должен быть JSON с адресом входа Microsoft.');
    }
    const detail = typeof data?.detail === 'string' ? data.detail : null;
    if (res.status === 503) {
        throw new Error(detail
            ?? 'Сервис календаря не настроен на сервере (OAuth Microsoft). Нужны MICROSOFT_CLIENT_ID и MICROSOFT_REDIRECT_URI в сервисе todos.');
    }
    if (res.status === 500) {
        throw new Error(detail ?? 'Внутренняя ошибка сервера. Проверьте логи контейнера todos.');
    }
    throw new Error(detail ?? 'Не удалось начать подключение календаря');
}

/** Disconnect then start OAuth with prompt=consent (required after Mail.ReadWrite scope expansion). */
export async function reconnectOutlookCalendar(): Promise<void> {
    try {
        await apiFetch('/api/v1/todos/calendar/disconnect', { method: 'DELETE' });
    }
    catch {
        // Still try to reconnect even if disconnect fails (e.g. already disconnected).
    }
    await connectOutlookCalendar({ forceConsent: true });
}

export async function disconnectOutlookCalendar(): Promise<void> {
    const res = await apiFetch('/api/v1/todos/calendar/disconnect', { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (!res.ok) {
        const body = await parseBody(res);
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        throw new Error(detail ?? 'Не удалось отключить Outlook');
    }
}
export type CalendarStatusResult = {
    connected: boolean;
    detail?: string;
};
export async function getCalendarStatus(): Promise<CalendarStatusResult> {
    const res = await apiFetch('/api/v1/todos/calendar/status', {
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (!res.ok) {
        const body = await parseBody(res);
        const detail = typeof body?.detail === 'string' ? body.detail : undefined;
        return { connected: false, detail };
    }
    const data = (await res.json()) as {
        connected?: boolean;
        detail?: unknown;
    };
    return {
        connected: !!data?.connected,
        detail: typeof data?.detail === 'string' ? data.detail : undefined,
    };
}
export type OutlookCalendarItem = {
    id: string;
    name: string;
};

export async function getOutlookCalendars(): Promise<OutlookCalendarItem[]> {
    const res = await apiFetch('/api/v1/todos/calendar/calendars', {
        headers: { Accept: 'application/json' },
    });
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (res.status === 403) {
        throw new Error(CALENDAR_NOT_CONNECTED_MSG);
    }
    if (!res.ok) {
        const body = await parseBody(res);
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        throw new Error(detail ?? `Ошибка загрузки календарей (${res.status})`);
    }
    const data = await res.json();
    const raw = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
    return raw
        .map((item: { id?: unknown; name?: unknown }) => ({
            id: String(item.id ?? '').trim(),
            name: String(item.name ?? '').trim() || String(item.id ?? '').trim(),
        }))
        .filter((item: OutlookCalendarItem) => item.id.length > 0);
}

export async function getCalendarEvents(
    start?: string,
    end?: string,
    calendarId?: string | null,
): Promise<CalendarEvent[]> {
    const qs = new URLSearchParams();
    if (start)
        qs.set('start', start);
    if (end)
        qs.set('end', end);
    const cid = (calendarId ?? '').trim();
    if (cid && cid !== 'default')
        qs.set('calendar_id', cid);
    const path = `/api/v1/todos/calendar/events${qs.toString() ? `?${qs}` : ''}`;
    const res = await apiFetch(path);
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (res.status === 503) {
        throw new Error(CALENDAR_NOT_CONNECTED_MSG);
    }
    if (res.status === 403) {
        await parseBody(res);
        throw new Error(CALENDAR_NOT_CONNECTED_MSG);
    }
    if (!res.ok) {
        const body = await parseBody(res);
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        throw new Error(detail ?? `Ошибка загрузки событий (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data))
        return normalizeCalendarEvents(data);
    if (Array.isArray(data?.value))
        return normalizeCalendarEvents(data.value);
    if (Array.isArray(data?.events))
        return normalizeCalendarEvents(data.events);
    if (Array.isArray(data?.data))
        return normalizeCalendarEvents(data.data);
    console.warn('[CalendarAPI] Unexpected events response format:', data);
    return [];
}
export async function createCalendarEvent(payload: {
    subject: string;
    start: string;
    end: string;
    body?: string;
}): Promise<CalendarEvent> {
    const res = await apiFetch('/api/v1/todos/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (res.status === 403)
        throw new Error(CALENDAR_NOT_CONNECTED_MSG);
    if (!res.ok)
        throw new Error('Ошибка создания события');
    return res.json();
}
