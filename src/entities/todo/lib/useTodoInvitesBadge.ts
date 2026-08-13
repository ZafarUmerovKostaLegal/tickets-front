import { useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeNotificationPush, TODO_NOTIFICATION_TYPES } from '@entities/notification/wsClient';
import { fetchMyTodoInvites } from '../api';

export const TODO_INVITES_INVALIDATE_EVENT = 'todo-invites-invalidate';

export function invalidateTodoInvites(): void {
    window.dispatchEvent(new CustomEvent(TODO_INVITES_INVALIDATE_EVENT));
}

function formatBadge(count: number): string {
    if (count <= 0)
        return '';
    return count > 99 ? '99+' : String(count);
}

export function useTodoInvitesBadge(enabled = true): {
    count: number;
    badge: string;
} {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        if (!enabled) {
            setCount(0);
            return;
        }
        try {
            const list = await fetchMyTodoInvites();
            setCount(list.filter((i) => (i.status || '').toLowerCase() === 'pending').length);
        }
        catch {
            setCount(0);
        }
    }, [enabled]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!enabled)
            return;
        const onInvalidate = () => {
            void refresh();
        };
        const onFocus = () => {
            void refresh();
        };
        window.addEventListener(TODO_INVITES_INVALIDATE_EVENT, onInvalidate);
        window.addEventListener('focus', onFocus);
        const unsubPush = subscribeNotificationPush((n) => {
            const kind = (n.notification_type ?? '').trim().toLowerCase();
            if (kind === TODO_NOTIFICATION_TYPES.boardInvited || kind === TODO_NOTIFICATION_TYPES.boardAdded)
                void refresh();
        });
        return () => {
            window.removeEventListener(TODO_INVITES_INVALIDATE_EVENT, onInvalidate);
            window.removeEventListener('focus', onFocus);
            unsubPush();
        };
    }, [enabled, refresh]);

    return {
        count,
        badge: useMemo(() => formatBadge(count), [count]),
    };
}
