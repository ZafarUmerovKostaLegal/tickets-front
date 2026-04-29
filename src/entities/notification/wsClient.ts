import { getAccessToken } from '@shared/lib';
import { getNotificationsWsUrl, useSessionCookieOnly } from '@shared/config';
const RECONNECT_DELAY_MIN = 1000;
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_BACKOFF = 1.5;
const PENDING_TIMEOUT_MS = 30000;
const READY_CHECK_INTERVAL_MS = 50;
const MAX_RECONNECT_ATTEMPTS = 20;
type PendingEntry = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
};
function generateRequestId(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
function isNonEmptyString(val: unknown): val is string {
    return typeof val === 'string' && val.trim().length > 0;
}
function safeJsonParse<T = unknown>(data: string): T | null {
    try {
        return JSON.parse(data) as T;
    }
    catch {
        return null;
    }
}
export class NotificationsWSClient {
    private ws: WebSocket | null = null;
    private readonly pending = new Map<string, PendingEntry>();
    private readonly getToken: () => string | null;
    private isConnecting = false;
    private reconnectAttempts = 0;
    private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
    constructor(getToken: () => string | null = getAccessToken) {
        this.getToken = getToken;
        this.connect();
    }
    private getWsUrl(): string {
        const url = getNotificationsWsUrl();
        if (!url)
            throw new Error('WebSocket URL недоступен (нет window / origin)');
        return url;
    }
    private clearReconnectTimer(): void {
        if (this.reconnectTimerId != null) {
            clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
    }
    private rejectAllPending(reason: Error): void {
        for (const [, entry] of this.pending) {
            clearTimeout(entry.timeoutId);
            entry.reject(reason);
        }
        this.pending.clear();
    }
    private scheduleReconnect(): void {
        this.clearReconnectTimer();
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS)
            return;
        const delay = Math.min(RECONNECT_DELAY_MIN * Math.pow(RECONNECT_BACKOFF, this.reconnectAttempts), RECONNECT_DELAY_MAX);
        this.reconnectAttempts += 1;
        this.reconnectTimerId = setTimeout(() => {
            this.reconnectTimerId = null;
            this.connect();
        }, delay);
    }
    private connect(): void {
        if (this.isConnecting)
            return;
        let url: string;
        try {
            url = this.getWsUrl();
        }
        catch (err) {
            this.rejectAllPending(err instanceof Error ? err : new Error(String(err)));
            return;
        }
        this.isConnecting = true;
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
            this.isConnecting = false;
            this.reconnectAttempts = 0;
        };
        this.ws.onmessage = (event: MessageEvent) => {
            const raw = typeof event.data === 'string' ? event.data : '';
            const data = safeJsonParse<{
                request_id?: unknown;
                result?: unknown;
                error?: unknown;
            }>(raw);
            if (!data || !isNonEmptyString(data.request_id))
                return;
            const entry = this.pending.get(data.request_id);
            if (!entry)
                return;
            this.pending.delete(data.request_id);
            clearTimeout(entry.timeoutId);
            if (data.error != null) {
                const msg = typeof data.error === 'string' ? data.error : String(data.error);
                entry.reject(new Error(msg));
            }
            else {
                entry.resolve(data.result);
            }
        };
        this.ws.onclose = () => {
            this.isConnecting = false;
            this.ws = null;
            this.rejectAllPending(new Error('WebSocket closed'));
            this.scheduleReconnect();
        };
        this.ws.onerror = () => {
            this.isConnecting = false;
        };
    }
    private ensureOpen(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                this.connect();
            }
            if (!this.ws) {
                reject(new Error('WebSocket not available'));
                return;
            }
            if (this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }
            const check = (): void => {
                if (!this.ws) {
                    reject(new Error('WebSocket not available'));
                }
                else if (this.ws.readyState === WebSocket.OPEN) {
                    resolve();
                }
                else if (this.ws.readyState === WebSocket.CLOSED) {
                    reject(new Error('WebSocket closed'));
                }
                else {
                    setTimeout(check, READY_CHECK_INTERVAL_MS);
                }
            };
            check();
        });
    }
    send(action: string, payload: Record<string, unknown> = {}): Promise<unknown> {
        const sessionOnly = useSessionCookieOnly();
        const token = this.getToken();
        if (!sessionOnly && !token?.trim()) {
            return Promise.reject(new Error('No access token'));
        }
        const actionStr = typeof action === 'string' ? action.trim() : '';
        if (!actionStr) {
            return Promise.reject(new Error('Action is required'));
        }
        const requestId = generateRequestId();
        const message = {
            action: actionStr,
            payload: payload && typeof payload === 'object' ? payload : {},
            request_id: requestId,
            token: sessionOnly ? '' : `Bearer ${token!.trim()}`,
        };
        return this.ensureOpen().then(() => new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (this.pending.delete(requestId)) {
                    reject(new Error('Request timeout'));
                }
            }, PENDING_TIMEOUT_MS);
            this.pending.set(requestId, { resolve, reject, timeoutId });
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
            }
            else {
                clearTimeout(timeoutId);
                this.pending.delete(requestId);
                reject(new Error('WebSocket not open'));
            }
        }));
    }
    close(): void {
        this.clearReconnectTimer();
        this.rejectAllPending(new Error('Client closed'));
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnecting = false;
    }
}
export type NotificationItem = {
    id: number;
    uuid: string;
    title: string;
    description: string;
    photo_path?: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
};
let singleton: NotificationsWSClient | null = null;
export function getNotificationsClient(): NotificationsWSClient {
    if (!singleton)
        singleton = new NotificationsWSClient();
    return singleton;
}
export function resetNotificationsClient(): void {
    if (singleton) {
        singleton.close();
        singleton = null;
    }
}
export type ListNotificationsParams = {
    skip?: number;
    limit?: number;
    include_archived?: boolean;
};
const DEFAULT_SKIP = 0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
function clampNum(val: unknown, min: number, max: number, fallback: number): number {
    if (typeof val !== 'number' || !Number.isFinite(val))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(val)));
}
export async function listNotifications(params: ListNotificationsParams = {}): Promise<NotificationItem[]> {
    const client = getNotificationsClient();
    const payload = {
        skip: clampNum(params.skip, 0, Number.MAX_SAFE_INTEGER, DEFAULT_SKIP),
        limit: clampNum(params.limit, 1, MAX_LIMIT, DEFAULT_LIMIT),
        include_archived: Boolean(params.include_archived),
    };
    const result = await client.send('list_notifications', payload);
    return Array.isArray(result) ? (result as NotificationItem[]) : [];
}
export async function getNotification(uuid: string): Promise<NotificationItem> {
    if (!isNonEmptyString(uuid))
        throw new Error('UUID is required');
    const client = getNotificationsClient();
    const result = await client.send('get_notification', { notification_uuid: uuid });
    if (!result || typeof result !== 'object')
        throw new Error('Invalid response');
    return result as NotificationItem;
}
export type CreateNotificationPayload = {
    title: string;
    description: string;
    photo_path?: string | null;
};
export async function createNotification(payload: CreateNotificationPayload): Promise<NotificationItem> {
    if (!payload || typeof payload !== 'object')
        throw new Error('Payload is required');
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    if (!title)
        throw new Error('Title is required');
    const client = getNotificationsClient();
    const result = await client.send('create_notification', {
        title,
        description,
        photo_path: payload.photo_path ?? null,
    });
    if (!result || typeof result !== 'object')
        throw new Error('Invalid response');
    return result as NotificationItem;
}
export type UpdateNotificationPayload = {
    uuid: string;
    title?: string;
    description?: string;
    photo_path?: string | null;
};
export async function updateNotification(payload: UpdateNotificationPayload): Promise<NotificationItem> {
    if (!payload || typeof payload !== 'object')
        throw new Error('Payload is required');
    if (!isNonEmptyString(payload.uuid))
        throw new Error('UUID is required');
    const client = getNotificationsClient();
    const result = await client.send('update_notification', {
        notification_uuid: payload.uuid,
        title: payload.title != null ? String(payload.title).trim() : undefined,
        description: payload.description != null ? String(payload.description).trim() : undefined,
        photo_path: payload.photo_path ?? null,
    });
    if (!result || typeof result !== 'object')
        throw new Error('Invalid response');
    return result as NotificationItem;
}
export async function archiveNotification(uuid: string, isArchived = true): Promise<NotificationItem> {
    if (!isNonEmptyString(uuid))
        throw new Error('UUID is required');
    const client = getNotificationsClient();
    const result = await client.send('archive_notification', {
        notification_uuid: uuid,
        is_archived: Boolean(isArchived),
    });
    if (!result || typeof result !== 'object')
        throw new Error('Invalid response');
    return result as NotificationItem;
}
export async function deleteNotification(uuid: string): Promise<boolean> {
    if (!isNonEmptyString(uuid))
        throw new Error('UUID is required');
    const client = getNotificationsClient();
    const result = await client.send('delete_notification', { notification_uuid: uuid });
    const obj = result as {
        deleted?: unknown;
    } | null;
    return Boolean(obj?.deleted);
}
