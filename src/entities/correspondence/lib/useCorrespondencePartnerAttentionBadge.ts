import { useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeNotificationPush } from '@entities/notification/wsClient';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { fetchCorrespondenceStats, listCorrespondence } from '../api';
import {
    CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT,
} from './partnerAttentionEvents';

const POLL_MS = 45_000;

function formatBadge(count: number): string {
    if (count <= 0)
        return '';
    return count > 99 ? '99+' : String(count);
}

function isCorrespondenceAttentionPush(notificationType: string | undefined): boolean {
    const kind = (notificationType ?? '').trim().toLowerCase();
    return kind.startsWith('correspondence');
}

export function useCorrespondencePartnerAttentionBadge(enabled = true): {
    count: number;
    badge: string;
    outgoingPending: number;
    incomingNew: number;
} {
    const { user } = useCurrentUser();
    const [count, setCount] = useState(0);
    const [outgoingPending, setOutgoingPending] = useState(0);
    const [incomingNew, setIncomingNew] = useState(0);
    const partnerUserId = user?.id != null && Number.isFinite(user.id) ? Number(user.id) : 0;
    const shouldTrack = enabled
        && partnerUserId > 0
        && isPartnerOrgRole(user?.role, user?.position);

    const refresh = useCallback(async () => {
        if (!shouldTrack) {
            setCount(0);
            setOutgoingPending(0);
            setIncomingNew(0);
            return;
        }
        try {
            // Same filters as the «Attention» tab — source of truth for the hub badge.
            const listed = await listCorrespondence({
                direction: 'outgoing',
                status: 'pending_review',
                partnerUserId,
                skip: 0,
                limit: 1,
            });
            const pending = Math.max(0, listed.total);
            setCount(pending);
            setOutgoingPending(pending);
            setIncomingNew(0);
        }
        catch {
            try {
                const stats = await fetchCorrespondenceStats();
                const pending = Math.max(0, stats.partnerOutgoingPending ?? 0);
                setCount(pending);
                setOutgoingPending(pending);
                setIncomingNew(0);
            }
            catch {
                setCount(0);
                setOutgoingPending(0);
                setIncomingNew(0);
            }
        }
    }, [shouldTrack, partnerUserId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (!shouldTrack)
            return;
        const onInvalidate = () => {
            void refresh();
        };
        const onFocus = () => {
            void refresh();
        };
        const onVis = () => {
            if (document.visibilityState === 'visible')
                void refresh();
        };
        window.addEventListener(CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT, onInvalidate);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        const pollId = window.setInterval(() => {
            void refresh();
        }, POLL_MS);
        const unsubPush = subscribeNotificationPush((n) => {
            if (isCorrespondenceAttentionPush(n.notification_type))
                void refresh();
        });
        return () => {
            window.removeEventListener(CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT, onInvalidate);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
            window.clearInterval(pollId);
            unsubPush();
        };
    }, [shouldTrack, refresh]);

    return {
        count,
        badge: useMemo(() => formatBadge(count), [count]),
        outgoingPending,
        incomingNew,
    };
}
