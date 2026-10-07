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
