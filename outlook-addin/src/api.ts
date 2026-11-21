import { readHubAccessToken } from './auth/session';
import { getSettings } from './settings';

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
    mine?: boolean;
    favorite: boolean;
    documents: number;
  }>;
};

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

const MATTERS_TTL_MS = 10 * 60_000;

let clientsCache: { at: number; base: string; rows: ClientNode[] } | null = null;
const folderCache = new Map<string, string>();

function baseUrl(): string {
  return getSettings().apiBase.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
  const token = readHubAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
    }
    if (response.status === 401)
      throw new ApiError('Сессия Hub истекла — войдите снова', 401);
    throw new ApiError(detail, response.status);
  }
  return await response.json() as T;
}

export async function listClients(options: { force?: boolean } = {}): Promise<ClientNode[]> {
  const base = baseUrl();
  if (!options.force && clientsCache && clientsCache.base === base && Date.now() - clientsCache.at < MATTERS_TTL_MS)
    return clientsCache.rows;
  const data = await request<ClientsResponse>('/clients');
  const rows = data.clients ?? [];
  clientsCache = { at: Date.now(), base, rows };
  return rows;
}

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

export async function ensureEmailsFolder(matterId: string): Promise<string> {
  const key = `${baseUrl()}|${matterId}|Emails`;
  const cached = folderCache.get(key);
  if (cached)
    return cached;
  const correspondenceId = await findOrCreateFolder(matterId, 'Correspondence', null);
  const id = await findOrCreateFolder(matterId, 'Emails', correspondenceId);
  folderCache.set(key, id);
  return id;
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

export type UploadStatus = 'created' | 'version' | 'unchanged' | 'exists' | 'duplicate';

export type UploadOutcome = { status: UploadStatus; document: UploadedDocument };

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

export async function lookupFilings(messageIds: string[], conversationId = ''): Promise<Filing[]> {
  const data = await request<{ filings: Filing[] }>('/mail/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageIds: messageIds.slice(0, 100), conversationId }),
  });
  return data.filings ?? [];
}

export async function filingSuggestions(fromEmail: string, conversationId = ''): Promise<Suggestion[]> {
  const qs = new URLSearchParams({ fromEmail, conversationId });
  return (await request<{ locations: Suggestion[] }>(`/mail/suggestions?${qs.toString()}`)).locations ?? [];
}

export async function documentContent(documentId: string): Promise<Blob> {
  const response = await send(`/documents/${encodeURIComponent(documentId)}/content`);
  if (!response.ok)
    throw new ApiError(response.status === 401 ? 'Сессия Hub истекла — войдите снова' : `HTTP ${response.status}`, response.status);
  return response.blob();
}

export function clearApiCaches(): void {
  clientsCache = null;
  folderCache.clear();
}

export type Heartbeat = {
  clientId: string;
  host: string;
  platform: string;
  officeVersion: string;
  addinVersion: string;
  authMethod: string;
  ssoStatus: string;
  ssoError: string;
};

export async function sendHeartbeat(body: Heartbeat): Promise<void> {
  await request<{ ok: boolean }>('/addin/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type MailRuleDto = {
  id: string;
  scope: 'personal' | 'shared';
  match: string;
  matterId: string;
  matterName: string;
  matterCode: string;
  clientId: string;
  clientName: string;
  folderId: string | null;
  folderPath: string;
  enabled: boolean;
  hits: number;
  canEdit: boolean;
};

export type MailboxDto = {
  email: string;
  enabled: boolean;
  filedTotal: number;
  lastRunAt: string | null;
  lastError: string | null;
};

export type MailRulesDto = { rules: MailRuleDto[]; mailbox: MailboxDto | null; canShare: boolean; serverReady: boolean };

export function listMailRules(): Promise<MailRulesDto> {
  return request<MailRulesDto>('/mail/rules');
}

export function createMailRule(body: { match: string; matterId: string; folderId: string | null }): Promise<{ rule: MailRuleDto }> {
  return request<{ rule: MailRuleDto }>('/mail/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, scope: 'personal' }),
  });
}

export function updateMailRule(id: string, patch: { enabled: boolean }): Promise<{ rule: MailRuleDto }> {
  return request<{ rule: MailRuleDto }>(`/mail/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function deleteMailRule(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/mail/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function setMailAutofile(enabled: boolean): Promise<{ mailbox: MailboxDto | null }> {
  return request<{ mailbox: MailboxDto | null }>('/mail/autofile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}
