import { getAccessToken } from '@shared/lib/auth';
import { getNotificationsWsUrl, isSessionCookieOnly } from '@shared/config';
import { invalidateApiGetReuse } from '@shared/api';
import { normalizeNotificationItem } from './normalize';
import { archiveNotificationRest, invalidateNotificationsListCache, listNotificationsRest } from './restApi';
export { normalizeNotificationItem, parseBoardTitleFromNotificationDescription, notificationTypeKey, TODO_NOTIFICATION_TYPES, } from './normalize';
const pushListeners = new Set();
export function subscribeNotificationPush(handler) {
    pushListeners.add(handler);
    return () => {
        pushListeners.delete(handler);
    };
}
function emitNotificationPush(item) {
    invalidateApiGetReuse();
    invalidateNotificationsListCache();
    for (const h of [...pushListeners]) {
        try {
            h(item);
        }
        catch {
        }
    }
}
function mapGatewayPushToItem(raw) {
    return normalizeNotificationItem(raw);
}
const RECONNECT_DELAY_MIN = 1000;
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_BACKOFF = 1.5;
const PENDING_TIMEOUT_MS = 30000;
const READY_CHECK_INTERVAL_MS = 50;
const MAX_RECONNECT_ATTEMPTS = 20;
function generateRequestId() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
function isNonEmptyString(val) {
    return typeof val === 'string' && val.trim().length > 0;
}
function safeJsonParse(data) {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
export class NotificationsWSClient {
    ws = null;
    pending = new Map();
    getToken;
    isConnecting = false;
    reconnectAttempts = 0;
    reconnectTimerId = null;
    constructor(getToken = getAccessToken) {
        this.getToken = getToken;
        this.connect();
    }
    getWsUrl() {
        const url = getNotificationsWsUrl();
        if (!url)
            throw new Error('WebSocket URL недоступен (нет window / origin)');
        if (!isSessionCookieOnly()) {
            const t = (this.getToken() || '').replace(/^Bearer\s+/i, '').trim();
            if (t) {
                const sep = url.includes('?') ? '&' : '?';
                return `${url}${sep}token=${encodeURIComponent(t)}`;
            }
        }
        return url;
    }
    clearReconnectTimer() {
        if (this.reconnectTimerId != null) {
            clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
    }
    rejectAllPending(reason) {
        for (const [, entry] of this.pending) {
            clearTimeout(entry.timeoutId);
            entry.reject(reason);
        }
        this.pending.clear();
    }
    scheduleReconnect() {
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
    connect() {
        if (this.isConnecting)
            return;
        let url;
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
        this.ws.onmessage = (event) => {
            const raw = typeof event.data === 'string' ? event.data : '';
            const data = safeJsonParse(raw);
            if (!data)
                return;
            if (data.type === 'notification' && data.notification != null && typeof data.notification === 'object') {
                const item = mapGatewayPushToItem(data.notification);
                if (item)
                    emitNotificationPush(item);
                return;
            }
            if (data.type === 'connected')
                return;
            if (!isNonEmptyString(data.request_id))
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
    ensureOpen() {
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
            const check = () => {
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
    send(action, payload = {}) {
        const sessionOnly = isSessionCookieOnly();
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
            token: sessionOnly ? '' : `Bearer ${token.trim()}`,
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
    close() {
        this.clearReconnectTimer();
        this.rejectAllPending(new Error('Client closed'));
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnecting = false;
    }
}
let singleton = null;
export function getNotificationsClient() {
    if (!singleton)
        singleton = new NotificationsWSClient();
    return singleton;
}
export function resetNotificationsClient() {
    if (singleton) {
        singleton.close();
        singleton = null;
    }
}
const DEFAULT_SKIP = 0;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
function clampNum(val, min, max, fallback) {
    if (typeof val !== 'number' || !Number.isFinite(val))
        return fallback;
    return Math.max(min, Math.min(max, Math.floor(val)));
}
export async function listNotifications(params = {}) {
    return listNotificationsRest({
        skip: clampNum(params.skip, 0, Number.MAX_SAFE_INTEGER, DEFAULT_SKIP),
        limit: clampNum(params.limit, 1, MAX_LIMIT, DEFAULT_LIMIT),
        include_archived: Boolean(params.include_archived),
    });
}
export async function getNotification(uuid) {
    if (!isNonEmptyString(uuid))
        throw new Error('UUID is required');
    const client = getNotificationsClient();
    const result = await client.send('get_notification', { notification_uuid: uuid });
    if (!result || typeof result !== 'object')
        throw new Error('Invalid response');
    return result;
}
export async function createNotification(payload) {
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
    invalidateNotificationsListCache();
    return result;
}
export async function updateNotification(payload) {
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
    invalidateNotificationsListCache();
    return result;
}
export async function archiveNotification(uuid, isArchived = true) {
    return archiveNotificationRest(uuid, isArchived);
}
export async function deleteNotification(uuid) {
    if (!isNonEmptyString(uuid))
        throw new Error('UUID is required');
    const client = getNotificationsClient();
    const result = await client.send('delete_notification', { notification_uuid: uuid });
    const obj = result;
    const deleted = Boolean(obj?.deleted);
    if (deleted)
        invalidateNotificationsListCache();
    return deleted;
}
