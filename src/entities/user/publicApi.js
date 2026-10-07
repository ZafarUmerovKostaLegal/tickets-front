import { apiFetch } from '@shared/api';
import { compareRuLabels, userPickerSortLabel } from '@shared/lib/sortByRuLabel';
import { createQueryCache } from '@shared/lib/queryCache';
import { normalizeUserPublic, normalizeUsersPublicBatch } from './lib/normalizeUserPublic';
const PUBLIC_USERS_BATCH_LIMIT = 200;
const PARTNERS_CACHE_KEY = 'user-partners';
const partnersCache = createQueryCache({ ttlMs: 5 * 60_000 });
function sortPartnersByLabel(rows) {
    return [...rows].sort((a, b) => compareRuLabels(userPickerSortLabel(a), userPickerSortLabel(b)));
}
async function fetchPartnersFromApi() {
    const res = await apiFetch('/api/v1/users/partners');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 503)
        throw new Error('Сервис каталога пользователей временно недоступен');
    if (!res.ok)
        throw new Error('Не удалось загрузить список партнёров');
    const raw = await res.json();
    if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
        return sortPartnersByLabel(raw.items
            .map((item) => normalizeUserPublic(item))
            .filter((x) => x != null));
    }
    if (Array.isArray(raw)) {
        return sortPartnersByLabel(raw
            .map((item) => normalizeUserPublic(item))
            .filter((x) => x != null));
    }
    return [];
}
export async function listPartners() {
    return partnersCache.fetch(PARTNERS_CACHE_KEY, fetchPartnersFromApi);
}
export function invalidatePartnersCache() {
    partnersCache.invalidate(PARTNERS_CACHE_KEY);
}
export async function getUserPublic(userId) {
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
async function fetchUsersPublicChunk(ids, includeArchived) {
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
export async function getUsersPublic(ids, includeArchived = true) {
    const unique = [];
    const seen = new Set();
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
    unique.sort((a, b) => a - b);
    const chunks = [];
    for (let i = 0; i < unique.length; i += PUBLIC_USERS_BATCH_LIMIT)
        chunks.push(unique.slice(i, i + PUBLIC_USERS_BATCH_LIMIT));
    const responses = await Promise.all(chunks.map((c) => fetchUsersPublicChunk(c, includeArchived)));
    const items = [];
    const missing_ids = [];
    const seenItem = new Set();
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
