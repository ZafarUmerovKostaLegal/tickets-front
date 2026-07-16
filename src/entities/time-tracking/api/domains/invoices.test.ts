import { describe, expect, it } from 'vitest';
import { coalesceInvoiceMoney, mergeInvoiceDtoAfterPayment, type InvoiceDto, type InvoicePaymentDto } from './invoices';

function payment(partial: Partial<InvoicePaymentDto> & Pick<InvoicePaymentDto, 'id' | 'amount'>): InvoicePaymentDto {
    return {
        paymentMethod: null,
        note: null,
        recordedByAuthUserId: 1,
        paidAt: '2026-07-02T00:00:00Z',
        createdAt: '2026-07-02T00:00:00Z',
        ...partial,
    };
}

function invoice(partial: Partial<InvoiceDto> & Pick<InvoiceDto, 'id'>): InvoiceDto {
    return {
        clientId: 'c1',
        projectId: 'p1',
        invoiceNumber: 'INV-1',
        issueDate: '2026-07-01',
        dueDate: '2026-07-15',
        currency: 'USD',
        status: 'sent',
        storedStatus: 'sent',
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
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: null,
        payments: [],
        lines: [],
        ...partial,
    };
}

describe('mergeInvoiceDtoAfterPayment', () => {
    it('prefers fetched when paid amount is higher', () => {
        const posted = invoice({ id: '1', amountPaid: 10, status: 'partial_paid' });
        const fetched = invoice({ id: '1', amountPaid: 50, status: 'partial_paid' });
        expect(mergeInvoiceDtoAfterPayment(posted, fetched)).toBe(fetched);
    });

    it('prefers posted when it has more payments', () => {
        const posted = invoice({
            id: '1',
            amountPaid: 40,
            payments: [payment({ id: 'p1', amount: 40 })],
            status: 'partial_paid',
        });
        const fetched = invoice({ id: '1', amountPaid: 40, payments: [], status: 'sent' });
        expect(mergeInvoiceDtoAfterPayment(posted, fetched)).toBe(posted);
    });

    it('prefers higher-ranked status when money ties', () => {
        const posted = invoice({ id: '1', amountPaid: 100, status: 'partial_paid' });
        const fetched = invoice({ id: '1', amountPaid: 100, status: 'paid' });
        expect(mergeInvoiceDtoAfterPayment(posted, fetched)).toBe(fetched);
    });
});

describe('coalesceInvoiceMoney', () => {
    it('parses numbers and locale-ish strings', () => {
        expect(coalesceInvoiceMoney(undefined, '1 234,5', 9)).toBe(1234.5);
        expect(coalesceInvoiceMoney(null, '', 'x', 7)).toBe(7);
        expect(coalesceInvoiceMoney()).toBe(0);
    });
});
