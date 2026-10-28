import { getAccessToken } from '@shared/lib/auth';
import { getChatWsUrl, isSessionCookieOnly } from '@shared/config';
import { invalidateApiGetReuse } from '@shared/api';
import { invalidateChatRoomsCache, parseChatReactions } from './api';
const listeners = new Set();
export function subscribeChatWs(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
}
function emit(event) {
    if (event.type !== 'connected' && event.type !== 'pong' && event.type !== 'error') {
        invalidateApiGetReuse();
        invalidateChatRoomsCache();
    }
    for (const h of [...listeners]) {
        try {
            h(event);
        }
        catch {
        }
    }
}
const RECONNECT_DELAY_MIN = 1000;
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_BACKOFF = 1.5;
const MAX_RECONNECT_ATTEMPTS = 20;
const PING_INTERVAL_MS = 45000;
let ws = null;
let reconnectAttempts = 0;
let reconnectTimerId = null;
let pingTimerId = null;
let isConnecting = false;
let subscribers = 0;
function getWsUrl() {
    const url = getChatWsUrl();
    if (!url)
        throw new Error('WebSocket URL недоступен');
    if (!isSessionCookieOnly()) {
        const t = (getAccessToken() || '').replace(/^Bearer\s+/i, '').trim();
        if (t) {
            const sep = url.includes('?') ? '&' : '?';
            return `${url}${sep}token=${encodeURIComponent(t)}`;
        }
    }
    return url;
}
function clearReconnectTimer() {
    if (reconnectTimerId != null) {
        clearTimeout(reconnectTimerId);
        reconnectTimerId = null;
    }
}
function clearPingTimer() {
    if (pingTimerId != null) {
        clearInterval(pingTimerId);
        pingTimerId = null;
    }
}
function scheduleReconnect() {
    clearReconnectTimer();
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS)
        return;
    const delay = Math.min(RECONNECT_DELAY_MIN * Math.pow(RECONNECT_BACKOFF, reconnectAttempts), RECONNECT_DELAY_MAX);
    reconnectAttempts += 1;
    reconnectTimerId = setTimeout(() => {
        reconnectTimerId = null;
        connect();
    }, delay);
}
function parseEvent(data) {
    const type = typeof data.type === 'string' ? data.type : '';
    if (type === 'connected') {
        const uid = data.user_id ?? data.userId;
        const user_id = typeof uid === 'number' ? uid : Number(uid);
        if (Number.isFinite(user_id))
            return { type: 'connected', user_id };
        return null;
    }
    if (type === 'pong')
        return { type: 'pong' };
    if (type === 'error') {
        return { type: 'error', error: typeof data.error === 'string' ? data.error : undefined };
    }
    const roomRaw = data.room_id ?? data.roomId;
    const room_id = typeof roomRaw === 'number' ? roomRaw : Number(roomRaw);
    if (!Number.isFinite(room_id))
        return null;
    const payload = data.payload;
    if (type === 'message' || type === 'message_edited' || type === 'message_deleted' || type === 'members_added' || type === 'members_removed') {
        return { type, room_id, payload };
    }
    if (type === 'reaction') {
        const p = data.payload;
        const msgIdRaw = p?.messageId ?? p?.message_id;
        const messageId = typeof msgIdRaw === 'number' ? msgIdRaw : Number(msgIdRaw);
        if (!Number.isFinite(messageId))
            return null;
        const reactions = parseChatReactions(Array.isArray(p?.reactions) ? p.reactions : []);
        return { type: 'reaction', room_id, messageId, reactions };
    }
    if (type === 'poll_vote' || type === 'poll_closed' || type === 'room_created' || type === 'room_updated' || type === 'room_deleted' || type === 'pins_updated') {
        return { type, room_id, payload };
    }
    return null;
}
function connect() {
    if (isConnecting || typeof window === 'undefined')
        return;
    const sessionOnly = isSessionCookieOnly();
    const token = getAccessToken()?.trim();
    if (!sessionOnly && !token)
        return;
    let url;
    try {
        url = getWsUrl();
    }
    catch {
        return;
    }
    isConnecting = true;
    ws = new WebSocket(url);
    ws.onopen = () => {
        isConnecting = false;
        reconnectAttempts = 0;
        clearPingTimer();
        pingTimerId = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
                catch {
                }
            }
        }, PING_INTERVAL_MS);
    };
    ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        try {
            const data = JSON.parse(raw);
            const parsed = parseEvent(data);
            if (parsed)
                emit(parsed);
        }
        catch {
        }
    };
    ws.onclose = () => {
        isConnecting = false;
        ws = null;
        clearPingTimer();
        scheduleReconnect();
    };
    ws.onerror = () => {
        isConnecting = false;
    };
}
function disconnect() {
    clearReconnectTimer();
    clearPingTimer();
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
    if (ws) {
        try {
            ws.close();
        }
        catch {
        }
        ws = null;
    }
    isConnecting = false;
}
export function connectChatWs() {
    subscribers += 1;
    if (subscribers === 1)
        connect();
    return () => {
        subscribers = Math.max(0, subscribers - 1);
        if (subscribers === 0)
            disconnect();
    };
}
export { parseChatMessageFromWsPayload } from './api';
