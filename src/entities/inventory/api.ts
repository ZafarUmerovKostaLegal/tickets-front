import { apiFetch, getApiUrl } from '@shared/api';
import type { CreateCategoryBody, InventoryCategory, InventoryItem, InventoryStatusItem, ItemsParams, UpdateCategoryBody, UpdateItemBody, } from './model/types';
const BASE = '/api/v1/inventory';
const CATEGORIES = `${BASE}/categories`;
const ITEMS = `${BASE}/items`;
async function parseError(res: Response, fallback: string): Promise<string> {
    const err = await res.json().catch(() => ({}));
    return (err as {
        detail?: string;
    })?.detail ?? res.statusText ?? fallback;
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
    if (params.assigned_to_user_id != null)
        q.set('assigned_to_user_id', String(params.assigned_to_user_id));
    if (params.include_archived != null)
        q.set('include_archived', String(params.include_archived));
    return q.toString();
}
export async function getStatuses(): Promise<InventoryStatusItem[]> {
    const res = await apiFetch(`${ITEMS}/statuses`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch statuses'));
    return res.json();
}
export async function getCategories(): Promise<InventoryCategory[]> {
    const res = await apiFetch(CATEGORIES);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch categories'));
    return res.json();
}
export async function getCategory(id: number): Promise<InventoryCategory> {
    const res = await apiFetch(`${CATEGORIES}/${id}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch category'));
    return res.json();
}
export async function createCategory(body: CreateCategoryBody): Promise<InventoryCategory> {
    const res = await apiFetch(CATEGORIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to create category'));
    return res.json();
}
export async function updateCategory(id: number, body: UpdateCategoryBody): Promise<InventoryCategory> {
    const res = await apiFetch(`${CATEGORIES}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to update category'));
    return res.json();
}
export async function deleteCategory(id: number): Promise<void> {
    const res = await apiFetch(`${CATEGORIES}/${id}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to delete category'));
}
export async function getItems(params: ItemsParams = {}): Promise<InventoryItem[]> {
    const query = buildItemsQuery(params);
    const res = await apiFetch(`${ITEMS}${query ? `?${query}` : ''}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch items'));
    return res.json();
}
export async function getItem(uuid: string): Promise<InventoryItem> {
    const res = await apiFetch(`${ITEMS}/${uuid}`);
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to fetch item'));
    return res.json();
}
export async function createItem(form: FormData): Promise<InventoryItem> {
    const res = await apiFetch(ITEMS, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to create item'));
    return res.json();
}
export async function updateItem(uuid: string, body: UpdateItemBody): Promise<InventoryItem> {
    const res = await apiFetch(`${ITEMS}/${uuid}`, {
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
    const res = await apiFetch(`${ITEMS}/${uuid}/photo`, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to upload photo'));
    return res.json();
}
export async function assignItem(uuid: string, user_id: number): Promise<InventoryItem> {
    const res = await apiFetch(`${ITEMS}/${uuid}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to assign item'));
    return res.json();
}
export async function unassignItem(uuid: string): Promise<InventoryItem> {
    const res = await apiFetch(`${ITEMS}/${uuid}/unassign`, { method: 'POST' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to unassign item'));
    return res.json();
}
export async function archiveItem(uuid: string, is_archived = true): Promise<InventoryItem> {
    const res = await apiFetch(`${ITEMS}/${uuid}/archive?is_archived=${is_archived}`, { method: 'PATCH' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to archive item'));
    return res.json();
}
export async function deleteItem(uuid: string): Promise<void> {
    const res = await apiFetch(`${ITEMS}/${uuid}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Failed to delete item'));
}
export function getItemPhotoUrl(photo_path: string | null): string | null {
    if (!photo_path?.trim())
        return null;
    const path = photo_path.startsWith('/') ? photo_path.slice(1) : photo_path;
    return getApiUrl(`/api/v1/media/${path}`);
}
