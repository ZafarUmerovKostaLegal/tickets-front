import type { ChatAttachment, ChatMessage, ChatPoll, ChatReaction, ChatRoom } from '../types';
import { formatChatMessagePreview } from './chatRichContent';

export type DailyReplyTo = {
    messageId: number;
    authorId: number;
    authorName: string;
    preview: string;
    isDeleted: boolean;
};

export function formatReplyPreview(body: string, isDeleted: boolean): string {
    if (isDeleted)
        return 'Сообщение удалено';
    const t = formatChatMessagePreview(body);
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

export const KOSTA_DAILY_SLUG = 'kosta-daily';

export const COMPANY_CHANNEL_HINT =
    'Общий канал для новостей офиса, координации и быстрых вопросов. Сообщения видны всем сотрудникам.';

export type DailyMessage = {
    id: string;
    kind: 'service' | 'user';
    messageKind?: string;
    authorId?: number;
    authorName: string;
    time: string;
    text: string;
    createdAt?: string;
    isDeleted?: boolean;
    attachments?: ChatAttachment[];
    replyTo?: DailyReplyTo;
    reactions?: ChatReaction[];
    poll?: ChatPoll | null;
};

export type ChatPreview = {
    id: string;
    roomId: number;
    title: string;
    subtitle: string;
    lastMessage: string;
    time: string;
    unread?: number;
    pinned?: boolean;
    isGroup?: boolean;
    isCompanyChannel?: boolean;
    isChannel?: boolean;
    canPost?: boolean;
    roomType: string;
};

export function formatChatTime(iso: string | null | undefined, locale = 'ru-RU'): string {
    if (!iso?.trim())
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    const now = new Date();
    const sameDay = d.getDate() === now.getDate()
        && d.getMonth() === now.getMonth()
        && d.getFullYear() === now.getFullYear();
    if (sameDay) {
        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate()
        && d.getMonth() === yesterday.getMonth()
        && d.getFullYear() === yesterday.getFullYear();
    if (isYesterday)
        return 'Вчера';
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    if (d >= weekAgo) {
        return d.toLocaleDateString(locale, { weekday: 'short' });
    }
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

export function formatDateLabel(iso: string, locale = 'ru-RU'): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    const now = new Date();
    const sameDay = d.getDate() === now.getDate()
        && d.getMonth() === now.getMonth()
        && d.getFullYear() === now.getFullYear();
    if (sameDay)
        return 'Сегодня';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.getDate() === yesterday.getDate()
        && d.getMonth() === yesterday.getMonth()
        && d.getFullYear() === yesterday.getFullYear()) {
        return 'Вчера';
    }
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function dmOtherUserId(room: ChatRoom, meId: number): number | null {
    if (room.room_type !== 'dm')
        return null;
    const m = /^DM:(\d+):(\d+)$/.exec(room.title.trim());
    if (!m)
        return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b))
        return null;
    if (a === meId)
        return b;
    if (b === meId)
        return a;
    return b !== meId ? b : a;
}

export function resolveRoomTitle(
    room: ChatRoom,
    meId: number | null | undefined,
    labelByUserId: (id: number) => string,
): string {
    if (room.is_company_channel || room.slug === KOSTA_DAILY_SLUG)
        return 'Kosta Daily';
    if (room.room_type === 'dm' && meId != null) {
        const other = dmOtherUserId(room, meId);
        if (other != null)
            return labelByUserId(other);
    }
    return room.title.trim() || `Чат ${room.id}`;
}

export function roomSubtitle(room: ChatRoom, memberCount?: number): string {
    if (room.is_company_channel)
        return 'общий чат';
    if (room.room_type === 'channel')
        return room.can_post ? 'канал · админ' : 'канал · только чтение';
    if (room.room_type === 'dm')
        return 'личные сообщения';
    if (memberCount != null && memberCount > 0) {
        const n = memberCount;
        return `${n} ${n === 1 ? 'участник' : n < 5 ? 'участника' : 'участников'}`;
    }
    if (room.room_type === 'group')
        return 'группа';
    return 'чат';
}

export function lastMessagePreview(
    room: ChatRoom,
    labelByUserId: (id: number) => string,
    meId: number | null | undefined,
): string {
    const last = room.last_message;
    if (!last || last.is_deleted)
        return 'Нет сообщений';
    const prefix = last.author_user_id === meId
        ? 'Вы: '
        : room.room_type !== 'dm'
            ? `${labelByUserId(last.author_user_id).split(' ')[0] ?? 'Коллега'}: `
            : '';
    if (last.message_kind === 'poll' || last.message_kind === 'quiz' || last.poll) {
        const label = last.poll?.kind === 'quiz' || last.message_kind === 'quiz' ? '🧠 Викторина' : '📊 Опрос';
        return `${prefix}${label}: ${last.poll?.question ?? last.body}`.slice(0, 80);
    }
    const hasFile = (last.attachments?.length ?? 0) > 0 || !last.body.trim();
    const displayBody = last.body.trim() ? formatChatMessagePreview(last.body) : (hasFile ? '📎 Файл' : '…');
    return `${prefix}${displayBody.length > 60 ? `${displayBody.slice(0, 57)}…` : displayBody}`;
}

export function roomToPreview(
    room: ChatRoom,
    meId: number | null | undefined,
    labelByUserId: (id: number) => string,
): ChatPreview {
    const title = resolveRoomTitle(room, meId, labelByUserId);
    const isGroup = room.room_type === 'group' || room.is_company_channel;
    const isChannel = (room.is_channel || room.room_type === 'channel') && !room.is_company_channel;
    return {
        id: String(room.id),
        roomId: room.id,
        title,
        subtitle: roomSubtitle(room),
        lastMessage: lastMessagePreview(room, labelByUserId, meId),
        time: room.last_message ? formatChatTime(room.last_message.created_at) : '',
        unread: room.unread_count > 0 ? room.unread_count : undefined,
        pinned: room.is_company_channel,
        isGroup,
        isCompanyChannel: room.is_company_channel,
        isChannel,
        canPost: room.can_post,
        roomType: room.room_type,
    };
}

export function apiMessageToDaily(
    msg: ChatMessage,
    labelByUserId: (id: number) => string,
    meId: number | null | undefined,
): DailyMessage {
    const own = meId != null && msg.author_user_id === meId;
    let replyTo: DailyReplyTo | undefined;
    const rt = msg.reply_to;
    if (rt) {
        const replyOwn = meId != null && rt.author_user_id === meId;
        replyTo = {
            messageId: rt.message_id,
            authorId: rt.author_user_id,
            authorName: replyOwn ? 'Вы' : labelByUserId(rt.author_user_id),
            preview: formatReplyPreview(rt.body, rt.is_deleted),
            isDeleted: rt.is_deleted,
        };
    }
    return {
        id: String(msg.id),
        kind: 'user',
        messageKind: msg.message_kind,
        authorId: msg.author_user_id,
        authorName: own ? 'Вы' : labelByUserId(msg.author_user_id),
        time: formatChatTime(msg.created_at),
        text: msg.is_deleted ? 'Сообщение удалено' : msg.body,
        createdAt: msg.created_at,
        isDeleted: msg.is_deleted,
        attachments: msg.is_deleted ? [] : msg.attachments,
        replyTo,
        reactions: msg.reactions,
        poll: msg.is_deleted ? null : msg.poll,
    };
}

export function mergeMessagesSorted(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const byId = new Map<number, ChatMessage>();
    for (const m of existing)
        byId.set(m.id, m);
    for (const m of incoming)
        byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        if (ta !== tb)
            return ta - tb;
        return a.id - b.id;
    });
}

export type RenderBlock =
    | { type: 'date'; id: string; label: string }
    | { type: 'service'; id: string; text: string }
    | {
        type: 'message';
        id: string;
        msg: DailyMessage;
        own: boolean;
        showAvatar: boolean;
        showName: boolean;
        groupedTop: boolean;
        groupedBottom: boolean;
    };

export function buildRenderBlocks(
    messages: DailyMessage[],
    serviceText: string,
    chatKey: string,
    isOwn: (m: DailyMessage) => boolean,
): RenderBlock[] {
    const blocks: RenderBlock[] = [];
    let lastDateKey = '';
    let insertedDate = false;

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.kind === 'service') {
            blocks.push({ type: 'service', id: msg.id, text: msg.text });
            continue;
        }
        if (msg.createdAt) {
            const dateKey = msg.createdAt.slice(0, 10);
            if (dateKey && dateKey !== lastDateKey) {
                lastDateKey = dateKey;
                insertedDate = true;
                blocks.push({
                    type: 'date',
                    id: `${chatKey}-date-${dateKey}`,
                    label: formatDateLabel(msg.createdAt),
                });
            }
        }
        else if (!insertedDate) {
            insertedDate = true;
            blocks.push({ type: 'date', id: `${chatKey}-date-today`, label: 'Сегодня' });
        }

        const own = isOwn(msg);
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const prevSame = prev?.kind === 'user' && isOwn(prev) === own
            && (own || prev.authorId === msg.authorId);
        const nextSame = next?.kind === 'user' && isOwn(next) === own
            && (own || next.authorId === msg.authorId);

        blocks.push({
            type: 'message',
            id: msg.id,
            msg,
            own,
            showAvatar: !own && !nextSame,
            showName: !own && !prevSame,
            groupedTop: prevSame,
            groupedBottom: nextSame,
        });
    }

    if (serviceText.trim() && blocks.length > 0 && blocks[0].type === 'date') {
        const firstDate = blocks[0];
        return [
            firstDate,
            { type: 'service', id: `${chatKey}-service`, text: serviceText },
            ...blocks.slice(1),
        ];
    }
    if (serviceText.trim() && blocks.length === 0) {
        blocks.push({ type: 'date', id: `${chatKey}-date-today`, label: 'Сегодня' });
        blocks.push({ type: 'service', id: `${chatKey}-service`, text: serviceText });
    }

    return blocks;
}

export function sumChatUnreadTotal(rooms: ChatRoom[]): number {
    return rooms.reduce((sum, room) => sum + Math.max(0, room.unread_count), 0);
}

export function formatChatUnreadBadge(count: number): string {
    if (count <= 0)
        return '';
    if (count > 99)
        return '99+';
    return String(count);
}
