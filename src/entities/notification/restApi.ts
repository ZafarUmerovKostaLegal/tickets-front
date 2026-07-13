import { apiFetch } from '@shared/api';
import { normalizeNotificationItem } from './normalize';
import type { NotificationItem } from './types';

export type ListNotificationsParams = {
    skip?: number;
    limit?: number;
    include_archived?: boolean;
};

const DEFAULT_SKIP = 0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
    if (typeof val !== 'number' || !Number.isFinite(val))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(val)));
}

export async function listNotificationsRest(params: ListNotificationsParams = {}): Promise<NotificationItem[]> {
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
            const j = JSON.parse(text) as { detail?: string };
            if (typeof j.detail === 'string')
                msg = j.detail;
        }
        catch {  }
        throw new Error(msg);
    }
    const raw = text.trim() ? (JSON.parse(text) as unknown) : [];
    const arr = Array.isArray(raw) ? raw : [];
    const out: NotificationItem[] = [];
    for (const row of arr) {
        if (row && typeof row === 'object') {
            const item = normalizeNotificationItem(row as Record<string, unknown>);
            if (item)
                out.push(item);
        }
    }
    return out;
}

export async function getNotificationRest(uuid: string): Promise<NotificationItem> {
    const id = uuid.trim();
    if (!id)
        throw new Error('UUID is required');
    const res = await apiFetch(`/api/v1/notifications/${encodeURIComponent(id)}`);
    const text = await res.text();
    if (!res.ok)
        throw new Error(text || `Ошибка ${res.status}`);
    const item = normalizeNotificationItem(JSON.parse(text) as Record<string, unknown>);
    if (!item)
        throw new Error('Invalid response');
    return item;
}

export async function archiveNotificationRest(uuid: string, isArchived = true): Promise<NotificationItem> {
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
    const item = normalizeNotificationItem(JSON.parse(text) as Record<string, unknown>);
    if (!item)
        throw new Error('Invalid response');
    return item;
}
