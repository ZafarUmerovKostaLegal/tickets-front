import { apiFetch } from '@shared/api';
import { parseInternalExtension, parseInternalExtensionList } from './lib/parseInternalExtension';
import type { InternalExtension } from './model/types';

const BASE = '/api/v1/contacts/internal-extensions';

async function parseError(res: Response, fallback: string): Promise<string> {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: unknown })?.detail;
    if (typeof detail === 'string' && detail.trim())
        return detail;
    return res.statusText || fallback;
}

function requireRow(raw: unknown, fallback: string): InternalExtension {
    const row = parseInternalExtension(raw);
    if (!row)
        throw new Error(fallback);
    return row;
}

export async function fetchInternalExtensions(signal?: AbortSignal): Promise<InternalExtension[]> {
    const res = await apiFetch(BASE, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось загрузить справочник'));
    return parseInternalExtensionList(await res.json());
}

export async function createInternalExtension(body: { fullName: string; extension: string }): Promise<InternalExtension> {
    const res = await apiFetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: body.fullName, extension: body.extension }),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось добавить контакт'));
    return requireRow(await res.json(), 'Не удалось добавить контакт');
}

export async function patchInternalExtension(
    id: number,
    body: { fullName?: string; extension?: string },
): Promise<InternalExtension> {
    const res = await apiFetch(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...(body.fullName != null ? { fullName: body.fullName } : {}),
            ...(body.extension != null ? { extension: body.extension } : {}),
        }),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось сохранить контакт'));
    return requireRow(await res.json(), 'Не удалось сохранить контакт');
}

export async function deleteInternalExtension(id: number): Promise<void> {
    const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось удалить контакт'));
}
