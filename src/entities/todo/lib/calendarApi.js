import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { assertHttpsMicrosoftOAuthRedirectUrl } from '@shared/lib/safeOAuthRedirect';
import { normalizeCalendarEvents } from './calendarEventNormalize';
export const CALENDAR_NOT_CONNECTED_MSG = 'Календарь не подключён';
const calendarStatusCache = createQueryCache({
    ttlMs: 30_000,
    staleWhileRevalidateMs: 2 * 60_000,
    maxEntries: 1,
});
const outlookCalendarsCache = createQueryCache({
    ttlMs: 5 * 60_000,
    staleWhileRevalidateMs: 15 * 60_000,
    maxEntries: 1,
});
const calendarEventsCache = createQueryCache({
    ttlMs: 30_000,
    staleWhileRevalidateMs: 2 * 60_000,
    maxEntries: 32,
});
export function invalidateCalendarApiCache() {
    calendarStatusCache.invalidate();
    outlookCalendarsCache.invalidate();
    calendarEventsCache.invalidate();
}
async function parseBody(res) {
    try {
        return await res.json();
    }
    catch {
        return null;
    }
}
export async function connectOutlookCalendar(options) {
    invalidateCalendarApiCache();
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
            window.location.assign(u.toString());
            return;
        }
    }
    const data = await parseBody(res);
    if (data?.url && typeof data.url === 'string') {
        const u = assertHttpsMicrosoftOAuthRedirectUrl(data.url);
        window.location.assign(u.toString());
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
/** Disconnect then start OAuth again. Soft connect by default — org admin consent
 * already covers Mail.ReadWrite; prompt=consent forces a user consent screen that
 * non-admins cannot complete («Требуется утверждение администратора»). */
export async function reconnectOutlookCalendar(options) {
    const disc = await apiFetch('/api/v1/todos/calendar/disconnect', { method: 'DELETE' });
    invalidateCalendarApiCache();
    // 404/405 = old gateway without disconnect route — still continue to connect.
    if (!disc.ok && disc.status !== 404 && disc.status !== 405 && disc.status !== 409) {
        const body = await parseBody(disc);
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        if (disc.status === 401)
            throw new Error('Требуется авторизация');
        if (detail)
            console.warn('[Outlook] disconnect:', detail);
    }
    await connectOutlookCalendar({ forceConsent: options?.forceConsent === true });
}
export async function disconnectOutlookCalendar() {
    const res = await apiFetch('/api/v1/todos/calendar/disconnect', { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Требуется авторизация');
    if (!res.ok) {
        const body = await parseBody(res);
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        throw new Error(detail ?? 'Не удалось отключить Outlook');
    }
    invalidateCalendarApiCache();
}
export async function getCalendarStatus(signal) {
    return calendarStatusCache.fetch('status', async (sharedSignal) => {
        const res = await apiFetch('/api/v1/todos/calendar/status', {
            headers: { Accept: 'application/json' },
            signal: sharedSignal,
            getReuseWindowMs: 30_000,
        });
        if (res.status === 401)
            throw new Error('Требуется авторизация');
        if (!res.ok) {
            const body = await parseBody(res);
            const detail = typeof body?.detail === 'string' ? body.detail : undefined;
            return { connected: false, mailReady: false, detail };
        }
        const data = (await res.json());
        const connected = !!data?.connected;
        const reason = typeof data.mailReadyReason === 'string' ? data.mailReadyReason.trim() : '';
        return {
            connected,
            mailReady: typeof data?.mailReady === 'boolean' ? data.mailReady : undefined,
            mailReadyReason: reason || undefined,
            detail: typeof data?.detail === 'string' ? data.detail : undefined,
        };
    }, { signal });
}
export async function getOutlookCalendars(signal) {
    return outlookCalendarsCache.fetch('calendars', async (sharedSignal) => {
        const res = await apiFetch('/api/v1/todos/calendar/calendars', {
            headers: { Accept: 'application/json' },
            signal: sharedSignal,
            getReuseWindowMs: 30_000,
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
            .map((item) => ({
            id: String(item.id ?? '').trim(),
            name: String(item.name ?? '').trim() || String(item.id ?? '').trim(),
        }))
            .filter((item) => item.id.length > 0);
    }, { signal });
}
export async function getCalendarEvents(start, end, calendarId, signal) {
    const qs = new URLSearchParams();
    if (start)
        qs.set('start', start);
    if (end)
        qs.set('end', end);
    const cid = (calendarId ?? '').trim();
    if (cid && cid !== 'default')
        qs.set('calendar_id', cid);
    const path = `/api/v1/todos/calendar/events${qs.toString() ? `?${qs}` : ''}`;
    return calendarEventsCache.fetch(path, async (sharedSignal) => {
        const res = await apiFetch(path, { signal: sharedSignal, getReuseWindowMs: 10_000 });
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
    }, { signal });
}
export async function createCalendarEvent(payload) {
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
    const event = await res.json();
    calendarEventsCache.invalidate();
    return event;
}
