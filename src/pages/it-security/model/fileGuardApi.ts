import { apiFetch } from '@shared/api/client';
import { downloadBlob } from '@shared/lib/downloadBlob';
import type { JournalChannel, JournalEvent, JournalKind, JournalStatus, JournalUser } from './journalDemo';

type FileGuardEventDto = {
    id?: string;
    host?: string;
    windowsUser?: string;
    occurredAt?: string;
    process?: string;
    resource?: string;
    filePath?: string;
    fileName?: string;
    kind?: string;
    status?: string;
    channel?: string;
    note?: string;
    hasFile?: boolean;
};

const KINDS = new Set<JournalKind>(['send', 'clip', 'copy', 'edit', 'new', 'open', 'access']);
const STATUSES = new Set<JournalStatus>(['blocked', 'allowed', 'logged']);
const CHANNELS = new Set<JournalChannel>(['telegram', 'browser', 'clip', 'net', 'fs']);

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function asKind(value: string | undefined): JournalKind {
    return value && KINDS.has(value as JournalKind) ? value as JournalKind : 'send';
}

function asStatus(value: string | undefined): JournalStatus {
    return value && STATUSES.has(value as JournalStatus) ? value as JournalStatus : 'blocked';
}

function asChannel(value: string | undefined, process: string, kind: JournalKind): JournalChannel {
    if (value && CHANNELS.has(value as JournalChannel))
        return value as JournalChannel;
    if (kind === 'clip')
        return 'clip';
    const name = process.toLowerCase();
    if (name.includes('telegram'))
        return 'telegram';
    if (name.includes('chrome') || name.includes('msedge') || name.includes('firefox') || name.includes('opera'))
        return 'browser';
    return 'fs';
}

function folderOf(filePath: string, fileName: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const slash = normalized.lastIndexOf('/');
    if (slash <= 0)
        return filePath;
    const parent = filePath.slice(0, filePath.length - (normalized.length - slash));
    return parent || fileName;
}

export function mapFileGuardEvents(items: FileGuardEventDto[]): { events: JournalEvent[]; users: JournalUser[] } {
    const users = new Map<string, JournalUser>();
    const events = items.flatMap((item) => {
        const id = (item.id ?? '').trim();
        if (!id)
            return [];
        const windowsUser = (item.windowsUser ?? '').trim() || 'unknown';
        const host = (item.host ?? '').trim();
        const login = windowsUser.includes('\\') ? windowsUser.slice(windowsUser.lastIndexOf('\\') + 1) : windowsUser;
        const userId = `${host}|${windowsUser}`;
        if (!users.has(userId))
            users.set(userId, { id: userId, login, host, dept: '' });
        const occurred = item.occurredAt ? new Date(item.occurredAt) : null;
        const valid = occurred != null && !Number.isNaN(occurred.getTime());
        const kind = asKind(item.kind);
        const process = (item.process ?? '').trim();
        const fileName = (item.fileName ?? '').trim() || 'файл';
        const filePath = (item.filePath ?? '').trim();
        return [{
            id,
            d: valid ? `${pad(occurred.getDate())}.${pad(occurred.getMonth() + 1)}.${occurred.getFullYear()}` : '',
            t: valid ? `${pad(occurred.getHours())}:${pad(occurred.getMinutes())}:${pad(occurred.getSeconds())}` : '',
            kind,
            status: asStatus(item.status),
            ch: asChannel(item.channel, process, kind),
            name: fileName,
            dir: folderOf(filePath, fileName),
            proc: process,
            res: (item.resource ?? '').trim(),
            note: (item.note ?? '').trim(),
            u: userId,
            hasFile: Boolean(item.hasFile),
        }];
    });
    return { events, users: [...users.values()] };
}

export async function fetchFileGuardEvents(): Promise<{ events: JournalEvent[]; users: JournalUser[] }> {
    const response = await apiFetch('/api/v1/file-guard/events?limit=500');
    if (!response.ok)
        throw new Error(response.status === 403 ? 'Нет доступа к журналу' : 'Журнал защиты файлов недоступен');
    const body = await response.json() as { items?: FileGuardEventDto[] };
    return mapFileGuardEvents(Array.isArray(body.items) ? body.items : []);
}

export function fileGuardEventFilePath(eventId: string): string {
    return `/api/v1/file-guard/events/${encodeURIComponent(eventId)}/file`;
}

export type FileGuardPolicy = {
    id: string;
    host: string;
    windowsUser: string;
    dailyLimitMb: number | null;
    removed?: boolean;
};

export function policyScope(userId: string): { host: string; windowsUser: string } {
    if (!userId || userId === 'all')
        return { host: '*', windowsUser: '*' };
    const split = userId.indexOf('|');
    if (split < 0)
        return { host: '*', windowsUser: userId };
    return { host: userId.slice(0, split) || '*', windowsUser: userId.slice(split + 1) || '*' };
}

export function matchingPolicy(items: FileGuardPolicy[], host: string, windowsUser: string): FileGuardPolicy | null {
    return items.find((item) => item.host === host && item.windowsUser === windowsUser) ?? null;
}

export async function fetchFileGuardPolicies(): Promise<FileGuardPolicy[]> {
    const response = await apiFetch('/api/v1/file-guard/policies');
    if (!response.ok)
        throw new Error('Не удалось загрузить лимиты отправки');
    const body = await response.json() as { items?: FileGuardPolicy[] };
    return Array.isArray(body.items) ? body.items : [];
}

export async function saveFileGuardPolicy(host: string, windowsUser: string, dailyLimitMb: number | null): Promise<FileGuardPolicy> {
    const response = await apiFetch('/api/v1/file-guard/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, windowsUser, dailyLimitMb }),
    });
    if (!response.ok)
        throw new Error(response.status === 403 ? 'Нет доступа к лимиту отправки' : 'Лимит не удалось сохранить');
    return await response.json() as FileGuardPolicy;
}

const PREVIEW_TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    txt: 'text/plain',
    csv: 'text/csv',
    log: 'text/plain',
    md: 'text/plain',
    json: 'text/plain',
    xml: 'text/plain',
    html: 'text/plain',
    htm: 'text/plain',
    rdp: 'text/plain',
    sql: 'text/plain',
    ini: 'text/plain',
    cfg: 'text/plain',
    yml: 'text/plain',
    yaml: 'text/plain',
};

export function fileGuardPreviewType(fileName: string, contentType: string | null): string {
    const raw = (contentType ?? '').split(';')[0].trim().toLowerCase();
    if (raw && raw !== 'application/octet-stream')
        return raw;
    const dot = fileName.lastIndexOf('.');
    const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
    return PREVIEW_TYPES[ext] ?? 'application/octet-stream';
}

export function fileGuardPreviewBlob(blob: Blob, fileName: string, contentType: string | null): Blob {
    const type = fileGuardPreviewType(fileName, contentType);
    if (!type || blob.type === type)
        return blob;
    return blob.slice(0, blob.size, type);
}

export async function fetchFileGuardEventFile(eventId: string): Promise<{ blob: Blob; contentType: string | null }> {
    const response = await apiFetch(fileGuardEventFilePath(eventId));
    if (!response.ok)
        throw new Error(response.status === 404 ? 'Файл не сохранён' : 'Файл не удалось открыть');
    return { blob: await response.blob(), contentType: response.headers.get('Content-Type') };
}

export async function downloadFileGuardEvent(eventId: string, fileName: string): Promise<void> {
    const { blob, contentType } = await fetchFileGuardEventFile(eventId);
    downloadBlob(fileGuardPreviewBlob(blob, fileName, contentType), fileName || 'file');
}
