import { ensureAccessToken, refreshAccessToken } from './auth/authApi';
import { getDeviceId } from './auth/session';
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

function baseUrl(): string {
  return getSettings().apiBase.replace(/\/+$/, '');
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await ensureAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'X-Outlook-Device-Id': getDeviceId(),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const root = baseUrl();
  if (!root)
    throw new Error('Укажите URL API файлового менеджера (например https://hub.example.com/api/v1/files)');
  const headers = {
    ...(await authHeaders()),
    ...(init?.headers ?? {}),
  };
  let response = await fetch(`${root}${path}`, { ...init, headers });
  if (response.status === 401) {
    await refreshAccessToken();
    response = await fetch(`${root}${path}`, {
      ...init,
      headers: { ...(await authHeaders()), ...(init?.headers ?? {}) },
    });
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail)
        detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return await response.json() as T;
}

export async function listMatters(): Promise<MatterOption[]> {
  const data = await request<ClientsResponse>('/clients');
  return data.clients.flatMap((client) => client.matters
    .filter((matter) => matter.level !== 'none' && matter.level !== 'read')
    .map((matter) => ({
      id: matter.id,
      name: matter.name,
      code: matter.code,
      clientId: client.id,
      clientName: client.name,
      closed: matter.closed,
    })))
    .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name));
}

export async function browse(matterId: string, folderId: string | null = null): Promise<BrowseResponse> {
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

export async function ensureEmailsFolder(matterId: string): Promise<string | null> {
  const root = await browse(matterId, null);
  let correspondence = root.folders.find((folder) => folder.name.toLowerCase() === 'correspondence');
  if (!correspondence) {
    const created = await createFolder(matterId, 'Correspondence', null);
    correspondence = { id: created.id, parentId: null, name: 'Correspondence' };
  }
  const inside = await browse(matterId, correspondence.id);
  let emails = inside.folders.find((folder) => folder.name.toLowerCase() === 'emails');
  if (!emails) {
    const created = await createFolder(matterId, 'Emails', correspondence.id);
    emails = { id: created.id, parentId: correspondence.id, name: 'Emails' };
  }
  return emails.id;
}

export async function uploadToMatter(matterId: string, folderId: string | null, file: File, comment = ''): Promise<void> {
  const body = new FormData();
  body.append('files', file);
  if (folderId)
    body.append('folderId', folderId);
  if (comment)
    body.append('comment', comment);
  await request<{ documents: unknown[] }>(`/matters/${encodeURIComponent(matterId)}/documents`, {
    method: 'POST',
    body,
  });
}

export async function pingApi(): Promise<string> {
  const data = await request<{ clients?: unknown[] }>('/clients');
  const count = Array.isArray(data.clients) ? data.clients.length : 0;
  return `OK · клиентов: ${count}`;
}
