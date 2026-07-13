import { apiFetch } from '@shared/api';
import { compareRuLabels, userPickerSortLabel } from '@shared/lib/sortByRuLabel';
import { normalizeUserPublic, normalizeUsersPublicBatch } from './lib/normalizeUserPublic';
import type { UserPublic, UsersPublicBatchResponse } from './model/publicTypes';

const PUBLIC_USERS_BATCH_LIMIT = 200;

function sortPartnersByLabel(rows: UserPublic[]): UserPublic[] {
    return [...rows].sort((a, b) => compareRuLabels(userPickerSortLabel(a), userPickerSortLabel(b)));
}


export async function listPartners(): Promise<UserPublic[]> {
    const res = await apiFetch('/api/v1/users/partners');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 503)
        throw new Error('Сервис каталога пользователей временно недоступен');
    if (!res.ok)
        throw new Error('Не удалось загрузить список партнёров');
    const raw = await res.json() as unknown;
    if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)) {
        return sortPartnersByLabel((raw as { items: unknown[] }).items
            .map((item) => normalizeUserPublic(item))
            .filter((x): x is UserPublic => x != null));
    }
    if (Array.isArray(raw)) {
        return sortPartnersByLabel(raw
            .map((item) => normalizeUserPublic(item))
            .filter((x): x is UserPublic => x != null));
    }
    return [];
}


export async function getUserPublic(userId: number): Promise<UserPublic | null> {
    if (!Number.isFinite(userId) || userId <= 0)
        return null;
    const res = await apiFetch(`/api/v1/users/${userId}/public`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404)
        return null;
    if (res.status === 503)
        throw new Error('Сервис каталога пользователей временно недоступен');
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователя');
    return normalizeUserPublic(await res.json());
}


async function fetchUsersPublicChunk(ids: number[], includeArchived: boolean): Promise<UsersPublicBatchResponse> {
    if (ids.length === 0)
        return { items: [], missing_ids: [] };
    const params = new URLSearchParams();
    params.set('ids', ids.join(','));
    params.set('include_archived', String(includeArchived));
    const res = await apiFetch(`/api/v1/users/public?${params.toString()}`);
    if (res.status === 400)
        throw new Error('Неверный список id');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 503)
        throw new Error('Сервис каталога пользователей временно недоступен');
    if (res.status === 404) {
        return { items: [], missing_ids: [...ids] };
    }
    if (!res.ok)
        throw new Error('Не удалось загрузить пользователей');
    return normalizeUsersPublicBatch(await res.json());
}


export async function getUsersPublic(ids: readonly number[], includeArchived = true): Promise<UsersPublicBatchResponse> {
    const unique: number[] = [];
    const seen = new Set<number>();
    for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isFinite(id) || id <= 0)
            continue;
        if (seen.has(id))
            continue;
        seen.add(id);
        unique.push(id);
    }
    if (unique.length === 0)
        return { items: [], missing_ids: [] };

    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += PUBLIC_USERS_BATCH_LIMIT)
        chunks.push(unique.slice(i, i + PUBLIC_USERS_BATCH_LIMIT));

    const responses = await Promise.all(chunks.map((c) => fetchUsersPublicChunk(c, includeArchived)));
    const items: UserPublic[] = [];
    const missing_ids: number[] = [];
    const seenItem = new Set<number>();
    for (const r of responses) {
        for (const it of r.items) {
            if (seenItem.has(it.id))
                continue;
            seenItem.add(it.id);
            items.push(it);
        }
        for (const m of r.missing_ids) {
            if (!seenItem.has(m) && !missing_ids.includes(m))
                missing_ids.push(m);
        }
    }
    return { items, missing_ids };
}

export { PUBLIC_USERS_BATCH_LIMIT };
