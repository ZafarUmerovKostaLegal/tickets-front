/** Событие для принудительного обновления списка подтверждённых партнёрских отчётов (см. FRONTEND_CONFIRMED_PARTNER_REPORTS.md). */
export const PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT = 'tt-partner-confirmed-reports-invalidate';

export function notifyPartnerConfirmedReportsListInvalidate(): void {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT));
}
