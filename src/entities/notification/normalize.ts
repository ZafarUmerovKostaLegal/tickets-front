import type { NotificationItem } from './types';

function pickStr(raw: Record<string, unknown>, snake: string, camel: string): string | null {
    const v = raw[snake] ?? raw[camel];
    return typeof v === 'string' ? v : null;
}

function pickBool(raw: Record<string, unknown>, snake: string, camel: string): boolean {
    const v = raw[snake] ?? raw[camel];
    return Boolean(v);
}

function pickNumNullable(raw: Record<string, unknown>, snake: string, camel: string): number | null {
    const v = raw[snake] ?? raw[camel];
    if (v == null || v === '')
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}


export function normalizeNotificationItem(raw: Record<string, unknown>): NotificationItem | null {
    const uuid = (pickStr(raw, 'uuid', 'uuid') ?? '').trim();
    if (!uuid)
        return null;
    const idRaw = raw.id;
    const id = typeof idRaw === 'number' && Number.isFinite(idRaw) ? idRaw : Number(idRaw);
    const nt = pickStr(raw, 'notification_type', 'notificationType');
    const photo = raw.photo_path ?? raw.photoPath;
    return {
        id: Number.isFinite(id) ? id : 0,
        uuid,
        title: pickStr(raw, 'title', 'title') ?? '',
        description: pickStr(raw, 'description', 'description') ?? '',
        photo_path: photo == null ? null : String(photo),
        is_archived: pickBool(raw, 'is_archived', 'isArchived'),
        created_at: pickStr(raw, 'created_at', 'createdAt') ?? '',
        updated_at: pickStr(raw, 'updated_at', 'updatedAt') ?? '',
        notification_type: nt ?? undefined,
        recipient_user_id: pickNumNullable(raw, 'recipient_user_id', 'recipientUserId'),
    };
}

export function notificationTypeKey(item: NotificationItem): string {
    return (item.notification_type ?? '').trim().toLowerCase();
}


export function parseBoardTitleFromNotificationDescription(description: string): string | null {
    const m = /доску «([^»]+)»/i.exec(description);
    return m?.[1]?.trim() || null;
}

export const TODO_NOTIFICATION_TYPES = {
    boardAdded: 'todo_board_added',
    boardInvited: 'todo_board_invited',
    cardAssigned: 'todo_card_assigned',
} as const;
