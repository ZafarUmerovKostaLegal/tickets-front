import type { ChatMessage, ChatRoom } from '../types';
import { formatChatMessagePreview } from './chatRichContent';
import { getChatNotificationContext } from './chatNotificationSession';
import { resolveRoomTitle } from './kostaDailyUi';

export function chatMessageNotificationPreview(msg: ChatMessage): string {
    if (msg.is_deleted)
        return 'Сообщение удалено';
    if (msg.poll || msg.message_kind === 'poll' || msg.message_kind === 'quiz') {
        const label = msg.poll?.kind === 'quiz' || msg.message_kind === 'quiz' ? 'Викторина' : 'Опрос';
        const q = msg.poll?.question?.trim() || msg.body.trim();
        return q ? `${label}: ${q}` : label;
    }
    if ((msg.attachments?.length ?? 0) > 0 && !msg.body.trim())
        return 'Файл';
    const text = formatChatMessagePreview(msg.body).trim();
    return text || 'Новое сообщение';
}

export function shouldShowChatMessageNotification(
    msg: ChatMessage,
    roomId: number,
    meId: number | null | undefined,
): boolean {
    if (meId == null)
        return false;
    if (msg.author_user_id === meId)
        return false;
    if (msg.is_deleted)
        return false;
    if (document.hidden || !document.hasFocus())
        return true;
    const ctx = getChatNotificationContext();
    if (!ctx.onKostaDailyPage)
        return true;
    return ctx.activeRoomId !== roomId;
}

export function chatNotificationTitle(
    room: ChatRoom,
    meId: number | null | undefined,
    labelByUserId: (id: number) => string,
): string {
    return resolveRoomTitle(room, meId, labelByUserId);
}

export function chatNotificationSenderLine(
    room: ChatRoom,
    msg: ChatMessage,
    labelByUserId: (id: number) => string,
): string {
    const preview = chatMessageNotificationPreview(msg);
    if (room.room_type === 'dm')
        return preview;
    const sender = labelByUserId(msg.author_user_id).split(' ')[0] || 'Коллега';
    return `${sender}: ${preview}`;
}
