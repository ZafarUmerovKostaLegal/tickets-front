import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { fetchCorrespondenceStats } from '../api';
import {
    CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT,
} from './partnerAttentionEvents';

function formatBadge(count: number): string {
    if (count <= 0)
        return '';
    return count > 99 ? '99+' : String(count);
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
    const shouldTrack = enabled
        && user != null
        && isPartnerOrgRole(user.role, user.position);

    const refresh = useCallback(async () => {
        if (!shouldTrack) {
            setCount(0);
            setOutgoingPending(0);
            setIncomingNew(0);
            return;
        }
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
    }, [shouldTrack]);

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
        window.addEventListener(CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT, onInvalidate);
        window.addEventListener('focus', onFocus);
        return () => {
            window.removeEventListener(CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT, onInvalidate);
            window.removeEventListener('focus', onFocus);
        };
    }, [shouldTrack, refresh]);

    return {
        count,
        badge: useMemo(() => formatBadge(count), [count]),
        outgoingPending,
        incomingNew,
    };
}
