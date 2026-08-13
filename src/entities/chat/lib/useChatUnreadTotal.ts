import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '@shared/config';
import { fetchChatRooms } from '../api';
import { connectChatWs, subscribeChatWs } from '../wsClient';
import type { ChatRoom } from '../types';
import { sumChatUnreadTotal } from './kostaDailyUi';

function firstUnreadRoomId(rooms: ChatRoom[]): number | null {
    const hit = rooms.find((room) => room.unread_count > 0);
    return hit ? hit.id : null;
}

export function useChatUnreadTotal(enabled = true): {
    count: number;
    firstUnreadRoomId: number | null;
} {
    const [count, setCount] = useState(0);
    const [unreadRoomId, setUnreadRoomId] = useState<number | null>(null);
    const location = useLocation();
    const onKostaDaily = location.pathname.startsWith(routes.kostaDaily);

    const applyRooms = useCallback((rooms: ChatRoom[]) => {
        setCount(sumChatUnreadTotal(rooms));
        setUnreadRoomId(firstUnreadRoomId(rooms));
    }, []);

    const refresh = useCallback(async () => {
        if (!enabled)
            return;
        try {
            const list = await fetchChatRooms();
            applyRooms(list);
        }
        catch {

        }
    }, [enabled, applyRooms]);

    useEffect(() => {
        if (!enabled) {
            setCount(0);
            setUnreadRoomId(null);
            return;
        }
        void refresh();
    }, [enabled, refresh, onKostaDaily]);

    useEffect(() => {
        if (!enabled)
            return;
        const disconnect = connectChatWs();
        const unsub = subscribeChatWs((event) => {
            if (event.type === 'message') {
                if (onKostaDaily)
                    void refresh();
                else
                    setCount((prev) => prev + 1);
            }
            if (event.type === 'members_added')
                void refresh();
        });
        return () => {
            unsub();
            disconnect();
        };
    }, [enabled, onKostaDaily, refresh]);

    useEffect(() => {
        if (!enabled)
            return;
        const onFocus = () => void refresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [enabled, refresh]);

    return { count, firstUnreadRoomId: unreadRoomId };
}
