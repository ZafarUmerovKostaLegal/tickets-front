import { invalidatePartnerReportConfirmationsCache } from '../api/monolith';
import { invalidatePartnerReportConfirmationsPendingCache } from '../api/partnerReportConfirmationsPending';
import { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT } from './partnerConfirmedReportsEvents';

export { PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT };

export function notifyPartnerConfirmedReportsListInvalidate(): void {
    invalidatePartnerReportConfirmationsPendingCache();
    invalidatePartnerReportConfirmationsCache();
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT));
}
