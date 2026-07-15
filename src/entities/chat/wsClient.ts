import { getAccessToken } from '@shared/lib/auth';
import { getChatWsUrl, isSessionCookieOnly } from '@shared/config';
import { parseChatReactions } from './api';
import type { ChatReaction } from './types';

export type ChatWsPayload = {
    room_id: number;
    payload?: {
        message?: Record<string, unknown>;
        added_user_ids?: number[];
        room_id?: number;
        messageId?: number;
        reactions?: unknown[];
    };
};

export type ChatWsEvent =
    | { type: 'connected'; user_id: number }
    | { type: 'message'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'message_edited'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'message_deleted'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'members_added'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'reaction'; room_id: number; messageId: number; reactions: ChatReaction[] }
    | { type: 'poll_vote'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'poll_closed'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'room_created'; room_id: number; payload: ChatWsPayload['payload'] }
    | { type: 'pong' }
    | { type: 'error'; error?: string };

const listeners = new Set<(event: ChatWsEvent) => void>();

export function subscribeChatWs(handler: (event: ChatWsEvent) => void): () => void {
    listeners.add(handler);
    return () => listeners.delete(handler);
}

function emit(event: ChatWsEvent): void {
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

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
let pingTimerId: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;
let subscribers = 0;

function getWsUrl(): string {
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

function clearReconnectTimer(): void {
    if (reconnectTimerId != null) {
        clearTimeout(reconnectTimerId);
        reconnectTimerId = null;
    }
}

function clearPingTimer(): void {
    if (pingTimerId != null) {
        clearInterval(pingTimerId);
        pingTimerId = null;
    }
}

function scheduleReconnect(): void {
    clearReconnectTimer();
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS)
        return;
    const delay = Math.min(
        RECONNECT_DELAY_MIN * Math.pow(RECONNECT_BACKOFF, reconnectAttempts),
        RECONNECT_DELAY_MAX,
    );
    reconnectAttempts += 1;
    reconnectTimerId = setTimeout(() => {
        reconnectTimerId = null;
        connect();
    }, delay);
}

function parseEvent(data: Record<string, unknown>): ChatWsEvent | null {
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
    const payload = data.payload as ChatWsPayload['payload'] | undefined;
    if (type === 'message' || type === 'message_edited' || type === 'message_deleted' || type === 'members_added') {
        return { type, room_id, payload } as ChatWsEvent;
    }
    if (type === 'reaction') {
        const p = data.payload as Record<string, unknown> | undefined;
        const msgIdRaw = p?.messageId ?? p?.message_id;
        const messageId = typeof msgIdRaw === 'number' ? msgIdRaw : Number(msgIdRaw);
        if (!Number.isFinite(messageId))
            return null;
        const reactions = parseChatReactions(Array.isArray(p?.reactions) ? p.reactions : []);
        return { type: 'reaction', room_id, messageId, reactions };
    }
    if (type === 'poll_vote' || type === 'poll_closed' || type === 'room_created') {
        return { type, room_id, payload } as ChatWsEvent;
    }
    return null;
}

function connect(): void {
    if (isConnecting || typeof window === 'undefined')
        return;
    const sessionOnly = isSessionCookieOnly();
    const token = getAccessToken()?.trim();
    if (!sessionOnly && !token)
        return;
    let url: string;
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
    ws.onmessage = (event: MessageEvent) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        try {
            const data = JSON.parse(raw) as Record<string, unknown>;
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

function disconnect(): void {
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

export function connectChatWs(): () => void {
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
