import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { listPartnerReportConfirmationsPendingForBadge } from '../api/partnerReportConfirmationsPending';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from '../model/partnerConfirmedReportsEvents';
import { canViewTimeTrackingReports } from '../model/timeTrackingAccess';
import { countPartnerForReviewPendingSignature, formatPartnerForReviewBadge } from './partnerForReviewReports';

export function usePartnerForReviewBadge(enabled = true): {
    count: number;
    badge: string;
} {
    const { user } = useCurrentUser();
    const [count, setCount] = useState(0);
    const shouldTrack = enabled
        && user != null
        && canViewTimeTrackingReports(user)
        && isPartnerOrgRole(user.role, user.position);

    const refresh = useCallback(async () => {
        if (!shouldTrack || user?.id == null) {
            setCount(0);
            return;
        }
        try {
            const list = await listPartnerReportConfirmationsPendingForBadge();
            setCount(countPartnerForReviewPendingSignature(list, user.id));
        }
        catch {

        }
    }, [shouldTrack, user?.id]);

    useEffect(() => {
        if (!shouldTrack) {
            setCount(0);
            return;
        }
        void refresh();
    }, [shouldTrack, refresh]);

    useEffect(() => {
        if (!shouldTrack)
            return;
        const onInvalidate = () => {
            void refresh();
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInvalidate);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInvalidate);
    }, [shouldTrack, refresh]);

    const badge = useMemo(() => formatPartnerForReviewBadge(count), [count]);
    return { count, badge };
}
