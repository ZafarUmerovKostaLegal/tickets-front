import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { mergeMessagesSorted } from './lib/kostaDailyUi';
/** REST goes to kosta_daily microservice; WS stays on gateway `/api/v1/chat/ws`. */
const CHAT = '/api/v1/kosta-daily';
const chatRoomsCache = createQueryCache({
    ttlMs: 15_000,
    staleWhileRevalidateMs: 45_000,
});
const chatRoomCache = createQueryCache({
    ttlMs: 60_000,
    staleWhileRevalidateMs: 4 * 60_000,
    maxEntries: 100,
});
const CHAT_ROOMS_CACHE_KEY = 'chat-rooms';
export function invalidateChatRoomsCache() {
    chatRoomsCache.invalidate(CHAT_ROOMS_CACHE_KEY);
    chatRoomCache.invalidate();
}
function parseAttachment(raw) {
    return {
        id: numField(raw, 'id', 'id', 0),
        file_name: strField(raw, 'file_name', 'fileName') ?? 'file',
        content_type: strField(raw, 'content_type', 'contentType') ?? 'application/octet-stream',
        size_bytes: numField(raw, 'size_bytes', 'sizeBytes', 0),
    };
}
export function parseChatAttachments(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((x) => !!x && typeof x === 'object')
        .map(parseAttachment);
}
function strField(o, snake, camel) {
    const v = o[snake] ?? o[camel];
    return typeof v === 'string' ? v : null;
}
function numField(o, snake, camel, fallback = 0) {
    const v = o[snake] ?? o[camel];
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function boolField(o, snake, camel) {
    const v = o[snake] ?? o[camel];
    return Boolean(v);
}
function parseReaction(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const emoji = strField(o, 'emoji', 'emoji');
    if (!emoji)
        return null;
    const rawIds = o.user_ids ?? o.userIds;
    const userIds = Array.isArray(rawIds)
        ? rawIds.map(Number).filter(Number.isFinite)
        : [];
    return {
        emoji,
        count: numField(o, 'count', 'count', userIds.length),
        user_ids: userIds,
    };
}
export function parseChatReactions(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((x) => !!x && typeof x === 'object')
        .map(parseReaction)
        .filter((r) => r !== null);
}
function parseReplyTo(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const messageId = numField(o, 'message_id', 'messageId', 0);
    if (!messageId)
        return null;
    return {
        message_id: messageId,
        author_user_id: numField(o, 'author_user_id', 'authorUserId', 0),
        body: strField(o, 'body', 'body') ?? '',
        is_deleted: boolField(o, 'is_deleted', 'isDeleted'),
    };
}
function parsePoll(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = numField(o, 'id', 'id', 0);
    if (!id)
        return null;
    const kindRaw = strField(o, 'kind', 'kind') ?? 'poll';
    const kind = kindRaw === 'quiz' ? 'quiz' : 'poll';
    const optionsRaw = o.options;
    const options = Array.isArray(optionsRaw)
        ? optionsRaw.map((item, index) => {
            const row = item;
            const rawIds = row.voter_ids ?? row.voterIds;
            const voterIds = Array.isArray(rawIds)
                ? rawIds.map(Number).filter(Number.isFinite)
                : [];
            return {
                index: numField(row, 'index', 'index', index),
                text: strField(row, 'text', 'text') ?? '',
                votes: numField(row, 'votes', 'votes', voterIds.length),
                voter_ids: voterIds,
            };
        })
        : [];
    const correctRaw = o.correct_option_index ?? o.correctOptionIndex;
    const correct = correctRaw == null ? null : Number(correctRaw);
    const myVotesRaw = o.my_votes ?? o.myVotes;
    const myVotes = Array.isArray(myVotesRaw)
        ? myVotesRaw.map(Number).filter(Number.isFinite)
        : [];
    return {
        id,
        kind,
        question: strField(o, 'question', 'question') ?? '',
        options,
        allows_multiple: boolField(o, 'allows_multiple', 'allowsMultiple'),
        is_anonymous: boolField(o, 'is_anonymous', 'isAnonymous'),
        is_closed: boolField(o, 'is_closed', 'isClosed'),
        correct_option_index: Number.isFinite(correct) ? correct : null,
        explanation: strField(o, 'explanation', 'explanation'),
        total_voters: numField(o, 'total_voters', 'totalVoters', 0),
        my_votes: myVotes,
    };
}
export function parseChatMessageFromWsPayload(raw) {
    const id = raw.id;
    if (id == null)
        return null;
    return parseMessage(raw);
}
function parseMessage(raw) {
    return {
        id: numField(raw, 'id', 'id', 0),
        room_id: numField(raw, 'room_id', 'roomId', 0),
        author_user_id: numField(raw, 'author_user_id', 'authorUserId', 0),
        message_kind: strField(raw, 'message_kind', 'messageKind') ?? 'text',
        body: strField(raw, 'body', 'body') ?? '',
        created_at: strField(raw, 'created_at', 'createdAt') ?? '',
        edited_at: strField(raw, 'edited_at', 'editedAt'),
        is_deleted: boolField(raw, 'is_deleted', 'isDeleted'),
        attachments: parseChatAttachments(raw.attachments),
        reply_to: parseReplyTo(raw.reply_to ?? raw.replyTo),
        reactions: parseChatReactions(raw.reactions),
        poll: parsePoll(raw.poll),
        checklist: parseChecklist(raw.checklist),
    };
}
function parseChecklist(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = numField(o, 'id', 'id', 0);
    if (!id)
        return null;
    const tasksRaw = o.tasks;
    const tasks = Array.isArray(tasksRaw)
        ? tasksRaw.map((item) => {
            const row = item;
            const by = row.completed_by_user_id ?? row.completedByUserId;
            const completedBy = by == null || by === '' ? null : Number(by);
            return {
                id: numField(row, 'id', 'id', 0),
                text: strField(row, 'text', 'text') ?? '',
                completed_by_user_id: Number.isFinite(completedBy) ? completedBy : null,
                completed_by_me: boolField(row, 'completed_by_me', 'completedByMe'),
            };
        }).filter((task) => task.id > 0)
        : [];
    return {
        id,
        title: strField(o, 'title', 'title') ?? '',
        others_can_complete: boolField(o, 'others_can_complete', 'othersCanComplete'),
        others_can_append: boolField(o, 'others_can_append', 'othersCanAppend'),
        can_toggle: boolField(o, 'can_toggle', 'canToggle'),
        can_append: boolField(o, 'can_append', 'canAppend'),
        can_remove: boolField(o, 'can_remove', 'canRemove'),
        done_count: numField(o, 'done_count', 'doneCount', 0),
        tasks,
    };
}
function parseRoom(raw) {
    const lastRaw = raw.last_message ?? raw.lastMessage;
    let last_message = null;
    if (lastRaw && typeof lastRaw === 'object') {
        last_message = parseMessage(lastRaw);
    }
    return {
        id: numField(raw, 'id', 'id', 0),
        slug: strField(raw, 'slug', 'slug'),
        title: strField(raw, 'title', 'title') ?? '',
        room_type: strField(raw, 'room_type', 'roomType') ?? '',
        my_role: strField(raw, 'my_role', 'myRole') ?? '',
        last_message,
        unread_count: numField(raw, 'unread_count', 'unreadCount', 0),
        is_company_channel: boolField(raw, 'is_company_channel', 'isCompanyChannel'),
        is_channel: boolField(raw, 'is_channel', 'isChannel'),
        can_post: raw.can_post !== undefined || raw.canPost !== undefined
            ? boolField(raw, 'can_post', 'canPost')
            : true,
    };
}
function localizeChatServiceError(detail, hint) {
    const d = detail.trim();
    if (/chat service unavailable|chat unreachable from gateway|CHAT_SERVICE_URL not configured/i.test(d)) {
        return hint?.trim()
            || 'Сервис чата временно недоступен. Попробуйте обновить список через минуту.';
    }
    return d;
}
async function parseHttpError(status, text) {
    let msg = `Ошибка ${status}`;
    if (text) {
        try {
            const j = JSON.parse(text);
            if (typeof j.detail === 'string')
                msg = localizeChatServiceError(j.detail, typeof j.hint === 'string' ? j.hint : undefined);
        }
        catch {
            msg = text.slice(0, 500);
        }
    }
    return new Error(msg);
}
async function readJson(res) {
    const text = await res.text();
    if (!res.ok)
        throw await parseHttpError(res.status, text);
    return text.trim() ? JSON.parse(text) : {};
}
async function fetchChatRoomsFromApi(signal) {
    const res = await apiFetch(`${CHAT}/rooms`, { signal, getReuseWindowMs: 10_000 });
    const raw = await readJson(res);
    const items = Array.isArray(raw.items) ? raw.items : [];
    return items.map((x) => parseRoom(x));
}
export async function fetchChatRooms(signal) {
    return chatRoomsCache.fetch(CHAT_ROOMS_CACHE_KEY, fetchChatRoomsFromApi, { signal });
}
export async function fetchChatRoom(roomId, signal) {
    const key = String(roomId);
    return chatRoomCache.fetch(key, async (sharedSignal) => {
        const res = await apiFetch(`${CHAT}/rooms/${roomId}`, {
            signal: sharedSignal,
            getReuseWindowMs: 5_000,
        });
        return parseRoom(await readJson(res));
    }, { signal });
}
export const CHAT_MESSAGES_MAX_LIMIT = 100;
export async function fetchChatMessages(roomId, params = {}) {
    const q = new URLSearchParams();
    if (params.beforeId != null)
        q.set('beforeId', String(params.beforeId));
    if (params.limit != null) {
        const limit = Math.min(CHAT_MESSAGES_MAX_LIMIT, Math.max(1, Math.trunc(params.limit)));
        q.set('limit', String(limit));
    }
    const qs = q.toString();
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/messages${qs ? `?${qs}` : ''}`);
    const raw = await readJson(res);
    const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
    return {
        items: itemsRaw.map((x) => parseMessage(x)),
        has_more: boolField(raw, 'has_more', 'hasMore'),
    };
}
const CHAT_MESSAGES_FETCH_MAX_PAGES = 500;
export async function fetchAllChatMessages(roomId) {
    const first = await fetchChatMessages(roomId, { limit: CHAT_MESSAGES_MAX_LIMIT });
    let merged = first.items;
    let hasMore = first.has_more;
    for (let page = 1; page < CHAT_MESSAGES_FETCH_MAX_PAGES && hasMore; page += 1) {
        const oldestId = merged[0]?.id;
        if (oldestId == null)
            break;
        try {
            const older = await fetchChatMessages(roomId, {
                beforeId: oldestId,
                limit: CHAT_MESSAGES_MAX_LIMIT,
            });
            if (older.items.length === 0)
                break;
            merged = mergeMessagesSorted(older.items, merged);
            hasMore = older.has_more;
        }
        catch {
            break;
        }
    }
    return merged;
}
export async function postChatMessage(roomId, body, replyToMessageId) {
    const payload = { body };
    if (replyToMessageId != null)
        payload.replyToMessageId = replyToMessageId;
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const message = parseMessage(await readJson(res));
    invalidateChatRoomsCache();
    return message;
}
export async function uploadChatFile(roomId, file, options) {
    const form = new FormData();
    form.append('file', file, file.name);
    const caption = options?.body?.trim();
    if (caption)
        form.append('body', caption);
    if (options?.replyToMessageId != null)
        form.append('replyToMessageId', String(options.replyToMessageId));
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/messages/upload`, {
        method: 'POST',
        body: form,
    });
    const message = parseMessage(await readJson(res));
    invalidateChatRoomsCache();
    return message;
}
export async function fetchChatAttachmentBlob(attachmentId) {
    const res = await apiFetch(`${CHAT}/attachments/${attachmentId}/file`);
    if (!res.ok)
        throw await parseHttpError(res.status, await res.text());
    return res.blob();
}
export async function markChatRoomRead(roomId, messageId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageId != null ? { messageId } : {}),
    });
    await readJson(res);
    invalidateChatRoomsCache();
}
export async function createChatGroupRoom(title, memberUserIds) {
    const res = await apiFetch(`${CHAT}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, memberUserIds }),
    });
    const room = parseRoom(await readJson(res));
    invalidateChatRoomsCache();
    return room;
}
export async function createChatChannelRoom(title, memberUserIds) {
    const res = await apiFetch(`${CHAT}/rooms/channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, memberUserIds }),
    });
    const room = parseRoom(await readJson(res));
    invalidateChatRoomsCache();
    return room;
}
export async function createChatPoll(roomId, input) {
    const payload = {
        kind: input.kind,
        question: input.question,
        options: input.options,
        allowsMultiple: input.allowsMultiple ?? false,
        isAnonymous: input.isAnonymous ?? false,
    };
    if (input.correctOptionIndex != null)
        payload.correctOptionIndex = input.correctOptionIndex;
    if (input.explanation)
        payload.explanation = input.explanation;
    if (input.replyToMessageId != null)
        payload.replyToMessageId = input.replyToMessageId;
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return parseMessage(await readJson(res));
}
function parsePinnedMessage(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const row = raw;
    const id = numField(row, 'message_id', 'messageId', 0);
    if (!id)
        return null;
    return {
        message_id: id,
        preview: strField(row, 'preview', 'preview') ?? '',
        message_kind: strField(row, 'message_kind', 'messageKind') ?? 'text',
        author_user_id: numField(row, 'author_user_id', 'authorUserId', 0),
        pinned_at: strField(row, 'pinned_at', 'pinnedAt') ?? '',
    };
}
export function parseChatPins(raw) {
    const o = raw && typeof raw === 'object' ? raw : {};
    const itemsRaw = Array.isArray(o.items) ? o.items : Array.isArray(raw) ? raw : [];
    return {
        items: itemsRaw.map(parsePinnedMessage).filter((item) => item != null),
        can_pin: boolField(o, 'can_pin', 'canPin'),
    };
}
export async function fetchChatPins(roomId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/pins`);
    return parseChatPins(await readJson(res));
}
export async function pinChatMessage(roomId, messageId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
    });
    return parseChatPins(await readJson(res));
}
export async function unpinChatMessage(roomId, messageId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/pins/${messageId}`, { method: 'DELETE' });
    return parseChatPins(await readJson(res));
}
export async function createChatChecklist(roomId, input) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: input.title,
            tasks: input.tasks,
            othersCanComplete: input.othersCanComplete,
            othersCanAppend: input.othersCanAppend,
        }),
    });
    return parseMessage(await readJson(res));
}
export async function toggleChatChecklistItem(checklistId, itemId) {
    const res = await apiFetch(`${CHAT}/checklists/${checklistId}/items/${itemId}/toggle`, { method: 'POST' });
    return parseMessage(await readJson(res));
}
export async function appendChatChecklistTask(checklistId, text) {
    const res = await apiFetch(`${CHAT}/checklists/${checklistId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    return parseMessage(await readJson(res));
}
export async function removeChatChecklistTask(checklistId, itemId) {
    const res = await apiFetch(`${CHAT}/checklists/${checklistId}/items/${itemId}`, { method: 'DELETE' });
    return parseMessage(await readJson(res));
}
export async function voteChatPoll(pollId, optionIndex) {
    const res = await apiFetch(`${CHAT}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
    });
    return parseMessage(await readJson(res));
}
export async function closeChatPoll(pollId) {
    const res = await apiFetch(`${CHAT}/polls/${pollId}/close`, { method: 'POST' });
    return parseMessage(await readJson(res));
}
export async function createOrGetChatDmRoom(otherUserId) {
    const res = await apiFetch(`${CHAT}/rooms/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId }),
    });
    const room = parseRoom(await readJson(res));
    invalidateChatRoomsCache();
    return room;
}
function parseRoomMembers(raw) {
    const body = raw && typeof raw === 'object' ? raw : {};
    const items = Array.isArray(body.items) ? body.items : [];
    return items.map((x) => {
        const row = x;
        return {
            user_id: numField(row, 'user_id', 'userId', 0),
            role: strField(row, 'role', 'role') ?? '',
            joined_at: strField(row, 'joined_at', 'joinedAt') ?? '',
        };
    });
}
export async function fetchChatRoomMembers(roomId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/members`);
    return parseRoomMembers(await readJson(res));
}
export async function patchChatGroupRoom(roomId, title) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
    });
    const room = parseRoom(await readJson(res));
    invalidateChatRoomsCache();
    return room;
}
export async function deleteChatGroupRoom(roomId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}`, { method: 'DELETE' });
    await readJson(res);
    invalidateChatRoomsCache();
}
export async function removeChatRoomMember(roomId, userId) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/members/${userId}`, { method: 'DELETE' });
    const members = parseRoomMembers(await readJson(res));
    invalidateChatRoomsCache();
    return members;
}
export async function addChatRoomMembers(roomId, userIds) {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
    });
    const members = parseRoomMembers(await readJson(res));
    invalidateChatRoomsCache();
    return members;
}
export async function patchChatMessage(messageId, body) {
    const res = await apiFetch(`${CHAT}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    return parseMessage(await readJson(res));
}
export async function deleteChatMessage(messageId) {
    const res = await apiFetch(`${CHAT}/messages/${messageId}`, { method: 'DELETE' });
    return parseMessage(await readJson(res));
}
export async function toggleChatReaction(messageId, emoji) {
    const res = await apiFetch(`${CHAT}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
    });
    const raw = await readJson(res);
    const items = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : [raw]);
    return parseChatReactions(Array.isArray(raw) ? raw : items);
}
export async function fetchChatPushConfig() {
    const res = await apiFetch(`${CHAT}/push/vapid-public-key`);
    const raw = await readJson(res);
    return {
        enabled: raw.enabled === true,
        publicKey: typeof raw.publicKey === 'string' ? raw.publicKey : '',
    };
}
export async function saveChatPushSubscription(subscription) {
    const res = await apiFetch(`${CHAT}/push/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
    });
    await readJson(res);
}
export async function deleteChatPushSubscription(endpoint) {
    const res = await apiFetch(`${CHAT}/push/subscription`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
    });
    await readJson(res);
}
