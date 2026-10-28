import { apiFetch, invalidateApiGetReuse } from '@shared/api';
import { getAccessToken } from '@shared/lib/auth';
import { getTicketsWsUrl, isSessionCookieOnly } from '@shared/config';
import { buildTicketsPayload } from './lib/query';
import { BASE } from './lib/constants';
const PENDING_TIMEOUT_MS = 30000;
let ws = null;
let lastConnectToken = null;
const pending = new Map();
const pushHandlers = new Set();
function getRequestId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function rejectAllPending(reason) {
    for (const [, entry] of pending) {
        clearTimeout(entry.timeoutId);
        entry.reject(reason);
    }
    pending.clear();
}
async function resolveWsBaseUrl() {
    try {
        const res = await apiFetch(`${BASE}/ws-url`, { skipAuth: true });
        if (res.ok) {
            const data = (await res.json());
            if (typeof data.url === 'string' && data.url.trim())
                return data.url.trim();
        }
    }
    catch {
    }
    const fallback = getTicketsWsUrl();
    if (!fallback)
        throw new Error('Tickets WebSocket URL not configured');
    return fallback;
}
function appendTokenToWsUrl(baseUrl, token) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}token=${encodeURIComponent(token)}`;
}
function connect(token) {
    return resolveWsBaseUrl().then((base) => new Promise((resolve, reject) => {
        const url = token ? appendTokenToWsUrl(base, token) : base;
        const socket = new WebSocket(url);
        socket.onopen = () => resolve(socket);
        socket.onerror = () => reject(new Error('WebSocket connection failed'));
        socket.onclose = () => {
            if (ws !== socket)
                return;
            ws = null;
            lastConnectToken = null;
            rejectAllPending(new Error('WebSocket closed'));
        };
        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.push === true) {
                    invalidateApiGetReuse();
                    for (const h of pushHandlers) {
                        try {
                            h(msg);
                        }
                        catch {
                        }
                    }
                    return;
                }
                const id = msg.request_id;
                if (typeof id === 'string' && pending.has(id)) {
                    const p = pending.get(id);
                    pending.delete(id);
                    clearTimeout(p.timeoutId);
                    if (msg != null && typeof msg.error === 'string' && msg.error)
                        p.reject(new Error(msg.error));
                    else
                        p.resolve(msg.result);
                }
            }
            catch {
            }
        };
    }));
}
async function ensureSocket() {
    const sessionOnly = isSessionCookieOnly();
    const token = getAccessToken()?.trim() || null;
    if (!sessionOnly && !token)
        throw new Error('Нет токена авторизации для WebSocket');
    const key = sessionOnly ? '__cookie__' : token;
    if (ws?.readyState === WebSocket.OPEN && lastConnectToken === key)
        return ws;
    if (ws) {
        try {
            ws.close();
        }
        catch {
        }
        ws = null;
        rejectAllPending(new Error('WebSocket переподключается'));
    }
    ws = await connect(sessionOnly ? null : token);
    lastConnectToken = key;
    return ws;
}
export async function connectTicketsWsWhenReady() {
    if (typeof window === 'undefined')
        return;
    if (!isSessionCookieOnly() && !getAccessToken()?.trim())
        return;
    try {
        await ensureSocket();
    }
    catch {
    }
}
export function subscribeTicketsWsPush(handler) {
    pushHandlers.add(handler);
    return () => {
        pushHandlers.delete(handler);
    };
}
export async function sendRequest(action, payload = {}) {
    const sessionOnly = isSessionCookieOnly();
    const token = getAccessToken()?.trim();
    if (!sessionOnly && !token)
        return Promise.reject(new Error('Нет токена авторизации для WebSocket'));
    const socket = await ensureSocket();
    const requestId = getRequestId();
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (pending.delete(requestId)) {
                reject(new Error('Таймаут запроса к WebSocket заявок'));
            }
        }, PENDING_TIMEOUT_MS);
        pending.set(requestId, {
            resolve: (v) => resolve(v),
            reject,
            timeoutId,
        });
        socket.send(JSON.stringify({ action, payload, request_id: requestId }));
    });
}
export async function listStatusesWs() {
    return sendRequest('list_statuses', {});
}
export async function listPrioritiesWs() {
    return sendRequest('list_priorities', {});
}
export async function listTicketsWs(params = {}) {
    return sendRequest('list_tickets', buildTicketsPayload(params));
}
export async function getTicketWs(ticketUuid) {
    return sendRequest('get_ticket', { ticket_uuid: ticketUuid });
}
export async function updateTicketWs(ticketUuid, data) {
    return sendRequest('update_ticket', { ticket_uuid: ticketUuid, ...data });
}
export async function archiveTicketWs(ticketUuid, isArchived = true) {
    return sendRequest('archive_ticket', { ticket_uuid: ticketUuid, is_archived: isArchived });
}
export async function listCommentsWs(ticketUuid) {
    return sendRequest('list_comments', { ticket_uuid: ticketUuid });
}
export async function addCommentWs(ticketUuid, content) {
    return sendRequest('add_comment', { ticket_uuid: ticketUuid, content });
}
export async function editCommentWs(commentId, content) {
    return sendRequest('edit_comment', { comment_id: commentId, content });
}
export async function deleteCommentWs(commentId) {
    return sendRequest('delete_comment', { comment_id: commentId });
}
export function closeTicketsWs() {
    lastConnectToken = null;
    if (ws) {
        try {
            ws.close();
        }
        catch {
        }
        ws = null;
    }
    rejectAllPending(new Error('WebSocket closed'));
}
