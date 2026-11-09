import { apiFetch } from '@shared/api';

const BASE = '/api/v1/files';

export type AccessLevel = 'none' | 'read' | 'edit' | 'manage';
export type AclLevel = 'read' | 'edit' | 'manage' | 'deny';
export type FileKind = 'pdf' | 'doc' | 'sheet' | 'slides' | 'email' | 'image' | 'archive' | 'text' | 'file';

export type MatterRow = {
    id: string;
    clientId: string;
    name: string;
    code: string;
    closed: boolean;
    level: AccessLevel;
    mine: boolean;
    provisioned: boolean;
    documents: number;
    favorite: boolean;
};

export type ClientRow = {
    id: string;
    name: string;
    archived: boolean;
    favorite: boolean;
    matters: MatterRow[];
};

export type RequestableMatter = {
    matterId: string;
    matterName: string;
    matterCode: string;
    clientName: string;
};

export type DirectoryStats = {
    clients: number;
    matters: number;
    archivedClients: number;
    closedMatters: number;
    visibleClients: number;
    visibleMatters: number;
};

export type ClientsResponse = {
    viewer: { userId: number; name: string; canManage: boolean };
    clients: ClientRow[];
    requestable: RequestableMatter[];
    stats?: DirectoryStats;
};

export type DocumentRow = {
    id: string;
    docNumber: string;
    name: string;
    kind: FileKind;
    docType: string;
    description: string;
    version: number;
    sizeBytes: number;
    contentType: string;
    folderId: string | null;
    matterId: string;
    matterName: string;
    matterCode: string;
    clientId: string;
    clientName: string;
    createdAt: string | null;
    createdBy: string;
    updatedAt: string | null;
    updatedBy: string;
    checkedOutById: number | null;
    checkedOutBy: string | null;
    checkedOutAt: string | null;
    favorite: boolean;
    lastActivityAt?: string | null;
};

export type FolderRow = {
    id: string;
    parentId: string | null;
    name: string;
    documents: number;
    createdAt: string | null;
    favorite: boolean;
};

export type Crumb = { id: string; name: string };

export type BrowseResponse = {
    matter: { id: string; name: string; code: string; closed: boolean; level: AccessLevel; favorite: boolean };
    client: { id: string; name: string };
    folderId: string | null;
    path: Crumb[];
    folders: FolderRow[];
    documents: DocumentRow[];
};

export type VersionRow = {
    version: number;
    name: string;
    sizeBytes: number;
    comment: string;
    createdBy: string;
    createdAt: string | null;
};

export type AuditRow = {
    id: string;
    at: string | null;
    userId: number;
    userName: string;
    action: string;
    matterId: string;
    matterName: string;
    targetKind: string;
    targetId: string;
    targetName: string;
    detail: string;
};

export type DocumentDetail = {
    document: DocumentRow;
    level: AccessLevel;
    path: Crumb[];
    versions: VersionRow[];
    activity: AuditRow[];
};

export type FavoritesResponse = {
    matters: Array<{ id: string; name: string; code: string; clientId: string; clientName: string; level: AccessLevel }>;
    folders: Array<{ id: string; name: string; matterId: string; matterName: string }>;
    documents: DocumentRow[];
};

export type TrashItem = {
    kind: 'folder' | 'document';
    id: string;
    name: string;
    matterId: string;
    matterName: string;
    clientName: string;
    deletedAt: string | null;
    deletedBy: string;
    canPurge: boolean;
    documents?: number;
    fileKind?: FileKind;
    sizeBytes?: number;
};

export type AccessRequest = {
    id: string;
    matterId: string;
    matterName: string;
    clientName: string;
    userId: number;
    userName: string;
    level: AccessLevel;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    decidedBy: string;
    decidedAt: string | null;
    createdAt: string | null;
};

export type SecurityMember = {
    userId: number;
    name: string;
    position: string;
    source: 'timeTracking' | 'acl' | 'both';
    level: AclLevel;
};

export type SecurityResponse = {
    matter: { id: string; name: string; code: string; clientName: string };
    effective: SecurityMember[];
    acl: Array<{ userId: number; userName: string; level: AclLevel; note: string; grantedBy: string; grantedAt: string | null }>;
};

export type MatrixResponse = {
    client: { id: string; name: string };
    matters: Array<{ id: string; name: string; code: string; closed: boolean }>;
    users: Array<{ userId: number; name: string; position: string }>;
    cells: Record<string, AclLevel>;
    explicit: string[];
};

export type StatsResponse = {
    documents: number;
    storedBytes: number;
    versions: number;
    checkedOut: number;
    inTrash: number;
    pendingRequests: number;
    uploadsWeek: number;
    downloadsDay: number;
    deniedDay: number;
    activeUsers: Array<{ userId: number; name: string; events: number }>;
    activeMatters: Array<{ matterId: string; name: string; events: number }>;
    topDownloaders: Array<{ userId: number; name: string; downloads: number }>;
    recentDenied: AuditRow[];
};

export class FilesApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'FilesApiError';
        this.status = status;
    }
}

async function fail(response: Response): Promise<never> {
    let message = `HTTP ${response.status}`;
    try {
        const body = await response.json() as { detail?: unknown };
        if (typeof body.detail === 'string' && body.detail.trim())
            message = body.detail;
    }
    catch {
        /* non-JSON error body */
    }
    throw new FilesApiError(response.status, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await apiFetch(`${BASE}${path}`, init);
    if (!response.ok)
        await fail(response);
    return await response.json() as T;
}

function json(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
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

export const filesApi = {
    clients: () => request<ClientsResponse>('/clients'),
    browse: (matterId: string, folderId: string | null) =>
        request<BrowseResponse>(`/matters/${encodeURIComponent(matterId)}/browse${query({ folderId })}`),
    createFolder: (matterId: string, name: string, parentId: string | null) =>
        request<{ id: string }>(`/matters/${encodeURIComponent(matterId)}/folders`, json('POST', { name, parentId })),
    updateFolder: (folderId: string, patch: { name?: string; parentId?: string; moveToRoot?: boolean }) =>
        request<{ id: string }>(`/folders/${encodeURIComponent(folderId)}`, json('PATCH', patch)),
    deleteFolder: (folderId: string) => request<{ ok: true }>(`/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' }),
    upload: (matterId: string, folderId: string | null, files: File[], comment = '') => {
        const body = new FormData();
        for (const file of files)
            body.append('files', file);
        if (folderId)
            body.append('folderId', folderId);
        if (comment)
            body.append('comment', comment);
        return request<{ documents: DocumentRow[] }>(`/matters/${encodeURIComponent(matterId)}/documents`, { method: 'POST', body });
    },
    document: (documentId: string) => request<DocumentDetail>(`/documents/${encodeURIComponent(documentId)}`),
    updateDocument: (documentId: string, patch: { name?: string; docType?: string; description?: string; folderId?: string; moveToRoot?: boolean }) =>
        request<{ document: DocumentRow }>(`/documents/${encodeURIComponent(documentId)}`, json('PATCH', patch)),
    checkout: (documentId: string) =>
        request<{ document: DocumentRow }>(`/documents/${encodeURIComponent(documentId)}/checkout`, { method: 'POST' }),
    checkin: (documentId: string, file: File | null, comment: string) => {
        const body = new FormData();
        if (file)
            body.append('file', file);
        body.append('comment', comment);
        return request<{ document: DocumentRow }>(`/documents/${encodeURIComponent(documentId)}/checkin`, { method: 'POST', body });
    },
    discardCheckout: (documentId: string) =>
        request<{ document: DocumentRow }>(`/documents/${encodeURIComponent(documentId)}/discard-checkout`, { method: 'POST' }),
    restoreVersion: (documentId: string, version: number) =>
        request<{ document: DocumentRow }>(`/documents/${encodeURIComponent(documentId)}/versions/${version}/restore`, { method: 'POST' }),
    deleteDocument: (documentId: string) =>
        request<{ ok: true }>(`/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' }),
    contentBlob: async (documentId: string, options: { version?: number; inline?: boolean } = {}) => {
        const response = await apiFetch(`${BASE}/documents/${encodeURIComponent(documentId)}/content${query({ version: options.version, inline: options.inline })}`);
        if (!response.ok)
            await fail(response);
        return await response.blob();
    },
    recent: () => request<{ documents: DocumentRow[] }>('/recent'),
    checkedOut: (scope: 'mine' | 'all') => request<{ documents: DocumentRow[] }>(`/checked-out${query({ scope })}`),
    search: (params: { q?: string; clientId?: string; matterId?: string; kind?: string; checkedOut?: boolean }) =>
        request<{ documents: DocumentRow[]; total: number }>(`/search${query(params)}`),
    favorites: () => request<FavoritesResponse>('/favorites'),
    addFavorite: (kind: 'client' | 'matter' | 'folder' | 'document', targetId: string, matterId = '') =>
        request<{ ok: true }>('/favorites', json('PUT', { kind, targetId, matterId })),
    removeFavorite: (kind: string, targetId: string) =>
        request<{ ok: true }>(`/favorites/${encodeURIComponent(kind)}/${encodeURIComponent(targetId)}`, { method: 'DELETE' }),
    trash: () => request<{ items: TrashItem[] }>('/trash'),
    restoreTrash: (kind: string, id: string) =>
        request<{ ok: true }>(`/trash/${kind}/${encodeURIComponent(id)}/restore`, { method: 'POST' }),
    purgeTrash: (kind: string, id: string) =>
        request<{ ok: true }>(`/trash/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    security: (matterId: string) => request<SecurityResponse>(`/matters/${encodeURIComponent(matterId)}/security`),
    setAcl: (matterId: string, body: { userId: number; userName: string; level: AclLevel; note?: string }) =>
        request<unknown>(`/matters/${encodeURIComponent(matterId)}/security`, json('PUT', body)),
    removeAcl: (matterId: string, userId: number) =>
        request<unknown>(`/matters/${encodeURIComponent(matterId)}/security/${userId}`, { method: 'DELETE' }),
    matrix: (clientId: string) => request<MatrixResponse>(`/matrix${query({ clientId })}`),
    requests: (status: 'pending' | 'all') => request<{ requests: AccessRequest[] }>(`/access-requests${query({ status })}`),
    createRequest: (body: { matterId: string; level: 'read' | 'edit'; reason: string }) =>
        request<{ request: AccessRequest }>('/access-requests', json('POST', body)),
    decideRequest: (id: string, approve: boolean, level?: string) =>
        request<{ request: AccessRequest }>(`/access-requests/${encodeURIComponent(id)}/decision`, json('POST', { approve, level })),
    audit: (params: { matterId?: string; userId?: number; action?: string; q?: string; limit?: number; offset?: number }) =>
        request<{ items: AuditRow[]; total: number }>(`/audit${query(params)}`),
    stats: () => request<StatsResponse>('/stats'),
    template: () => request<{ folders: string[]; canEdit: boolean }>('/settings/template'),
    saveTemplate: (folders: string[]) => request<{ folders: string[] }>('/settings/template', json('PUT', { folders })),
    resetTemplate: () => request<{ folders: string[] }>('/settings/template', { method: 'DELETE' }),
};

export function errorText(error: unknown, fallback: string): string {
    if (error instanceof FilesApiError)
        return error.message;
    return fallback;
}
