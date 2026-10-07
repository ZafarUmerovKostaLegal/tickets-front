import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { normalizeNotificationItem } from './normalize';
const DEFAULT_SKIP = 0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const notificationsListCache = createQueryCache({ ttlMs: 5_000 });
export function invalidateNotificationsListCache() {
    notificationsListCache.invalidate();
}
function clampNum(val, min, max, fallback) {
    if (typeof val !== 'number' || !Number.isFinite(val))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(val)));
}
async function fetchNotificationsRest(params) {
    const skip = clampNum(params.skip, 0, Number.MAX_SAFE_INTEGER, DEFAULT_SKIP);
    const limit = clampNum(params.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);
    const q = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
        include_archived: String(Boolean(params.include_archived)),
    });
    const res = await apiFetch(`/api/v1/notifications?${q.toString()}`);
    const text = await res.text();
    if (!res.ok) {
        let msg = `Ошибка ${res.status}`;
        try {
            const j = JSON.parse(text);
            if (typeof j.detail === 'string')
                msg = j.detail;
        }
        catch { }
        throw new Error(msg);
    }
    const raw = text.trim() ? JSON.parse(text) : [];
    const arr = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const row of arr) {
        if (row && typeof row === 'object') {
            const item = normalizeNotificationItem(row);
            if (item)
                out.push(item);
        }
    }
    return out;
}
export async function listNotificationsRest(params = {}) {
    const normalized = {
        skip: clampNum(params.skip, 0, Number.MAX_SAFE_INTEGER, DEFAULT_SKIP),
        limit: clampNum(params.limit, 1, MAX_LIMIT, DEFAULT_LIMIT),
        include_archived: Boolean(params.include_archived),
    };
    const key = `${normalized.skip}:${normalized.limit}:${normalized.include_archived}`;
    return notificationsListCache.fetch(key, () => fetchNotificationsRest(normalized));
}
export async function getNotificationRest(uuid) {
    const id = uuid.trim();
    if (!id)
        throw new Error('UUID is required');
    const res = await apiFetch(`/api/v1/notifications/${encodeURIComponent(id)}`);
    const text = await res.text();
    if (!res.ok)
        throw new Error(text || `Ошибка ${res.status}`);
    const item = normalizeNotificationItem(JSON.parse(text));
    if (!item)
        throw new Error('Invalid response');
    return item;
}
export async function archiveNotificationRest(uuid, isArchived = true) {
    const id = uuid.trim();
    if (!id)
        throw new Error('UUID is required');
    const res = await apiFetch(`/api/v1/notifications/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived, isArchived }),
    });
    const text = await res.text();
    if (!res.ok)
        throw new Error(text || `Ошибка ${res.status}`);
    const item = normalizeNotificationItem(JSON.parse(text));
    if (!item)
        throw new Error('Invalid response');
    invalidateNotificationsListCache();
    return item;
}
