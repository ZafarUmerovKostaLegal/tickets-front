import { apiFetch } from '@shared/api';
import {
    getTimeTrackingCached,
    setTimeTrackingCached,
} from '../../lib/timeTrackingListCache';
import { isActiveTimeManagerClientRow } from '../../lib/projectTimeEntry';
import {
    type PaginatedResult,
    type TimeTrackingPaginationParams,
    parseTimeTrackingPagedResponse,
    unwrapTimeTrackingListArray,
    throwIfNotOk,
} from './httpShared';

export type TimeManagerClientContactRow = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    sort_order: number | null;
};
export type TimeManagerClientRow = {
    id: string;
    name: string;
    address: string | null;
    currency: string;
    invoice_due_mode: string;
    invoice_due_days_after_issue: number | null;
    tax_percent: string | number | null;
    tax2_percent: string | number | null;
    discount_percent: string | number | null;
    created_at: string;
    updated_at: string | null;
    phone?: string | null;
    email?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    is_archived?: boolean;
    extra_contacts?: TimeManagerClientContactRow[];
};
export function readStr(v: unknown): string | null {
    if (v == null || v === '')
        return null;
    return String(v);
}
export function readNumOrNull(v: unknown): number | null {
    if (v == null || v === '')
        return null;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
}
export function readPercentField(v: unknown): string | number | null {
    if (v == null || v === '')
        return null;
    if (typeof v === 'number' || typeof v === 'string')
        return v;
    return null;
}
export function normalizeTimeManagerContact(raw: unknown): TimeManagerClientContactRow | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = o.id != null ? String(o.id) : '';
    if (!id)
        return null;
    return {
        id,
        name: readStr(o.name ?? o.contactName ?? o.contact_name) ?? '',
        phone: readStr(o.phone ?? o.contactPhone ?? o.contact_phone),
        email: readStr(o.email ?? o.contactEmail ?? o.contact_email),
        sort_order: readNumOrNull(o.sortOrder ?? o.sort_order),
    };
}
export function normalizeTimeManagerClient(raw: unknown): TimeManagerClientRow {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const extraRaw = o.extraContacts ?? o.extra_contacts;
    const extra: TimeManagerClientContactRow[] = Array.isArray(extraRaw)
        ? extraRaw.map(normalizeTimeManagerContact).filter((x): x is TimeManagerClientContactRow => x != null)
        : [];
    return {
        id: o.id != null ? String(o.id) : '',
        name: readStr(o.name) ?? '',
        address: readStr(o.address),
        currency: readStr(o.currency) ?? 'USD',
        invoice_due_mode: readStr(o.invoiceDueMode ?? o.invoice_due_mode) ?? 'custom',
        invoice_due_days_after_issue: readNumOrNull(o.invoiceDueDaysAfterIssue ?? o.invoice_due_days_after_issue),
        tax_percent: readPercentField(o.taxPercent ?? o.tax_percent),
        tax2_percent: readPercentField(o.tax2Percent ?? o.tax2_percent),
        discount_percent: readPercentField(o.discountPercent ?? o.discount_percent),
        created_at: readStr(o.createdAt ?? o.created_at) ?? '',
        updated_at: readStr(o.updatedAt ?? o.updated_at),
        phone: readStr(o.phone),
        email: readStr(o.email),
        contact_name: readStr(o.contactName ?? o.contact_name),
        contact_phone: readStr(o.contactPhone ?? o.contact_phone),
        contact_email: readStr(o.contactEmail ?? o.contact_email),
        is_archived: Boolean(o.isArchived ?? o.is_archived),
        extra_contacts: extra.length > 0 ? extra : undefined,
    };
}
export type TimeManagerClientCreatePayload = {
    name: string;
    address?: string | null;
    currency?: string;
    invoiceDueMode?: string;
    invoiceDueDaysAfterIssue?: number | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    phone?: string | null;
    email?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    isArchived?: boolean;
};
export type TimeManagerClientPatchPayload = {
    name?: string;
    address?: string | null;
    currency?: string;
    invoiceDueMode?: string;
    invoiceDueDaysAfterIssue?: number | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    phone?: string | null;
    email?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    isArchived?: boolean;
};
export function clientCreateJson(body: TimeManagerClientCreatePayload): Record<string, unknown> {
    return {
        name: body.name,
        address: body.address ?? null,
        currency: body.currency ?? 'USD',
        invoiceDueMode: body.invoiceDueMode ?? 'custom',
        invoiceDueDaysAfterIssue: body.invoiceDueDaysAfterIssue ?? null,
        taxPercent: body.taxPercent ?? null,
        tax2Percent: body.tax2Percent ?? null,
        discountPercent: body.discountPercent ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        contactEmail: body.contactEmail ?? null,
        isArchived: body.isArchived ?? false,
        is_archived: body.isArchived ?? false,
    };
}
export function clientPatchJson(patch: TimeManagerClientPatchPayload): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name;
    if (patch.address !== undefined)
        payload.address = patch.address;
    if (patch.currency !== undefined)
        payload.currency = patch.currency;
    if (patch.invoiceDueMode !== undefined)
        payload.invoiceDueMode = patch.invoiceDueMode;
    if (patch.invoiceDueDaysAfterIssue !== undefined)
        payload.invoiceDueDaysAfterIssue = patch.invoiceDueDaysAfterIssue;
    if (patch.taxPercent !== undefined)
        payload.taxPercent = patch.taxPercent;
    if (patch.tax2Percent !== undefined)
        payload.tax2Percent = patch.tax2Percent;
    if (patch.discountPercent !== undefined)
        payload.discountPercent = patch.discountPercent;
    if (patch.phone !== undefined)
        payload.phone = patch.phone;
    if (patch.email !== undefined)
        payload.email = patch.email;
    if (patch.contactName !== undefined)
        payload.contactName = patch.contactName;
    if (patch.contactPhone !== undefined)
        payload.contactPhone = patch.contactPhone;
    if (patch.contactEmail !== undefined)
        payload.contactEmail = patch.contactEmail;
    if (patch.isArchived !== undefined) {
        payload.isArchived = patch.isArchived;
        payload.is_archived = patch.isArchived;
    }
    return payload;
}
export async function listTimeManagerClients(includeArchived?: boolean): Promise<TimeManagerClientRow[]>;
export async function listTimeManagerClients(includeArchived: boolean, pagination: TimeTrackingPaginationParams): Promise<PaginatedResult<TimeManagerClientRow>>;
export async function listTimeManagerClients(includeArchived = false, pagination?: TimeTrackingPaginationParams): Promise<TimeManagerClientRow[] | PaginatedResult<TimeManagerClientRow>> {
    const qs = new URLSearchParams();
    if (includeArchived)
        qs.set('includeArchived', 'true');
    if (pagination) {
        qs.set('limit', String(pagination.limit));
        qs.set('offset', String(pagination.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (pagination) {
        const off = pagination.offset ?? 0;
        return parseTimeTrackingPagedResponse(raw, (item) => normalizeTimeManagerClient(item), {
            limit: pagination.limit,
            offset: off,
        });
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    return arr.map(normalizeTimeManagerClient);
}
export async function getTimeManagerClient(clientId: string): Promise<TimeManagerClientRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`);
    await throwIfNotOk(res);
    return normalizeTimeManagerClient(await res.json());
}
export async function createTimeManagerClient(body: TimeManagerClientCreatePayload): Promise<TimeManagerClientRow> {
    const res = await apiFetch('/api/v1/time-tracking/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientCreateJson(body)),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerClient(await res.json());
}
export async function patchTimeManagerClient(clientId: string, patch: TimeManagerClientPatchPayload): Promise<TimeManagerClientRow> {
    const payload = clientPatchJson(patch);
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerClient(await res.json());
}
export async function deleteTimeManagerClient(clientId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export type TimeManagerClientContactCreatePayload = {
    name: string;
    phone?: string | null;
    email?: string | null;
    sortOrder?: number | null;
};
export type TimeManagerClientContactPatchPayload = {
    name?: string;
    phone?: string | null;
    email?: string | null;
    sortOrder?: number | null;
};
export async function listClientContacts(clientId: string): Promise<TimeManagerClientContactRow[]> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts`);
    await throwIfNotOk(res);
    const raw = await res.json();
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    return arr.map(normalizeTimeManagerContact).filter((x): x is TimeManagerClientContactRow => x != null);
}
export async function createClientContact(clientId: string, body: TimeManagerClientContactCreatePayload): Promise<TimeManagerClientContactRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts`, {
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
    return row;
}
export async function patchClientContact(clientId: string, contactId: string, patch: TimeManagerClientContactPatchPayload): Promise<TimeManagerClientContactRow> {
    const p: Record<string, unknown> = {};
    if (patch.name !== undefined)
        p.name = patch.name;
    if (patch.phone !== undefined)
        p.phone = patch.phone;
    if (patch.email !== undefined)
        p.email = patch.email;
    if (patch.sortOrder !== undefined)
        p.sortOrder = patch.sortOrder;
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    await throwIfNotOk(res);
    const row = normalizeTimeManagerContact(await res.json());
    if (!row)
        throw new Error('Некорректный ответ при обновлении контакта');
    return row;
}
export async function deleteClientContact(clientId: string, contactId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}

export type TimeManagerClientExpenseCategoryRow = {
    id: string;
    client_id: string;
    name: string;
    has_unit_price: boolean;
    is_archived: boolean;
    sort_order: number | null;
    created_at: string;
    updated_at: string | null;
    usage_count: number;
    deletable: boolean;
};
export type TimeManagerClientExpenseCategoryCreatePayload = {
    name: string;
    hasUnitPrice?: boolean;
    sortOrder?: number | null;
};
export type TimeManagerClientExpenseCategoryPatchPayload = {
    name?: string;
    hasUnitPrice?: boolean;
    isArchived?: boolean;
    sortOrder?: number | null;
};
export async function listClientExpenseCategories(clientId: string, options?: {
    includeArchived?: boolean;
}): Promise<TimeManagerClientExpenseCategoryRow[]> {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories${suffix}`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow[];
}
export async function getClientExpenseCategory(clientId: string, categoryId: string): Promise<TimeManagerClientExpenseCategoryRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow;
}
export async function createClientExpenseCategory(clientId: string, body: TimeManagerClientExpenseCategoryCreatePayload): Promise<TimeManagerClientExpenseCategoryRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: body.name,
            hasUnitPrice: body.hasUnitPrice ?? false,
            sortOrder: body.sortOrder ?? null,
        }),
    });
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow;
}
export async function patchClientExpenseCategory(clientId: string, categoryId: string, patch: TimeManagerClientExpenseCategoryPatchPayload): Promise<TimeManagerClientExpenseCategoryRow> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name;
    if (patch.hasUnitPrice !== undefined)
        payload.hasUnitPrice = patch.hasUnitPrice;
    if (patch.isArchived !== undefined)
        payload.isArchived = patch.isArchived;
    if (patch.sortOrder !== undefined)
        payload.sortOrder = patch.sortOrder;
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow;
}
export async function deleteClientExpenseCategory(clientId: string, categoryId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}

export async function listAllTimeManagerClientsMerged(includeArchived = false): Promise<TimeManagerClientRow[]> {
    const cacheKey = `clients:v3:${includeArchived}`;
    const cached = getTimeTrackingCached<TimeManagerClientRow[]>('clients', cacheKey);
    if (cached)
        return cached;
    const qs = new URLSearchParams();
    if (includeArchived)
        qs.set('includeArchived', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    const arr = unwrapTimeTrackingListArray(raw);
    const acc = (arr ?? [])
        .map((item) => normalizeTimeManagerClient(item))
        .filter((c) => c.id);
    const rows = includeArchived ? acc : acc.filter(isActiveTimeManagerClientRow);
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    setTimeTrackingCached('clients', cacheKey, rows);
    return rows;
}
