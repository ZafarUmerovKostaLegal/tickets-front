import { describe, expect, it } from 'vitest';
import { isTicketOnApprovalStatus, TICKET_STATUS_ON_APPROVAL } from './ticketApproval';

describe('isTicketOnApprovalStatus', () => {
    it('matches canonical status', () => {
        expect(isTicketOnApprovalStatus(TICKET_STATUS_ON_APPROVAL)).toBe(true);
    });

    it('matches approval heuristics', () => {
        expect(isTicketOnApprovalStatus('pending_approval')).toBe(true);
        expect(isTicketOnApprovalStatus('В работе')).toBe(false);
    });
});
