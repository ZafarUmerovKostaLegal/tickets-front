import { apiFetch } from '@shared/api';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { createQueryCache } from '@shared/lib/queryCache';
import { mapGraphEventToCallEvent } from './mapGraphEvent';
const CALENDARS_CACHE_KEY = 'call-schedule-calendars';
const calendarsCache = createQueryCache({ ttlMs: 5 * 60_000 });
const eventsCache = createQueryCache({ ttlMs: 30_000, maxEntries: 24 });
function humanizeError(status, text) {
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
async function readErrorDetail(res) {
    const text = await res.text().catch(() => '');
    try {
        const j = JSON.parse(text);
        if (typeof j.detail === 'string' && j.detail)
            return j.detail;
    }
    catch {
    }
    return text || `HTTP ${res.status}`;
}
export class CallScheduleApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = 'CallScheduleApiError';
        this.status = status;
    }
}
async function fetchCallScheduleCalendarsFromApi(signal) {
    const res = await apiFetch('/api/v1/call-schedule/calendars', { signal });
    if (!res.ok) {
        const d = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, d));
    }
    return res.json();
}
export async function getCallScheduleCalendars(signal) {
    return calendarsCache.fetch(CALENDARS_CACHE_KEY, fetchCallScheduleCalendarsFromApi, { signal });
}
export async function getCallScheduleEvents(params, signal) {
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
        const j = (await res.json());
        const arr = j.events;
        if (!Array.isArray(arr))
            return [];
        return arr.map(mapGraphEventToCallEvent).filter((x) => x != null);
    }, { signal });
}
export async function createCallScheduleEvent(input) {
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
    const created = await res.json();
    eventsCache.invalidate();
    return created;
}
function normalizeDayFile(raw) {
    return {
        id: String(raw.id ?? ''),
        day: String(raw.day ?? ''),
        originalName: String(raw.originalName ?? raw.original_name ?? 'file'),
        contentType: (raw.contentType ?? raw.content_type ?? null),
        sizeBytes: Number(raw.sizeBytes ?? raw.size_bytes ?? 0) || 0,
        uploadedByUserId: Number(raw.uploadedByUserId ?? raw.uploaded_by_user_id ?? 0) || 0,
        uploadedAt: String(raw.uploadedAt ?? raw.uploaded_at ?? ''),
    };
}
export async function listCallScheduleDayFiles(day, signal) {
    const d = encodeURIComponent(day.trim().slice(0, 10));
    const res = await apiFetch(`/api/v1/call-schedule/days/${d}/files`, { signal });
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, detail));
    }
    const arr = await res.json();
    if (!Array.isArray(arr))
        return [];
    return arr.map((row) => normalizeDayFile((row ?? {})));
}
export async function uploadCallScheduleDayFile(day, file) {
    const d = encodeURIComponent(day.trim().slice(0, 10));
    const form = new FormData();
    form.append('file', file);
    const res = await apiFetch(`/api/v1/call-schedule/days/${d}/files`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, detail));
    }
    return normalizeDayFile(await res.json());
}
export async function downloadCallScheduleDayFile(day, id, filename) {
    const d = encodeURIComponent(day.trim().slice(0, 10));
    const fid = encodeURIComponent(id);
    const res = await apiFetch(`/api/v1/call-schedule/days/${d}/files/${fid}/file`);
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, detail));
    }
    const blob = await res.blob();
    downloadBlob(blob, filename || 'file');
}
export async function deleteCallScheduleDayFile(day, id) {
    const d = encodeURIComponent(day.trim().slice(0, 10));
    const fid = encodeURIComponent(id);
    const res = await apiFetch(`/api/v1/call-schedule/days/${d}/files/${fid}`, { method: 'DELETE' });
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, detail));
    }
}
export async function fetchCallScheduleDayFileCounts(dateFrom, dateTo, signal) {
    const q = new URLSearchParams();
    q.set('from', dateFrom.trim().slice(0, 10));
    q.set('to', dateTo.trim().slice(0, 10));
    const res = await apiFetch(`/api/v1/call-schedule/days/files-counts?${q.toString()}`, { signal });
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new CallScheduleApiError(res.status, humanizeError(res.status, detail));
    }
    const j = await res.json();
    const counts = j.counts;
    if (!counts || typeof counts !== 'object')
        return {};
    const out = {};
    for (const [k, v] of Object.entries(counts)) {
        const n = Number(v);
        if (n > 0)
            out[k] = n;
    }
    return out;
}
