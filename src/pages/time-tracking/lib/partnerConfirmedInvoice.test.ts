import { describe, expect, it } from 'vitest';
import type { InvoiceDto, PartnerReportConfirmationRequest } from '@entities/time-tracking';
import { findInvoiceForPartnerConfirmedRow } from './partnerConfirmedInvoice';

function baseRow(partial?: Partial<PartnerReportConfirmationRequest>): PartnerReportConfirmationRequest {
    return {
        id: 'req-1',
        snapshotId: 'snap-1',
        projectId: 'proj-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        title: 'Report',
        status: 'fully_confirmed',
        submittedByAuthUserId: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
        signatures: [],
        reviewPriority: 'green',
        requiredPartnerAuthUserIds: [],
        pendingPartnerAuthUserIds: [],
        ...partial,
    } as PartnerReportConfirmationRequest;
}

function baseInv(partial?: Partial<InvoiceDto>): InvoiceDto {
    return {
        id: 'inv-1',
        clientId: 'c1',
        projectId: 'proj-1',
        invoiceNumber: 'INV-1',
        issueDate: '2026-02-01',
        dueDate: '2026-03-01',
        currency: 'EUR',
        status: 'draft',
        storedStatus: 'draft',
        subtotal: 100,
        discountPercent: null,
        taxPercent: null,
        tax2Percent: null,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 100,
        amountPaid: 0,
        balanceDue: 100,
        clientNote: null,
        internalNote: null,
        sentAt: null,
        lastSentAt: null,
        viewedAt: null,
        canceledAt: null,
        createdByAuthUserId: 1,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: null,
        partnerBillingPeriodFrom: '2026-01-01',
        partnerBillingPeriodTo: '2026-01-31',
        partnerConfirmationRequestId: 'req-1',
        ...partial,
    };
}

describe('findInvoiceForPartnerConfirmedRow', () => {
    it('links active invoice by confirmation request id', () => {
        const found = findInvoiceForPartnerConfirmedRow(baseRow(), [baseInv()]);
        expect(found?.id).toBe('inv-1');
    });

    it('ignores canceled invoices so regenerate stays available', () => {
        const found = findInvoiceForPartnerConfirmedRow(baseRow(), [
            baseInv({ status: 'canceled', storedStatus: 'canceled' }),
        ]);
        expect(found).toBeNull();
    });
});
