import { describe, expect, it } from 'vitest';
import {
    applyCoverDocumentOverrides,
    buildInvoiceDocumentOverridesPayload,
    parseInvoiceDocumentOverrides,
} from './invoiceDocumentOverrides';
import { buildInvoiceCoverLetterModel } from './invoiceCoverLetterModel';

describe('parseInvoiceDocumentOverrides', () => {
    it('accepts v1 payload with legal invoice number', () => {
        const parsed = parseInvoiceDocumentOverrides({
            v: 1,
            legal: { invoiceNumber: 'INV-1' },
        });
        expect(parsed?.legal?.invoiceNumber).toBe('INV-1');
    });

    it('rejects unknown versions', () => {
        expect(parseInvoiceDocumentOverrides({ v: 2, legal: {} })).toBeNull();
    });
});

describe('buildInvoiceDocumentOverridesPayload', () => {
    it('round-trips cover and legal fields', () => {
        const cover = buildInvoiceCoverLetterModel({
            issueDateIso: '2024-08-04',
            clientName: 'GBI',
            clientAddress: null,
            contactName: null,
            totalAmount: 208.39,
            currency: 'USD',
        });
        const payload = buildInvoiceDocumentOverridesPayload({
            legal: { invoiceNumber: 'INV-2024-00083', caseDetailLine: 'Commercial' },
            cover,
            timeReport: {
                currency: 'USD',
                detailSlots: [],
                expenseSlots: [],
                summarySlots: [],
                detailTotalHoursDisplay: '',
                detailTotalAmountDisplay: '',
                expenseTotalAmountDisplay: '',
                summaryGrandHoursDisplay: '',
                summaryGrandAmountDisplay: '',
            },
        });
        expect(payload.v).toBe(1);
        expect(payload.legal?.invoiceNumber).toBe('INV-2024-00083');
        const applied = applyCoverDocumentOverrides(cover, payload.cover);
        expect(applied.recipientCompany).toBe(cover.recipientCompany);
    });
});
