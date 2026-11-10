import { apiFetch } from '@shared/api';
import type { AclLevel, FileKind } from './filesApi';
import { FilesApiError } from './filesApi';

const BASE = '/api/v1/legal-hub/drive';

export type DiskFolder = {
    id: string;
    name: string;
    createdAt: string | null;
};

export type DiskFile = {
    id: string;
    name: string;
    kind: FileKind | string;
    size: string;
    sizeBytes?: number;
    createdAt: string | null;
};

export type DiskBrowse = {
    path: Array<{ id: string; name: string }>;
    folderId: string | null;
    level: AclLevel | 'none' | string;
    canEdit: boolean;
    canManage: boolean;
    folders: DiskFolder[];
    files: DiskFile[];
};

export type DiskAclRow = {
    folderId: string | null;
    userId: number;
    userName: string;
    level: AclLevel;
    note: string;
    grantedBy: string;
    grantedAt: string | null;
};

async function fail(response: Response): Promise<never> {
    let message = `HTTP ${response.status}`;
    try {
        const body = await response.json() as { detail?: unknown };
        if (typeof body.detail === 'string' && body.detail.trim())
            message = body.detail;
    }
    catch {
        /* ignore */
    }
    throw new FilesApiError(response.status, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await apiFetch(`${BASE}${path}`, init);
    if (!response.ok)
        await fail(response);
    return await response.json() as T;
}

function query(params: Record<string, string | number | null | undefined>): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '')
            continue;
        qs.set(key, String(value));
    }
    const text = qs.toString();
    return text ? `?${text}` : '';
}

export const diskApi = {
    browse: (folderId: string | null) =>
        request<DiskBrowse>(`${query({ parentId: folderId })}`),
    createFolder: (name: string, parentId: string | null) =>
        request<DiskBrowse>('/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId }),
        }),
    upload: (files: File[], parentId: string | null) => {
        const body = new FormData();
        for (const file of files)
            body.append('files', file);
        if (parentId)
            body.append('parentId', parentId);
        return request<DiskBrowse>('/files', { method: 'POST', body });
    },
    deleteFile: (fileId: string) =>
        request<DiskBrowse>(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
    deleteFolder: (folderId: string) =>
        request<DiskBrowse>(`/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' }),
    downloadBlob: async (fileId: string) => {
        const response = await apiFetch(`${BASE}/files/${encodeURIComponent(fileId)}`);
        if (!response.ok)
            await fail(response);
        return await response.blob();
    },
    security: (folderId: string | null) =>
        request<{ folderId: string | null; acl: DiskAclRow[] }>(`/security${query({ folderId })}`),
    setAcl: (folderId: string | null, body: { userId: number; userName: string; level: AclLevel; note?: string }) =>
        request<{ acl: DiskAclRow }>(`/security${query({ folderId })}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    removeAcl: (folderId: string | null, userId: number) =>
        request<{ ok: true }>(`/security/${userId}${query({ folderId })}`, { method: 'DELETE' }),
};
