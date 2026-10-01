import { apiFetch } from '@shared/api';

export type AccountingSetting = {
    key: string;
    value: string;
    updatedAt: string | null;
};

async function readError(res: Response): Promise<string> {
    try {
        const data = await res.json() as { detail?: string; hint?: string };
        return data.hint || data.detail || `HR ${res.status}`;
    }
    catch {
        return `HR ${res.status}`;
    }
}

export async function listAccountingSettings(): Promise<AccountingSetting[]> {
    const res = await apiFetch('/api/v1/hr/accounting-settings');
    if (!res.ok)
        throw new Error(await readError(res));
    const data = await res.json() as { items?: AccountingSetting[] };
    return Array.isArray(data.items) ? data.items : [];
}

export async function saveAccountingSetting(key: string, value: string): Promise<AccountingSetting> {
    const res = await apiFetch(`/api/v1/hr/accounting-settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
    });
    if (!res.ok)
        throw new Error(await readError(res));
    return res.json() as Promise<AccountingSetting>;
}

export async function deleteAccountingSetting(key: string): Promise<void> {
    const res = await apiFetch(`/api/v1/hr/accounting-settings/${encodeURIComponent(key)}`, {
        method: 'DELETE',
    });
    if (!res.ok)
        throw new Error(await readError(res));
}
