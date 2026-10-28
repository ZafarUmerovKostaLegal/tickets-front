import { apiFetch } from '@shared/api';
async function readError(res) {
    try {
        const data = await res.json();
        return data.hint || data.detail || `HR ${res.status}`;
    }
    catch {
        return `HR ${res.status}`;
    }
}
export async function listAccountingSettings() {
    const res = await apiFetch('/api/v1/hr/accounting-settings');
    if (!res.ok)
        throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
}
export async function saveAccountingSetting(key, value) {
    const res = await apiFetch(`/api/v1/hr/accounting-settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
    });
    if (!res.ok)
        throw new Error(await readError(res));
    return res.json();
}
export async function deleteAccountingSetting(key) {
    const res = await apiFetch(`/api/v1/hr/accounting-settings/${encodeURIComponent(key)}`, {
        method: 'DELETE',
    });
    if (!res.ok)
        throw new Error(await readError(res));
}
function asPersonnelFile(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const row = raw;
    const id = String(row.id ?? '').trim();
    const userId = Number(row.userId);
    if (!id || !Number.isFinite(userId))
        return null;
    return {
        id,
        userId,
        slot: String(row.slot ?? ''),
        filename: String(row.filename ?? ''),
        contentType: row.contentType == null ? null : String(row.contentType),
        byteSize: Number(row.byteSize) || 0,
        isPrimary: row.isPrimary === true,
        createdAt: row.createdAt == null ? null : String(row.createdAt),
    };
}
export async function listPersonnelFiles(userId) {
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/files`);
    if (!res.ok)
        throw new Error(await readError(res));
    const data = await res.json();
    return (data.items ?? []).map(asPersonnelFile).filter((row) => row != null);
}
export async function listPersonnelPhotoIndex() {
    const res = await apiFetch('/api/v1/hr/personnel/photos');
    if (!res.ok)
        throw new Error(await readError(res));
    const data = await res.json();
    return (data.items ?? []).flatMap((raw) => {
        if (!raw || typeof raw !== 'object')
            return [];
        const row = raw;
        const userId = Number(row.userId);
        const updatedAt = String(row.updatedAt ?? '').trim();
        if (!Number.isFinite(userId) || !updatedAt)
            return [];
        return [{ userId, updatedAt }];
    });
}
export async function uploadPersonnelFile(userId, slot, file) {
    const form = new FormData();
    form.append('slot', slot);
    form.append('file', file);
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/files`, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await readError(res));
    const parsed = asPersonnelFile(await res.json());
    if (!parsed)
        throw new Error('HR вернул пустой файл');
    return parsed;
}
export async function uploadPersonnelPhoto(userId, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/photo`, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await readError(res));
    const parsed = asPersonnelFile(await res.json());
    if (!parsed)
        throw new Error('HR вернул пустое фото');
    return parsed;
}
export async function setPersonnelPrimaryPhoto(userId, fileId) {
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/files/${encodeURIComponent(fileId)}/primary`, {
        method: 'POST',
    });
    if (!res.ok)
        throw new Error(await readError(res));
    const parsed = asPersonnelFile(await res.json());
    if (!parsed)
        throw new Error('HR вернул пустое фото');
    return parsed;
}
export async function deletePersonnelFile(userId, fileId) {
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
    });
    if (!res.ok)
        throw new Error(await readError(res));
}
export async function fetchPersonnelFileBlob(userId, fileId) {
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/files/${encodeURIComponent(fileId)}`);
    if (!res.ok)
        throw new Error(await readError(res));
    return res.blob();
}
export async function fetchPersonnelPhotoBlob(userId, version) {
    const res = await apiFetch(`/api/v1/hr/personnel/${userId}/photo?v=${encodeURIComponent(version)}`);
    if (!res.ok)
        throw new Error(await readError(res));
    return res.blob();
}
