import type { PartnerReportConfirmationRequest } from '@entities/time-tracking';

export function partnerReportIsEmpty(row: PartnerReportConfirmationRequest): boolean {
    if (row.isEmpty === true)
        return true;
    if (row.isEmpty === false)
        return false;
    if (row.entryCount != null)
        return row.entryCount <= 0;
    return false;
}

export function PartnerReportEmptyBadge({ label, title }: { label: string; title?: string }) {
    return (
        <span className="tt-partner-confirmed__empty-badge" title={title ?? label}>
            {label}
        </span>
    );
}
