import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { fetchVacationLeavePendingBadgeCount } from '../api';
import { VACATION_LEAVE_REQUESTS_INVALIDATE_EVENT } from '../model/vacationLeaveRequestEvents';
import {
    formatVacationLeavePendingBadge,
    type VacationLeavePendingBadgeCounts,
} from './vacationLeavePendingBadge';

const EMPTY_COUNTS: VacationLeavePendingBadgeCounts = {
    count: 0,
    toDecideCount: 0,
    minePendingCount: 0,
};

export function useVacationLeavePendingBadge(enabled = true): {
    counts: VacationLeavePendingBadgeCounts;
    badge: string;
    toDecideBadge: string;
    minePendingBadge: string;
} {
    const { user } = useCurrentUser();
    const [counts, setCounts] = useState<VacationLeavePendingBadgeCounts>(EMPTY_COUNTS);
    const shouldTrack = enabled && user != null;

    const refresh = useCallback(async () => {
        if (!shouldTrack) {
            setCounts(EMPTY_COUNTS);
            return;
        }
        try {
            setCounts(await fetchVacationLeavePendingBadgeCount());
        }
        catch {
            setCounts(EMPTY_COUNTS);
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
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                void refresh();
        };
        window.addEventListener(VACATION_LEAVE_REQUESTS_INVALIDATE_EVENT, onInvalidate);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener(VACATION_LEAVE_REQUESTS_INVALIDATE_EVENT, onInvalidate);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [shouldTrack, refresh]);

    return {
        counts,
        badge: useMemo(() => formatVacationLeavePendingBadge(counts.count), [counts.count]),
        toDecideBadge: useMemo(() => formatVacationLeavePendingBadge(counts.toDecideCount), [counts.toDecideCount]),
        minePendingBadge: useMemo(() => formatVacationLeavePendingBadge(counts.minePendingCount), [counts.minePendingCount]),
    };
}
