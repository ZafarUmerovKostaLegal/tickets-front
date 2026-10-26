import { apiFetch } from '@shared/api/client';
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

export async function downloadFileGuardEvent(eventId: string, fileName: string): Promise<void> {
    const response = await apiFetch(fileGuardEventFilePath(eventId));
    if (!response.ok)
        throw new Error('Файл не удалось скачать');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'file';
    link.click();
    URL.revokeObjectURL(url);
}
