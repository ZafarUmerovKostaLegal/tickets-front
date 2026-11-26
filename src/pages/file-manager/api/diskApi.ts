import { apiFetch } from '@shared/api';
import { getApiBaseUrl, upgradeUrlToPageSecurity } from '@shared/config';
import type { AclLevel, FileKind } from './filesApi';
import { FilesApiError } from './filesApi';
import type { ArchiveListing, EmailPreview } from '../lib/previewKinds';

const BASE = '/api/v1/legal-hub/drive';

export type DiskCrumb = { id: string; name: string };

export type DiskFolder = {
    id: string;
    name: string;
    createdAt: string | null;
    updatedAt?: string | null;
    hidden?: boolean;
    itemCount?: number;
    parentId?: string | null;
    path?: DiskCrumb[];
};

export type DiskFile = {
    id: string;
    name: string;
    kind: FileKind | string;
    size: string;
    sizeBytes?: number;
    createdAt: string | null;
    updatedAt?: string | null;
    hidden?: boolean;
    folderId?: string | null;
    path?: DiskCrumb[];
};

export type DiskBrowse = {
    path: DiskCrumb[];
    folderId: string | null;
    level: AclLevel | 'none' | string;
    canEdit: boolean;
    canManage: boolean;
    folders: DiskFolder[];
    files: DiskFile[];
    createdId?: string | null;
};

export type DiskTreeRow = { id: string; parentId: string | null; name: string; hidden: boolean };

export type DiskSearch = {
    query: string;
    folders: DiskFolder[];
    files: DiskFile[];
    truncated: boolean;
};

export type DiskSelection = { folderIds: string[]; fileIds: string[] };

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
    }
    throw new FilesApiError(response.status, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await apiFetch(`${BASE}${path}`, init);
    if (!response.ok)
        await fail(response);
    return await response.json() as T;
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '' || value === false)
            continue;
        qs.set(key, String(value));
    }
    const text = qs.toString();
    return text ? `?${text}` : '';
}

function json(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export type DiskDeletedRow = {
    id: string;
    source: 'drive' | 'task';
    name: string;
    sizeBytes: number;
    contentType: string;
    path: string;
    taskId: string | null;
    deletedBy: string;
    deletedAt: string | null;
    createdAt: string | null;
};

export const diskApi = {
    browse: (folderId: string | null, showHidden = false) =>
        request<DiskBrowse>(query({ parentId: folderId, showHidden })),
    tree: (showHidden = false) =>
        request<{ folders: DiskTreeRow[] }>(`/tree${query({ showHidden })}`),
    search: (q: string, folderId: string | null, showHidden = false) =>
        request<DiskSearch>(`/search${query({ q, folderId, showHidden })}`),
    createFolder: (name: string, parentId: string | null, showHidden = false) =>
        request<DiskBrowse>(`/folders${query({ showHidden })}`, json('POST', { name, parentId })),
    upload: (files: File[], parentId: string | null, options: { paths?: string[]; showHidden?: boolean } = {}) => {
        const body = new FormData();
        files.forEach((file, index) => {
            body.append('files', file);
            if (options.paths)
                body.append('paths', options.paths[index] ?? file.name);
        });
        if (parentId)
            body.append('parentId', parentId);
        return request<DiskBrowse>(`/files${query({ showHidden: options.showHidden })}`, { method: 'POST', body });
    },
    renameFolder: (folderId: string, name: string, showHidden = false) =>
        request<DiskBrowse>(`/folders/${encodeURIComponent(folderId)}${query({ showHidden })}`, json('PATCH', { name })),
    renameFile: (fileId: string, name: string, showHidden = false) =>
        request<DiskBrowse>(`/files/${encodeURIComponent(fileId)}${query({ showHidden })}`, json('PATCH', { name })),
    move: (selection: DiskSelection, targetId: string | null) =>
        request<{ moved: number; targetId: string | null }>('/move', json('POST', { ...selection, targetId })),
    copy: (selection: DiskSelection, targetId: string | null) =>
        request<{ copied: number; targetId: string | null }>('/copy', json('POST', { ...selection, targetId })),
    hide: (selection: DiskSelection, hidden: boolean) =>
        request<{ updated: number }>('/hide', json('POST', { ...selection, hidden })),
    remove: (selection: DiskSelection) =>
        request<{ deleted: number }>('/delete', json('POST', selection)),
    zipLink: async (selection: DiskSelection, name?: string) => {
        const body = await request<{ url: string; fileName: string; files: number; sizeBytes: number }>('/zip/link', json('POST', { ...selection, name }));
        return { ...body, url: upgradeUrlToPageSecurity(`${getApiBaseUrl()}${body.url}`) };
    },
    deleteFile: (fileId: string) =>
        request<DiskBrowse>(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
    deleteFolder: (folderId: string) =>
        request<DiskBrowse>(`/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' }),
    link: async (fileId: string, options: { inline?: boolean; entry?: number } = {}) => {
        const body = await request<{ url: string }>(`/files/${encodeURIComponent(fileId)}/link${query({ inline: options.inline, entry: options.entry })}`, { method: 'POST' });
        return upgradeUrlToPageSecurity(`${getApiBaseUrl()}${body.url}`);
    },
    headBlob: async (fileId: string, bytes: number) => {
        const response = await apiFetch(`${BASE}/files/${encodeURIComponent(fileId)}`, { headers: { Range: `bytes=0-${bytes - 1}` }, skipGetDedupe: true });
        if (!response.ok)
            await fail(response);
        return (await response.blob()).slice(0, bytes);
    },
    archive: (fileId: string) => request<ArchiveListing>(`/files/${encodeURIComponent(fileId)}/archive`),
    archiveEntryBlob: async (fileId: string, index: number) => {
        const response = await apiFetch(`${BASE}/files/${encodeURIComponent(fileId)}/archive/${index}?inline=true`);
        if (!response.ok)
            await fail(response);
        return await response.blob();
    },
    email: (fileId: string) => request<EmailPreview>(`/files/${encodeURIComponent(fileId)}/email`),
    emailAttachmentBlob: async (fileId: string, index: number) => {
        const response = await apiFetch(`${BASE}/files/${encodeURIComponent(fileId)}/email/${index}`);
        if (!response.ok)
            await fail(response);
        return await response.blob();
    },
    downloadBlob: async (fileId: string) => {
        const response = await apiFetch(`${BASE}/files/${encodeURIComponent(fileId)}`);
        if (!response.ok)
            await fail(response);
        return await response.blob();
    },
    security: (folderId: string | null) =>
        request<{ folderId: string | null; acl: DiskAclRow[] }>(`/security${query({ folderId })}`),
    setAcl: (folderId: string | null, body: { userId: number; userName: string; level: AclLevel; note?: string }) =>
        request<{ acl: DiskAclRow }>(`/security${query({ folderId })}`, json('PUT', body)),
    removeAcl: (folderId: string | null, userId: number) =>
        request<{ ok: true }>(`/security/${userId}${query({ folderId })}`, { method: 'DELETE' }),
    deleted: () => request<{ items: DiskDeletedRow[] }>('/deleted'),
    restoreDeleted: (id: string) =>
        request<{ parentId: string | null }>(`/deleted/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
};
