import { apiFetch } from '@shared/api';
import { mergeMessagesSorted } from './lib/kostaDailyUi';
import type {
    ChatAttachment,
    ChatMessage,
    ChatPoll,
    ChatReaction,
    ChatReplyTo,
    ChatRoom,
    ChatRoomMember,
    CreatePollInput,
} from './types';

const CHAT = '/api/v1/chat';

function parseAttachment(raw: Record<string, unknown>): ChatAttachment {
    return {
        id: numField(raw, 'id', 'id', 0),
        file_name: strField(raw, 'file_name', 'fileName') ?? 'file',
        content_type: strField(raw, 'content_type', 'contentType') ?? 'application/octet-stream',
        size_bytes: numField(raw, 'size_bytes', 'sizeBytes', 0),
    };
}

export function parseChatAttachments(value: unknown): ChatAttachment[] {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map(parseAttachment);
}

function strField(o: Record<string, unknown>, snake: string, camel: string): string | null {
    const v = o[snake] ?? o[camel];
    return typeof v === 'string' ? v : null;
}

function numField(o: Record<string, unknown>, snake: string, camel: string, fallback = 0): number {
    const v = o[snake] ?? o[camel];
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function boolField(o: Record<string, unknown>, snake: string, camel: string): boolean {
    const v = o[snake] ?? o[camel];
    return Boolean(v);
}

function parseReaction(raw: unknown): ChatReaction | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const emoji = strField(o, 'emoji', 'emoji');
    if (!emoji)
        return null;
    const rawIds = o.user_ids ?? o.userIds;
    const userIds = Array.isArray(rawIds)
        ? (rawIds as unknown[]).map(Number).filter(Number.isFinite)
        : [];
    return {
        emoji,
        count: numField(o, 'count', 'count', userIds.length),
        user_ids: userIds,
    };
}

export function parseChatReactions(value: unknown): ChatReaction[] {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map(parseReaction)
        .filter((r): r is ChatReaction => r !== null);
}

function parseReplyTo(raw: unknown): ChatReplyTo | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
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

function parsePoll(raw: unknown): ChatPoll | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = numField(o, 'id', 'id', 0);
    if (!id)
        return null;
    const kindRaw = strField(o, 'kind', 'kind') ?? 'poll';
    const kind = kindRaw === 'quiz' ? 'quiz' : 'poll';
    const optionsRaw = o.options;
    const options = Array.isArray(optionsRaw)
        ? optionsRaw.map((item, index) => {
            const row = item as Record<string, unknown>;
            const rawIds = row.voter_ids ?? row.voterIds;
            const voterIds = Array.isArray(rawIds)
                ? (rawIds as unknown[]).map(Number).filter(Number.isFinite)
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
        ? (myVotesRaw as unknown[]).map(Number).filter(Number.isFinite)
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

export function parseChatMessageFromWsPayload(raw: Record<string, unknown>): ChatMessage | null {
    const id = raw.id;
    if (id == null)
        return null;
    return parseMessage(raw);
}

function parseMessage(raw: Record<string, unknown>): ChatMessage {
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
    };
}

function parseRoom(raw: Record<string, unknown>): ChatRoom {
    const lastRaw = raw.last_message ?? raw.lastMessage;
    let last_message: ChatMessage | null = null;
    if (lastRaw && typeof lastRaw === 'object') {
        last_message = parseMessage(lastRaw as Record<string, unknown>);
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

async function parseHttpError(status: number, text: string): Promise<Error> {
    let msg = `Ошибка ${status}`;
    if (text) {
        try {
            const j = JSON.parse(text) as { detail?: string };
            if (typeof j.detail === 'string')
                msg = j.detail;
        }
        catch {
            msg = text.slice(0, 500);
        }
    }
    return new Error(msg);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if (!res.ok)
        throw await parseHttpError(res.status, text);
    return text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export async function fetchChatRooms(): Promise<ChatRoom[]> {
    const res = await apiFetch(`${CHAT}/rooms`);
    const raw = await readJson(res);
    const items = Array.isArray(raw.items) ? raw.items : [];
    return items.map((x) => parseRoom(x as Record<string, unknown>));
}

export async function fetchChatRoom(roomId: number): Promise<ChatRoom> {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}`);
    return parseRoom(await readJson(res));
}

export type FetchChatMessagesResult = {
    items: ChatMessage[];
    has_more: boolean;
};

export const CHAT_MESSAGES_MAX_LIMIT = 100;

export async function fetchChatMessages(
    roomId: number,
    params: { beforeId?: number; limit?: number } = {},
): Promise<FetchChatMessagesResult> {
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
        items: itemsRaw.map((x) => parseMessage(x as Record<string, unknown>)),
        has_more: boolField(raw, 'has_more', 'hasMore'),
    };
}

const CHAT_MESSAGES_FETCH_MAX_PAGES = 500;

export async function fetchAllChatMessages(roomId: number): Promise<ChatMessage[]> {
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

export async function postChatMessage(
    roomId: number,
    body: string,
    replyToMessageId?: number,
): Promise<ChatMessage> {
    const payload: Record<string, unknown> = { body };
    if (replyToMessageId != null)
        payload.replyToMessageId = replyToMessageId;
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return parseMessage(await readJson(res));
}

export async function uploadChatFile(
    roomId: number,
    file: File,
    options?: { body?: string; replyToMessageId?: number },
): Promise<ChatMessage> {
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
    return parseMessage(await readJson(res));
}

export async function fetchChatAttachmentBlob(attachmentId: number): Promise<Blob> {
    const res = await apiFetch(`${CHAT}/attachments/${attachmentId}/file`);
    if (!res.ok)
        throw await parseHttpError(res.status, await res.text());
    return res.blob();
}

export async function markChatRoomRead(roomId: number, messageId?: number): Promise<void> {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageId != null ? { messageId } : {}),
    });
    await readJson(res);
}

export async function createChatGroupRoom(title: string, memberUserIds: number[]): Promise<ChatRoom> {
    const res = await apiFetch(`${CHAT}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, memberUserIds }),
    });
    return parseRoom(await readJson(res));
}

export async function createChatChannelRoom(title: string, memberUserIds: number[]): Promise<ChatRoom> {
    const res = await apiFetch(`${CHAT}/rooms/channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, memberUserIds }),
    });
    return parseRoom(await readJson(res));
}

export async function createChatPoll(roomId: number, input: CreatePollInput): Promise<ChatMessage> {
    const payload: Record<string, unknown> = {
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

export async function voteChatPoll(pollId: number, optionIndex: number): Promise<ChatMessage> {
    const res = await apiFetch(`${CHAT}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
    });
    return parseMessage(await readJson(res));
}

export async function closeChatPoll(pollId: number): Promise<ChatMessage> {
    const res = await apiFetch(`${CHAT}/polls/${pollId}/close`, { method: 'POST' });
    return parseMessage(await readJson(res));
}

export async function createOrGetChatDmRoom(otherUserId: number): Promise<ChatRoom> {
    const res = await apiFetch(`${CHAT}/rooms/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId }),
    });
    return parseRoom(await readJson(res));
}

function parseRoomMembers(raw: unknown): ChatRoomMember[] {
    const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const items = Array.isArray(body.items) ? body.items : [];
    return items.map((x) => {
        const row = x as Record<string, unknown>;
        return {
            user_id: numField(row, 'user_id', 'userId', 0),
            role: strField(row, 'role', 'role') ?? '',
            joined_at: strField(row, 'joined_at', 'joinedAt') ?? '',
        };
    });
}

export async function fetchChatRoomMembers(roomId: number): Promise<ChatRoomMember[]> {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/members`);
    return parseRoomMembers(await readJson(res));
}

export async function addChatRoomMembers(roomId: number, userIds: number[]): Promise<ChatRoomMember[]> {
    const res = await apiFetch(`${CHAT}/rooms/${roomId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
    });
    return parseRoomMembers(await readJson(res));
}

export async function patchChatMessage(messageId: number, body: string): Promise<ChatMessage> {
    const res = await apiFetch(`${CHAT}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    return parseMessage(await readJson(res));
}

export async function deleteChatMessage(messageId: number): Promise<ChatMessage> {
    const res = await apiFetch(`${CHAT}/messages/${messageId}`, { method: 'DELETE' });
    return parseMessage(await readJson(res));
}

export async function toggleChatReaction(
    messageId: number,
    emoji: string,
): Promise<ChatReaction[]> {
    const res = await apiFetch(`${CHAT}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
    });
    const raw = await readJson(res);
    const items = Array.isArray(raw) ? raw : (Array.isArray((raw as Record<string, unknown>).items) ? (raw as Record<string, unknown>).items : [raw]);
    return parseChatReactions(Array.isArray(raw) ? raw : items);
}
