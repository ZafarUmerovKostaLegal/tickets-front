import { apiFetch, getApiUrl } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import type { CreateCategoryBody, InventoryCategory, InventoryItem, InventoryItemsPage, InventoryStatusItem, ItemsParams, UpdateCategoryBody, UpdateItemBody, } from './model/types';
const BASE = '/api/v1/inventory';
const CATEGORIES = `${BASE}/categories`;
const ITEMS = `${BASE}/items`;
const STATUSES_CACHE_KEY = 'inventory-statuses';
const CATEGORIES_CACHE_KEY = 'inventory-categories';
const statusesCache = createQueryCache<InventoryStatusItem[]>({ ttlMs: 30 * 60_000 });
const categoriesCache = createQueryCache<InventoryCategory[]>({ ttlMs: 5 * 60_000 });
function isNetworkError(e: unknown): boolean {
    const msg = e instanceof Error ? e.message : String(e ?? '');
    return /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}

function rethrowInventoryError(e: unknown, fallback: string): never {
    if (isNetworkError(e))
        throw new Error('Не удалось связаться с сервисом инвентаризации. Проверьте сеть и попробуйте ещё раз.');
    if (e instanceof Error)
        throw e;
    throw new Error(fallback);
}

async function parseError(res: Response, fallback: string): Promise<string> {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: unknown })?.detail;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        const msg = detail
            .map((item) => (typeof item === 'object' && item && 'msg' in item ? String((item as { msg: unknown }).msg) : String(item)))
            .filter(Boolean)
            .join('; ');
        if (msg)
            return msg;
    }
    return res.statusText || fallback;
}

async function inventoryFetch(path: string, init?: RequestInit): Promise<Response> {
    try {
        return await apiFetch(path, init);
    }
    catch (e) {
        rethrowInventoryError(e, 'Ошибка запроса инвентаризации');
    }
}
function buildItemsQuery(params: ItemsParams): string {
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
async function fetchStatusesFromApi(signal?: AbortSignal): Promise<InventoryStatusItem[]> {
    const res = await inventoryFetch(`${ITEMS}/statuses`, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch statuses'));
    return res.json();
}

export async function getStatuses(signal?: AbortSignal): Promise<InventoryStatusItem[]> {
    return statusesCache.fetch(STATUSES_CACHE_KEY, fetchStatusesFromApi, { signal });
}

async function fetchCategoriesFromApi(signal?: AbortSignal): Promise<InventoryCategory[]> {
    const res = await inventoryFetch(CATEGORIES, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch categories'));
    return res.json();
}

export async function getCategories(signal?: AbortSignal): Promise<InventoryCategory[]> {
    return categoriesCache.fetch(CATEGORIES_CACHE_KEY, fetchCategoriesFromApi, { signal });
}

export async function getCategory(id: number): Promise<InventoryCategory> {
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY)?.find((category) => category.id === id);
    if (cached)
        return cached;
    const res = await inventoryFetch(`${CATEGORIES}/${id}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch category'));
    return res.json();
}
export async function createCategory(body: CreateCategoryBody): Promise<InventoryCategory> {
    const res = await inventoryFetch(CATEGORIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to create category'));
    const created = await res.json() as InventoryCategory;
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
    if (cached)
        categoriesCache.prime(CATEGORIES_CACHE_KEY, [...cached, created]);
    else
        categoriesCache.invalidate(CATEGORIES_CACHE_KEY);
    return created;
}
export async function updateCategory(id: number, body: UpdateCategoryBody): Promise<InventoryCategory> {
    const res = await inventoryFetch(`${CATEGORIES}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to update category'));
    const updated = await res.json() as InventoryCategory;
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
    if (cached)
        categoriesCache.prime(CATEGORIES_CACHE_KEY, cached.map((category) => category.id === id ? updated : category));
    else
        categoriesCache.invalidate(CATEGORIES_CACHE_KEY);
    return updated;
}
export async function deleteCategory(id: number): Promise<void> {
    const res = await inventoryFetch(`${CATEGORIES}/${id}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to delete category'));
    const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
    if (cached)
        categoriesCache.prime(CATEGORIES_CACHE_KEY, cached.filter((category) => category.id !== id));
    else
        categoriesCache.invalidate(CATEGORIES_CACHE_KEY);
}
export async function getItems(params: ItemsParams = {}, signal?: AbortSignal): Promise<InventoryItemsPage> {
    const query = buildItemsQuery(params);
    const res = await inventoryFetch(`${ITEMS}${query ? `?${query}` : ''}`, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch items'));
    const data = await res.json() as {
        items?: InventoryItem[];
        total?: number;
        skip?: number;
        limit?: number;
        in_use_count?: number;
        in_stock_count?: number;
        archived_count?: number;
    } | InventoryItem[];
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
export async function getItem(uuid: string): Promise<InventoryItem> {
    const res = await inventoryFetch(`${ITEMS}/${uuid}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch item'));
    return res.json();
}
export async function createItem(form: FormData): Promise<InventoryItem> {
    const res = await inventoryFetch(ITEMS, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to create item'));
    return res.json();
}
export async function updateItem(uuid: string, body: UpdateItemBody): Promise<InventoryItem> {
    const res = await inventoryFetch(`${ITEMS}/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to update item'));
    return res.json();
}
export async function uploadItemPhoto(uuid: string, file: File): Promise<InventoryItem> {
    const form = new FormData();
    form.append('photo', file);
    const res = await inventoryFetch(`${ITEMS}/${uuid}/photo`, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to upload photo'));
    return res.json();
}
export async function assignItem(uuid: string, user_id: number): Promise<InventoryItem> {
    const res = await inventoryFetch(`${ITEMS}/${uuid}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to assign item'));
    return res.json();
}
export async function unassignItem(uuid: string): Promise<InventoryItem> {
    const res = await inventoryFetch(`${ITEMS}/${uuid}/unassign`, { method: 'POST' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to unassign item'));
    return res.json();
}
export async function archiveItem(uuid: string, is_archived = true): Promise<InventoryItem> {
    const res = await inventoryFetch(`${ITEMS}/${uuid}/archive?is_archived=${is_archived}`, { method: 'PATCH' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to archive item'));
    return res.json();
}
export async function deleteItem(uuid: string): Promise<void> {
    const res = await inventoryFetch(`${ITEMS}/${uuid}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to delete item'));
}
export function getItemPhotoUrl(photo_path: string | null): string | null {
    if (!photo_path?.trim())
        return null;
    const path = photo_path.startsWith('/') ? photo_path.slice(1) : photo_path;
    return getApiUrl(`/api/v1/media/${path}`);
}
