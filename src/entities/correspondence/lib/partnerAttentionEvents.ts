/** Dispatched after partner approve/reject/incoming register so hub badge refreshes. */
export const CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT =
    'correspondence:partner-attention-invalidate';

export function invalidateCorrespondencePartnerAttention(): void {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new Event(CORRESPONDENCE_PARTNER_ATTENTION_INVALIDATE_EVENT));
}
