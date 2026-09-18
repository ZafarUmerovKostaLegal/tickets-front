/** Ticket status value from API (Russian label used as value). */
export const TICKET_STATUS_ON_APPROVAL = 'На согласовании';

export function isTicketOnApprovalStatus(status: string | null | undefined): boolean {
    const s = (status ?? '').trim().toLowerCase();
    return s === TICKET_STATUS_ON_APPROVAL.toLowerCase()
        || s.includes('соглас')
        || s.includes('approval');
}
