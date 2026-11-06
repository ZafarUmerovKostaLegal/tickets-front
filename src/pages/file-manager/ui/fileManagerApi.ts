import { apiFetch } from '@shared/api';

export type DriveFolder = { id: string; name: string };
export type DriveFile = { id: string; name: string; kind: string; size: string };
export type DriveListing = {
    path: DriveFolder[];
    folders: DriveFolder[];
    files: DriveFile[];
};

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function readListing(body: unknown): DriveListing {
    const row = body as { path?: unknown; folders?: unknown; files?: unknown };
    const folders = Array.isArray(row.folders) ? row.folders.flatMap((item) => {
        const folder = item as { id?: unknown; name?: unknown };
        const id = text(folder.id);
        const name = text(folder.name).trim();
        return id && name ? [{ id, name }] : [];
    }) : [];
    const path = Array.isArray(row.path) ? row.path.flatMap((item) => {
        const folder = item as { id?: unknown; name?: unknown };
        const id = text(folder.id);
        const name = text(folder.name).trim();
        return id && name ? [{ id, name }] : [];
    }) : [];
    const files = Array.isArray(row.files) ? row.files.flatMap((item) => {
        const file = item as { id?: unknown; name?: unknown; kind?: unknown; size?: unknown };
        const id = text(file.id);
        const name = text(file.name).trim();
        return id && name ? [{ id, name, kind: text(file.kind) || 'file', size: text(file.size) }] : [];
    }) : [];
    return { path, folders, files };
}

async function readOk(response: Response): Promise<DriveListing | null> {
    if (!response.ok)
        return null;
    return readListing(await response.json());
}

export async function listDrive(folderId: string | null): Promise<DriveListing | null> {
    const query = folderId ? `?parentId=${encodeURIComponent(folderId)}` : '';
    try {
        const response = await apiFetch(`/api/v1/legal-hub/drive${query}`);
        return await readOk(response);
    }
    catch {
        return null;
    }
}

export async function createDriveFolder(name: string, parentId: string | null): Promise<DriveListing | null> {
    try {
        const response = await apiFetch('/api/v1/legal-hub/drive/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId }),
        });
        return await readOk(response);
    }
    catch {
        return null;
    }
}

export async function uploadDriveFiles(files: File[], parentId: string | null): Promise<DriveListing | null> {
    const body = new FormData();
    for (const file of files)
        body.append('files', file);
    if (parentId)
        body.append('parentId', parentId);
    try {
        const response = await apiFetch('/api/v1/legal-hub/drive/files', {
            method: 'POST',
            body,
        });
        return await readOk(response);
    }
    catch {
        return null;
    }
}

export async function deleteDriveFolder(folderId: string): Promise<DriveListing | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/drive/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
        return await readOk(response);
    }
    catch {
        return null;
    }
}

export async function deleteDriveFile(fileId: string): Promise<DriveListing | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/drive/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
        return await readOk(response);
    }
    catch {
        return null;
    }
}

export async function fetchDriveFileBlob(fileId: string): Promise<Blob | null> {
    try {
        const response = await apiFetch(`/api/v1/legal-hub/drive/files/${encodeURIComponent(fileId)}`);
        if (!response.ok)
            return null;
        return await response.blob();
    }
    catch {
        return null;
    }
}
