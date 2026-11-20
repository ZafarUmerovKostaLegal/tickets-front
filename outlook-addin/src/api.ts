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

export type DocRow = {
  id: string;
  docNumber: string;
  name: string;
  kind: string;
  version: number;
  sizeBytes: number;
  folderId: string | null;
  matterId: string;
  matterName: string;
  matterCode: string;
  clientId: string;
  clientName: string;
  updatedAt: string | null;
  updatedBy: string;
  checkedOutBy: string | null;
};

export type BrowseFolder = FolderRow & { documents: number; favorite?: boolean };

export type BrowseResponse = {
  matter: { id: string; name: string; code: string; closed: boolean; level: string; favorite?: boolean };
  client: { id: string; name: string };
  folderId: string | null;
  folders: BrowseFolder[];
  documents: DocRow[];
};

export type Crumb = { id: string; name: string };

/** A place in FM: the matter root (folderId null) or a folder inside it. */
export type Location = {
  matterId: string;
  matterName: string;
  matterCode: string;
  clientId: string;
  clientName: string;
  folderId: string | null;
  folderPath: Crumb[];
};

export type FilingKind = 'email' | 'attachment' | 'thread';

export type Filing = Location & {
  messageId: string;
  conversationId: string;
  sameMessage: boolean;
  kind: FilingKind;
  documentId: string;
  documentName: string;
  version: number;
  filedBy: string;
  filedAt: string | null;
};

export type SuggestionReason = 'conversation' | 'sender' | 'domain' | 'recent';

export type Suggestion = Location & {
  reason: SuggestionReason;
  count: number;
  lastFiledAt: string | null;
};

export type ClientNode = {
  id: string;
  name: string;
  archived: boolean;
  favorite: boolean;
  matters: Array<{
    id: string;
    name: string;
    code: string;
    closed: boolean;
    level: string;
    /** Viewer is on the matter's team (time tracking) or has explicit access — not just a manager. */
    mine?: boolean;
    favorite: boolean;
    documents: number;
  }>;
};

/** Sent with an upload so the server remembers where this message was filed. */
export type MailLink = {
  messageId: string;
  conversationId: string;
  fromEmail: string;
  subject: string;
  kind: FilingKind;
};

type ClientsResponse = {
  clients: ClientNode[];
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
let clientsCache: { at: number; base: string; rows: ClientNode[] } | null = null;
/** `${apiBase}|${matterId}|${subfolder}` → folder id */
const folderCache = new Map<string, string>();

function baseUrl(): string {
  return getSettings().apiBase.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
  const token = readHubAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Re-authenticates silently after a 401 (set by the UI); resolves true when a retry makes sense. */
let unauthorizedHandler: (() => Promise<boolean>) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<boolean>) | null): void {
  unauthorizedHandler = handler;
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const root = baseUrl();
  if (!root)
    throw new Error('Укажите URL API файлового менеджера');
  const go = () => fetch(`${root}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    credentials: 'include',
  });
  let response = await go();
  if (response.status === 401 && unauthorizedHandler && await unauthorizedHandler())
    response = await go();
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
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

/** Clients → matters the viewer can see (cached; also refreshes the writable-matters list). */
export async function listClients(options: { force?: boolean } = {}): Promise<ClientNode[]> {
  const base = baseUrl();
  if (!options.force && clientsCache && clientsCache.base === base && Date.now() - clientsCache.at < MATTERS_TTL_MS)
    return clientsCache.rows;
  const data = await request<ClientsResponse>('/clients');
  const rows = data.clients ?? [];
  clientsCache = { at: Date.now(), base, rows };
  mattersCache = { at: Date.now(), base, rows: mapClientsToMatters(data) };
  return rows;
}

export async function listMatters(options: { force?: boolean } = {}): Promise<MatterOption[]> {
  const base = baseUrl();
  if (!options.force && mattersCache && mattersCache.base === base && Date.now() - mattersCache.at < MATTERS_TTL_MS)
    return mattersCache.rows;
  const rows = mapClientsToMatters(await request<ClientsResponse>('/clients'));
  mattersCache = { at: Date.now(), base, rows };
  return rows;
}

/** All folders of the matter plus the documents of `folderId` (matter root when null). */
export function browse(matterId: string, folderId: string | null = null): Promise<BrowseResponse> {
  const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
  return request<BrowseResponse>(`/matters/${encodeURIComponent(matterId)}/browse${qs}`);
}

export async function createFolder(matterId: string, name: string, parentId: string | null): Promise<{ id: string }> {
  return request<{ id: string }>(`/matters/${encodeURIComponent(matterId)}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
}

async function findOrCreateFolder(matterId: string, name: string, parentId: string | null): Promise<string> {
  const listing = await browse(matterId, parentId);
  const existing = listing.folders.find((folder) => (folder.parentId ?? null) === parentId && folder.name.toLowerCase() === name.toLowerCase());
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
  version?: number;
};

function uploadRequest(matterId: string, folderId: string | null, file: File, comment: string, mail?: MailLink) {
  const body = new FormData();
  body.append('files', file);
  if (folderId)
    body.append('folderId', folderId);
  if (comment)
    body.append('comment', comment);
  if (mail) {
    body.append('mailMessageId', mail.messageId);
    body.append('mailConversationId', mail.conversationId);
    body.append('mailFrom', mail.fromEmail);
    body.append('mailSubject', mail.subject.slice(0, 2000));
    body.append('mailKind', mail.kind);
  }
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
  mail?: MailLink,
): Promise<UploadedDocument[]> {
  let folderId = await ensureCorrespondenceFolder(matterId, subfolder);
  let data: { documents: UploadedDocument[] };
  try {
    data = await uploadRequest(matterId, folderId, file, comment, mail);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404)
      throw error;
    folderCache.delete(`${baseUrl()}|${matterId}|${subfolder}`);
    folderId = await ensureCorrespondenceFolder(matterId, subfolder);
    data = await uploadRequest(matterId, folderId, file, comment, mail);
  }
  return Array.isArray(data.documents) ? data.documents : [];
}

/** What the server did with the file: it keeps versions instead of piling up copies. */
export type UploadStatus = 'created' | 'version' | 'unchanged' | 'exists' | 'duplicate';

export type UploadOutcome = { status: UploadStatus; document: UploadedDocument };

/** Upload one file into an explicit folder (or the matter root). */
export async function uploadToFolder(
  matterId: string,
  folderId: string | null,
  file: File,
  comment = '',
  mail?: MailLink,
): Promise<UploadOutcome> {
  const data = await uploadRequest(matterId, folderId, file, comment, mail) as {
    documents: UploadedDocument[];
    results?: UploadOutcome[];
  };
  const result = data.results?.[0];
  if (result)
    return result;
  const document = data.documents?.[0];
  if (!document)
    throw new Error('Сервер не вернул документ');
  return { status: 'created', document };
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

export async function searchDocuments(q: string, matterId = ''): Promise<DocRow[]> {
  const qs = new URLSearchParams({ q });
  if (matterId)
    qs.set('matterId', matterId);
  const data = await request<{ documents: DocRow[] }>(`/search?${qs.toString()}`);
  return data.documents ?? [];
}

export async function recentDocuments(): Promise<DocRow[]> {
  return (await request<{ documents: DocRow[] }>('/recent')).documents ?? [];
}

export type Favorites = {
  matters: Array<{ id: string; name: string; code: string; clientId: string; clientName: string; level: string }>;
  folders: Array<{ id: string; name: string; matterId: string; matterName: string }>;
};

export async function listFavorites(): Promise<Favorites> {
  const data = await request<Partial<Favorites>>('/favorites');
  return { matters: data.matters ?? [], folders: data.folders ?? [] };
}

export async function setFavorite(kind: 'matter' | 'folder', targetId: string, matterId: string, on: boolean): Promise<void> {
  if (on) {
    await request('/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, targetId, matterId }),
    });
    return;
  }
  await request(`/favorites/${kind}/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
}

/** Where these messages (and their thread) were filed — only matters the viewer can read. */
export async function lookupFilings(messageIds: string[], conversationId = ''): Promise<Filing[]> {
  const data = await request<{ filings: Filing[] }>('/mail/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageIds: messageIds.slice(0, 100), conversationId }),
  });
  return data.filings ?? [];
}

/** Ranked filing locations: this thread → this sender → sender's company → my recent places. */
export async function filingSuggestions(fromEmail: string, conversationId = ''): Promise<Suggestion[]> {
  const qs = new URLSearchParams({ fromEmail, conversationId });
  return (await request<{ locations: Suggestion[] }>(`/mail/suggestions?${qs.toString()}`)).locations ?? [];
}

/** Raw document bytes (to attach a filed document to a draft). */
export async function documentContent(documentId: string): Promise<Blob> {
  const response = await send(`/documents/${encodeURIComponent(documentId)}/content`);
  if (!response.ok)
    throw new ApiError(response.status === 401 ? 'Сессия Hub истекла — войдите снова' : `HTTP ${response.status}`, response.status);
  return response.blob();
}

export async function pingApi(): Promise<string> {
  const data = await request<{ clients?: unknown[] }>('/clients');
  const count = Array.isArray(data.clients) ? data.clients.length : 0;
  return `OK · клиентов: ${count}`;
}

export function clearApiCaches(): void {
  mattersCache = null;
  clientsCache = null;
  folderCache.clear();
}
