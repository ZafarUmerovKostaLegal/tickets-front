import { describe, expect, it } from 'vitest';
import {
    applyCoverDocumentOverrides,
    buildInvoiceDocumentOverridesPayload,
    parseInvoiceDocumentOverrides,
    scrubStaleBillingPeriodDocumentOverrides,
} from './invoiceDocumentOverrides';
import { buildInvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import { formatLegalRibbonPeriodMonth } from './invoiceLegalPageI18n';

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

describe('scrubStaleBillingPeriodDocumentOverrides', () => {
    it('clears issue-month ribbon and auto service line when period is earlier', () => {
        const issue = '2026-08-05';
        const period = '2026-07-31';
        const scrubbed = scrubStaleBillingPeriodDocumentOverrides({
            v: 1,
            legal: {
                issueDateDisplay: formatLegalRibbonPeriodMonth(issue, 'ENG'),
                serviceDescriptionLine: 'Legal services rendered in August 2026',
            },
            cover: { servicesMonthYear: 'August 2026' },
        }, { issueDateIso: issue, billingPeriodIso: period });
        expect(scrubbed?.legal?.issueDateDisplay).toBeNull();
        expect(scrubbed?.legal?.serviceDescriptionLine).toBeNull();
        expect(scrubbed?.cover?.servicesMonthYear).toBeUndefined();
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
