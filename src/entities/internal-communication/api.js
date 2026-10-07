import { apiFetch } from '@shared/api';
import { parseInternalExtension, parseInternalExtensionList } from './lib/parseInternalExtension';
const BASE = '/api/v1/contacts/internal-extensions';
async function parseError(res, fallback) {
    const err = await res.json().catch(() => ({}));
    const detail = err?.detail;
    if (typeof detail === 'string' && detail.trim())
        return detail;
    return res.statusText || fallback;
}
function requireRow(raw, fallback) {
    const row = parseInternalExtension(raw);
    if (!row)
        throw new Error(fallback);
    return row;
}
export async function fetchInternalExtensions(signal) {
    const res = await apiFetch(BASE, { signal });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось загрузить справочник'));
    return parseInternalExtensionList(await res.json());
}
export async function createInternalExtension(body) {
    const res = await apiFetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: body.fullName, extension: body.extension }),
    });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось добавить контакт'));
    return requireRow(await res.json(), 'Не удалось добавить контакт');
}
export async function patchInternalExtension(id, body) {
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
export async function deleteInternalExtension(id) {
    const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok)
        throw new Error(await parseError(res, 'Не удалось удалить контакт'));
}
