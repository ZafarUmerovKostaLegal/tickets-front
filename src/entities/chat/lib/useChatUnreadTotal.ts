import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '@shared/config';
import { fetchChatRooms } from '../api';
import { connectChatWs, subscribeChatWs } from '../wsClient';
import type { ChatRoom } from '../types';
import { sumChatUnreadTotal } from './kostaDailyUi';

export function useChatUnreadTotal(enabled = true): number {
    const [total, setTotal] = useState(0);
    const location = useLocation();
    const onKostaDaily = location.pathname.startsWith(routes.kostaDaily);

    const applyRooms = useCallback((rooms: ChatRoom[]) => {
        setTotal(sumChatUnreadTotal(rooms));
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
            setTotal(0);
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
                    setTotal((prev) => prev + 1);
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

    return total;
}
