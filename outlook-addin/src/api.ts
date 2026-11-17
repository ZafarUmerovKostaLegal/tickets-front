import { readHubAccessToken } from './auth/session';
import { getSettings } from './settings';

export type MatterOption = {
  id: string;
  name: string;
  code: string;
  clientId: string;
  clientName: string;
  closed: boolean;
};

export type FolderRow = {
  id: string;
  parentId: string | null;
  name: string;
};

type ClientsResponse = {
  clients: Array<{
    id: string;
    name: string;
    matters: Array<{ id: string; name: string; code: string; closed: boolean; level: string }>;
  }>;
};

type BrowseResponse = {
  folders: FolderRow[];
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Matters change rarely; the pinned pane lives for hours, so refresh every few minutes at most. */
const MATTERS_TTL_MS = 10 * 60_000;

let mattersCache: { at: number; base: string; rows: MatterOption[] } | null = null;
/** `${apiBase}|${matterId}|${subfolder}` → folder id */
const folderCache = new Map<string, string>();

function baseUrl(): string {
  return getSettings().apiBase.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
  const token = readHubAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const root = baseUrl();
  if (!root)
    throw new Error('Укажите URL API файлового менеджера');
  const response = await fetch(`${root}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    credentials: 'include',
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === 'string' && body.detail)
        detail = body.detail;
    } catch {
      /* ignore */
    }
    if (response.status === 401)
      throw new ApiError('Сессия Hub истекла — войдите снова', 401);
    throw new ApiError(detail, response.status);
  }
  return await response.json() as T;
}

export function mapClientsToMatters(data: ClientsResponse): MatterOption[] {
  return (data.clients ?? []).flatMap((client) => (client.matters ?? [])
    .filter((matter) => matter.level !== 'none' && matter.level !== 'read')
    .map((matter) => ({
      id: matter.id,
      name: matter.name,
      code: matter.code,
      clientId: client.id,
      clientName: client.name,
      closed: matter.closed,
    })))
    .sort((a, b) => a.clientName.localeCompare(b.clientName, 'ru') || a.name.localeCompare(b.name, 'ru'));
}

export async function listMatters(options: { force?: boolean } = {}): Promise<MatterOption[]> {
  const base = baseUrl();
  if (!options.force && mattersCache && mattersCache.base === base && Date.now() - mattersCache.at < MATTERS_TTL_MS)
    return mattersCache.rows;
  const rows = mapClientsToMatters(await request<ClientsResponse>('/clients'));
  mattersCache = { at: Date.now(), base, rows };
  return rows;
}

async function browse(matterId: string, folderId: string | null = null): Promise<BrowseResponse> {
  const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
  return request<BrowseResponse>(`/matters/${encodeURIComponent(matterId)}/browse${qs}`);
}

async function createFolder(matterId: string, name: string, parentId: string | null): Promise<{ id: string }> {
  return request<{ id: string }>(`/matters/${encodeURIComponent(matterId)}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
}

async function findOrCreateFolder(matterId: string, name: string, parentId: string | null): Promise<string> {
  const listing = await browse(matterId, parentId);
  const existing = listing.folders.find((folder) => folder.name.toLowerCase() === name.toLowerCase());
  if (existing)
    return existing.id;
  return (await createFolder(matterId, name, parentId)).id;
}

/** `Correspondence/<subfolder>` inside a matter, created on demand and cached per matter. */
async function ensureCorrespondenceFolder(matterId: string, subfolder: 'Emails' | 'Documents'): Promise<string> {
  const key = `${baseUrl()}|${matterId}|${subfolder}`;
  const cached = folderCache.get(key);
  if (cached)
    return cached;
  const correspondenceId = await findOrCreateFolder(matterId, 'Correspondence', null);
  const id = await findOrCreateFolder(matterId, subfolder, correspondenceId);
  folderCache.set(key, id);
  return id;
}

export function ensureEmailsFolder(matterId: string): Promise<string> {
  return ensureCorrespondenceFolder(matterId, 'Emails');
}

/** Correspondence/Documents for Word / Excel / PowerPoint uploads. */
export function ensureDocumentsFolder(matterId: string): Promise<string> {
  return ensureCorrespondenceFolder(matterId, 'Documents');
}

export type UploadedDocument = {
  id: string;
  name?: string;
};

function uploadRequest(matterId: string, folderId: string, file: File, comment: string) {
  const body = new FormData();
  body.append('files', file);
  body.append('folderId', folderId);
  if (comment)
    body.append('comment', comment);
  return request<{ documents: UploadedDocument[] }>(
    `/matters/${encodeURIComponent(matterId)}/documents`,
    { method: 'POST', body },
  );
}

/**
 * Upload into `Correspondence/<subfolder>`. If the cached folder was deleted meanwhile (404),
 * drop the cache, recreate the folder and retry once.
 */
export async function uploadToCorrespondence(
  matterId: string,
  subfolder: 'Emails' | 'Documents',
  file: File,
  comment = '',
): Promise<UploadedDocument[]> {
  let folderId = await ensureCorrespondenceFolder(matterId, subfolder);
  let data: { documents: UploadedDocument[] };
  try {
    data = await uploadRequest(matterId, folderId, file, comment);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404)
      throw error;
    folderCache.delete(`${baseUrl()}|${matterId}|${subfolder}`);
    folderId = await ensureCorrespondenceFolder(matterId, subfolder);
    data = await uploadRequest(matterId, folderId, file, comment);
  }
  return Array.isArray(data.documents) ? data.documents : [];
}

/** Upload a new version into an existing FM document (thread update). */
export async function checkinDocument(documentId: string, file: File, comment = ''): Promise<void> {
  const body = new FormData();
  body.append('file', file);
  if (comment)
    body.append('comment', comment);
  try {
    await request<{ document: unknown }>(`/documents/${encodeURIComponent(documentId)}/checkout`, {
      method: 'POST',
    });
  } catch {
    /* may already be checked out by us / optional */
  }
  await request<{ document: unknown }>(`/documents/${encodeURIComponent(documentId)}/checkin`, {
    method: 'POST',
    body,
  });
}

export async function pingApi(): Promise<string> {
  const data = await request<{ clients?: unknown[] }>('/clients');
  const count = Array.isArray(data.clients) ? data.clients.length : 0;
  return `OK · клиентов: ${count}`;
}

export function clearApiCaches(): void {
  mattersCache = null;
  folderCache.clear();
}
