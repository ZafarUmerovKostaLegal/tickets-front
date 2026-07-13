import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { router } from '@app/router';
import { listContactsColleagues } from '@entities/contacts';
import {
    chatNotificationSenderLine,
    chatNotificationTitle,
    connectChatWs,
    fetchChatRoom,
    fetchChatRooms,
    parseChatMessageFromWsPayload,
    shouldShowChatMessageNotification,
    subscribeChatWs,
    type ChatRoom,
} from '@entities/chat';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { isAuthenticated } from '@shared/lib/auth';
import './ChatNotificationHost.css';

type ChatNotificationItem = {
    id: string;
    roomId: number;
    title: string;
    preview: string;
    avatarLabel: string;
    avatarColor: string;
};

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5500;
const AVATAR_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#5b9bd5'];

function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++)
        h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function ChatNotificationHost() {
    const { user } = useCurrentUser();
    const meId = user?.id ?? null;
    const [items, setItems] = useState<ChatNotificationItem[]>([]);
    const roomsRef = useRef<Map<number, ChatRoom>>(new Map());
    const labelsRef = useRef<Map<number, string>>(new Map());
    const timersRef = useRef<Map<string, number>>(new Map());

    const labelByUserId = useCallback((id: number) => {
        const cached = labelsRef.current.get(id);
        if (cached)
            return cached;
        return `Пользователь ${id}`;
    }, []);

    const removeItem = useCallback((id: string) => {
        const timer = timersRef.current.get(id);
        if (timer != null) {
            window.clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setItems((prev) => prev.filter((x) => x.id !== id));
    }, []);

    const scheduleDismiss = useCallback((id: string) => {
        const prevTimer = timersRef.current.get(id);
        if (prevTimer != null)
            window.clearTimeout(prevTimer);
        const timer = window.setTimeout(() => {
            timersRef.current.delete(id);
            setItems((prev) => prev.filter((x) => x.id !== id));
        }, AUTO_DISMISS_MS);
        timersRef.current.set(id, timer);
    }, []);

    const upsertNotification = useCallback((room: ChatRoom, title: string, preview: string) => {
        const avatarLabel = initials(title);
        const color = avatarColor(title);
        const id = `room_${room.id}`;
        setItems((prev) => {
            const without = prev.filter((x) => x.roomId !== room.id);
            const next = [{ id, roomId: room.id, title, preview, avatarLabel, avatarColor: color }, ...without];
            return next.slice(0, MAX_VISIBLE);
        });
        scheduleDismiss(id);
    }, [scheduleDismiss]);

    useEffect(() => {
        if (!isAuthenticated() || meId == null)
            return;
        let cancelled = false;
        void listContactsColleagues()
            .then((rows) => {
                if (cancelled)
                    return;
                for (const row of rows) {
                    const name = row.display_name?.trim() || row.email?.trim();
                    if (name)
                        labelsRef.current.set(row.id, name);
                }
            })
            .catch(() => { });
        void fetchChatRooms()
            .then((rooms) => {
                if (cancelled)
                    return;
                for (const room of rooms)
                    roomsRef.current.set(room.id, room);
            })
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, [meId]);

    useEffect(() => {
        if (!isAuthenticated() || meId == null)
            return;
        const disconnect = connectChatWs();
        const unsub = subscribeChatWs((event) => {
            if (event.type !== 'message')
                return;
            const raw = event.payload?.message;
            if (!raw || typeof raw !== 'object')
                return;
            const msg = parseChatMessageFromWsPayload(raw);
            if (!msg)
                return;
            const roomId = event.room_id;
            if (!shouldShowChatMessageNotification(msg, roomId, meId))
                return;

            const cachedRoom = roomsRef.current.get(roomId);
            const build = (room: ChatRoom) => {
                roomsRef.current.set(room.id, room);
                const title = chatNotificationTitle(room, meId, labelByUserId);
                const preview = chatNotificationSenderLine(room, msg, labelByUserId);
                upsertNotification(room, title, preview);
            };

            if (cachedRoom) {
                build(cachedRoom);
                return;
            }
            void fetchChatRoom(roomId).then(build).catch(() => { });
        });
        return () => {
            unsub();
            disconnect();
        };
    }, [meId, labelByUserId, upsertNotification]);

    useEffect(() => () => {
        for (const timer of timersRef.current.values())
            window.clearTimeout(timer);
        timersRef.current.clear();
    }, []);

    const openRoom = useCallback((roomId: number) => {
        removeItem(`room_${roomId}`);
        void router.navigate(`${routes.kostaDaily}?room=${roomId}`);
    }, [removeItem]);

    if (items.length === 0)
        return null;

    return createPortal(
        <div className="chat-notif-host" aria-live="polite" aria-relevant="additions">
            {items.map((item) => (
                <div key={item.id} className="chat-notif" role="status">
                    <button
                        type="button"
                        className="chat-notif__main"
                        onClick={() => openRoom(item.roomId)}
                    >
                        <span
                            className="chat-notif__avatar"
                            style={{ background: item.avatarColor }}
                            aria-hidden
                        >
                            {item.avatarLabel}
                        </span>
                        <span className="chat-notif__body">
                            <span className="chat-notif__title">{item.title}</span>
                            <span className="chat-notif__preview">{item.preview}</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        className="chat-notif__close"
                        aria-label="Закрыть уведомление"
                        onClick={() => removeItem(item.id)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>,
        document.body,
    );
}
