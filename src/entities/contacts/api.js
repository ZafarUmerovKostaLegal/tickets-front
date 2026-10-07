import { apiFetch } from '@shared/api';
import { normalizeTimeManagerClient, normalizeTimeManagerContact, normalizeTimeTrackingUserRow, unwrapTimeTrackingListArray, } from '@entities/time-tracking/api';
import { timeTrackingRowToUser } from '@entities/time-tracking/model/manualUsers';
import { compareRuLabels, userPickerSortLabel } from '@shared/lib/sortByRuLabel';
import { createQueryCache } from '@shared/lib/queryCache';
const CONTACTS_PREFIX = '/api/v1/contacts';
const colleaguesCache = createQueryCache({ ttlMs: 5 * 60_000 });
const clientsMergedCache = createQueryCache({ ttlMs: 2 * 60_000, maxEntries: 4 });
const clientContactsCache = createQueryCache({ ttlMs: 5 * 60_000, maxEntries: 200 });
const COLLEAGUES_CACHE_KEY = 'contacts-colleagues';
export class ContactsHttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.name = 'ContactsHttpError';
        this.status = status;
    }
}
export function isContactsHttpError(e, status) {
    return e instanceof ContactsHttpError && (status === undefined || e.status === status);
}
async function throwIfNotOk(res) {
    if (res.ok)
        return res;
    let msg = `HTTP ${res.status}`;
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed) {
        try {
            const j = JSON.parse(text);
            if (typeof j.detail === 'string' && j.detail.trim())
                msg = j.detail.trim();
            else if (typeof j.message === 'string' && j.message.trim())
                msg = j.message.trim();
            else
                msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
        }
        catch {
            msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
        }
    }
    throw new ContactsHttpError(res.status, msg);
}
async function fetchContactsColleagues() {
    const res = await apiFetch(`${CONTACTS_PREFIX}/colleagues`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => normalizeTimeTrackingUserRow(item))
        .filter((x) => x != null);
}
export async function listContactsColleagues() {
    return colleaguesCache.fetch(COLLEAGUES_CACHE_KEY, fetchContactsColleagues);
}
export async function listColleaguesAsUsers() {
    const rows = await listContactsColleagues();
    return rows
        .map(timeTrackingRowToUser)
        .sort((a, b) => compareRuLabels(userPickerSortLabel(a), userPickerSortLabel(b)));
}
function parseClientsPage(raw, request) {
    if (Array.isArray(raw)) {
        const items = raw.map(normalizeTimeManagerClient);
        return {
            items,
            total: request.limit > 0 ? Number.POSITIVE_INFINITY : items.length,
            limit: request.limit,
            offset: request.offset,
        };
    }
    if (raw && typeof raw === 'object' && 'items' in raw) {
        const o = raw;
        const arr = Array.isArray(o.items) ? o.items : [];
        const items = arr.map(normalizeTimeManagerClient);
        const total = typeof o.total === 'number' ? o.total : items.length;
        const limit = typeof o.limit === 'number' ? o.limit : request.limit;
        const offset = typeof o.offset === 'number' ? o.offset : request.offset;
        return { items, total, limit, offset };
    }
    return { items: [], total: 0, limit: request.limit, offset: request.offset };
}
export async function listContactsClients(includeArchived = false, pagination) {
    const qs = new URLSearchParams();
    if (includeArchived)
        qs.set('includeArchived', 'true');
    if (pagination) {
        qs.set('limit', String(pagination.limit));
        qs.set('offset', String(pagination.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`${CONTACTS_PREFIX}/clients${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (pagination) {
        return parseClientsPage(raw, {
            limit: pagination.limit,
            offset: pagination.offset ?? 0,
        });
    }
    if (!Array.isArray(raw))
        return [];
    return raw.map(normalizeTimeManagerClient);
}
const CONTACTS_CLIENTS_PAGE_SIZE = 500;
async function mergeContactsClientPages(fetchPage) {
    const acc = [];
    let offset = 0;
    for (;;) {
        const page = await fetchPage(offset);
        acc.push(...page.items);
        if (page.items.length === 0)
            break;
        offset += page.items.length;
        if (Number.isFinite(page.total) && offset >= page.total)
            break;
        if (page.items.length < page.limit)
            break;
    }
    return acc;
}
async function fetchAllContactsClientsMerged(includeArchived) {
    const acc = await mergeContactsClientPages((offset) => listContactsClients(includeArchived, {
        limit: CONTACTS_CLIENTS_PAGE_SIZE,
        offset,
    }));
    acc.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return acc;
}
export async function listAllContactsClientsMerged(includeArchived = false) {
    return clientsMergedCache.fetch(`contacts-clients:${includeArchived}`, () => fetchAllContactsClientsMerged(includeArchived));
}
export async function listContactsClientContacts(clientId) {
    return clientContactsCache.fetch(clientId, async () => {
        const res = await apiFetch(`${CONTACTS_PREFIX}/clients/${encodeURIComponent(clientId)}/contacts`);
        await throwIfNotOk(res);
        const raw = await res.json();
        const arr = unwrapTimeTrackingListArray(raw);
        if (!arr)
            return [];
        return arr.map(normalizeTimeManagerContact).filter((x) => x != null);
    });
}
export async function createContactsClientContact(clientId, body) {
    const res = await apiFetch(`${CONTACTS_PREFIX}/clients/${encodeURIComponent(clientId)}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: body.name,
            phone: body.phone ?? null,
            email: body.email ?? null,
            sortOrder: body.sortOrder ?? null,
        }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeManagerContact(await res.json());
    if (!row)
        throw new Error('Некорректный ответ при создании контакта');
    const cached = clientContactsCache.get(clientId);
    if (cached)
        clientContactsCache.prime(clientId, [...cached, row]);
    else
        clientContactsCache.invalidate(clientId);
    clientsMergedCache.invalidate();
    return row;
}
export async function patchContactsClientContact(clientId, contactId, patch) {
    const p = {};
    if (patch.name !== undefined)
        p.name = patch.name;
    if (patch.phone !== undefined)
        p.phone = patch.phone;
    if (patch.email !== undefined)
        p.email = patch.email;
    if (patch.sortOrder !== undefined)
        p.sortOrder = patch.sortOrder;
    const res = await apiFetch(`${CONTACTS_PREFIX}/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeManagerContact(await res.json());
    if (!row)
        throw new Error('Некорректный ответ при обновлении контакта');
    const cached = clientContactsCache.get(clientId);
    if (cached)
        clientContactsCache.prime(clientId, cached.map((contact) => contact.id === contactId ? row : contact));
    else
        clientContactsCache.invalidate(clientId);
    clientsMergedCache.invalidate();
    return row;
}
export async function deleteContactsClientContact(clientId, contactId) {
    const res = await apiFetch(`${CONTACTS_PREFIX}/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
    const cached = clientContactsCache.get(clientId);
    if (cached)
        clientContactsCache.prime(clientId, cached.filter((contact) => contact.id !== contactId));
    else
        clientContactsCache.invalidate(clientId);
    clientsMergedCache.invalidate();
}
