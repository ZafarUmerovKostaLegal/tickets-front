import { apiFetch, getApiUrl } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
const BASE = '/api/v1/inventory';
const CATEGORIES = `${BASE}/categories`;
const ITEMS = `${BASE}/items`;
const STATUSES_CACHE_KEY = 'inventory-statuses';
const CATEGORIES_CACHE_KEY = 'inventory-categories';
const statusesCache = createQueryCache({ ttlMs: 30 * 60_000 });
const categoriesCache = createQueryCache({ ttlMs: 5 * 60_000 });
function isNetworkError(e) {
    const msg = e instanceof Error ? e.message : String(e ?? '');
    return /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}
function rethrowInventoryError(e, fallback) {
    if (isNetworkError(e))
        throw new Error('Не удалось связаться с сервисом инвентаризации. Проверьте сеть и попробуйте ещё раз.');
    if (e instanceof Error)
        throw e;
    throw new Error(fallback);
}
async function parseError(res, fallback) {
    const err = await res.json().catch(() => ({}));
    const detail = err?.detail;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        const msg = detail
            .map((item) => (typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item)))
            .filter(Boolean)
            .join('; ');
        if (msg)
            return msg;
    }
    return res.statusText || fallback;
}
async function inventoryFetch(path, init) {
    try {
        return await apiFetch(path, init);
    }
    catch (e) {
        rethrowInventoryError(e, 'Ошибка запроса инвентаризации');
    }
}
function buildItemsQuery(params) {
    const q = new URLSearchParams();
    if (params.skip != null)
        q.set('skip', String(params.skip));
    if (params.limit != null)
        q.set('limit', String(params.limit));
    if (params.category_id != null)
        q.set('category_id', String(params.category_id));
    if (params.status)
        q.set('status', params.status);
    if (params.equipment_class)
        q.set('equipment_class', params.equipment_class);
    if (params.assigned_to_user_id != null)
        q.set('assigned_to_user_id', String(params.assigned_to_user_id));
    if (params.include_archived != null)
        q.set('include_archived', String(params.include_archived));
    return q.toString();
}
async function fetchStatusesFromApi(signal) {
    const res = await inventoryFetch(`${ITEMS}/statuses`, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch statuses'));
    return res.json();
}
export async function getStatuses(signal) {
    return statusesCache.fetch(STATUSES_CACHE_KEY, fetchStatusesFromApi, { signal });
}
async function fetchCategoriesFromApi(signal) {
    const res = await inventoryFetch(CATEGORIES, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch categories'));
    return res.json();
}
export async function getCategories(signal) {
    return categoriesCache.fetch(CATEGORIES_CACHE_KEY, fetchCategoriesFromApi, { signal });
}
export async function getCategory(id) {
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY)?.find((category) => category.id === id);
    if (cached)
        return cached;
    const res = await inventoryFetch(`${CATEGORIES}/${id}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch category'));
    return res.json();
}
export async function createCategory(body) {
    const res = await inventoryFetch(CATEGORIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to create category'));
    const created = await res.json();
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
    if (cached)
        categoriesCache.prime(CATEGORIES_CACHE_KEY, [...cached, created]);
    else
        categoriesCache.invalidate(CATEGORIES_CACHE_KEY);
    return created;
}
export async function updateCategory(id, body) {
    const res = await inventoryFetch(`${CATEGORIES}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to update category'));
    const updated = await res.json();
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
    if (cached)
        categoriesCache.prime(CATEGORIES_CACHE_KEY, cached.map((category) => category.id === id ? updated : category));
    else
        categoriesCache.invalidate(CATEGORIES_CACHE_KEY);
    return updated;
}
export async function deleteCategory(id) {
    const res = await inventoryFetch(`${CATEGORIES}/${id}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to delete category'));
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
    if (cached)
        categoriesCache.prime(CATEGORIES_CACHE_KEY, cached.filter((category) => category.id !== id));
    else
        categoriesCache.invalidate(CATEGORIES_CACHE_KEY);
}
export async function getItems(params = {}, signal) {
    const query = buildItemsQuery(params);
    const res = await inventoryFetch(`${ITEMS}${query ? `?${query}` : ''}`, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch items'));
    const data = await res.json();
    if (Array.isArray(data)) {
        return {
            items: data,
            total: data.length,
            skip: params.skip ?? 0,
            limit: params.limit ?? data.length,
            in_use_count: data.filter((i) => i.status === 'in_use' && !i.is_archived).length,
            in_stock_count: data.filter((i) => i.status === 'in_stock' && !i.is_archived).length,
            archived_count: data.filter((i) => i.is_archived).length,
        };
    }
    const items = Array.isArray(data.items) ? data.items : [];
    return {
        items,
        total: Number(data.total ?? items.length),
        skip: Number(data.skip ?? params.skip ?? 0),
        limit: Number(data.limit ?? params.limit ?? items.length),
        in_use_count: Number(data.in_use_count ?? 0),
        in_stock_count: Number(data.in_stock_count ?? 0),
        archived_count: Number(data.archived_count ?? 0),
    };
}
export async function getItem(uuid) {
    const res = await inventoryFetch(`${ITEMS}/${uuid}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch item'));
    return res.json();
}
export async function createItem(form) {
    const res = await inventoryFetch(ITEMS, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to create item'));
    return res.json();
}
export async function updateItem(uuid, body) {
    const res = await inventoryFetch(`${ITEMS}/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to update item'));
    return res.json();
}
export async function uploadItemPhoto(uuid, file) {
    const form = new FormData();
    form.append('photo', file);
    const res = await inventoryFetch(`${ITEMS}/${uuid}/photo`, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to upload photo'));
    return res.json();
}
export async function assignItem(uuid, user_id) {
    const res = await inventoryFetch(`${ITEMS}/${uuid}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to assign item'));
    return res.json();
}
export async function unassignItem(uuid) {
    const res = await inventoryFetch(`${ITEMS}/${uuid}/unassign`, { method: 'POST' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to unassign item'));
    return res.json();
}
export async function archiveItem(uuid, is_archived = true) {
    const res = await inventoryFetch(`${ITEMS}/${uuid}/archive?is_archived=${is_archived}`, { method: 'PATCH' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to archive item'));
    return res.json();
}
export async function deleteItem(uuid) {
    const res = await inventoryFetch(`${ITEMS}/${uuid}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to delete item'));
}
export function getItemPhotoUrl(photo_path) {
    if (!photo_path?.trim())
        return null;
    const path = photo_path.startsWith('/') ? photo_path.slice(1) : photo_path;
    return getApiUrl(`/api/v1/media/${path}`);
}
