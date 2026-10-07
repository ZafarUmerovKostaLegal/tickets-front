import { describe, expect, it } from 'vitest';
import { buildInvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import {
    applyCoverLetterLanguage,
    formatCoverLetterDate,
    formatCoverServicesPeriod,
    formatCoverServicesPeriodRange,
    resolveLocalizedCoverIntroParagraph,
    resolveLocalizedCoverInvoiceParagraph,
    syncStaleCoverTotalInText,
} from './invoiceCoverLetterI18n';

describe('invoiceCoverLetterI18n', () => {
    it('builds Russian cover letter from project language', () => {
        const model = buildInvoiceCoverLetterModel({
            issueDateIso: '2026-07-20',
            clientName: 'GOR INVESTMENT',
            clientAddress: 'Full address',
            contactName: null,
            totalAmount: 3250.5,
            currency: 'EUR',
            coverLanguage: 'RU',
        });
        expect(model.coverLanguage).toBe('RU');
        expect(model.letterDateDisplay).toContain('2026');
        expect(model.servicesMonthYear).toBe('июле 2026 года');
        expect(resolveLocalizedCoverIntroParagraph(model)).toContain('GOR INVESTMENT');
        expect(resolveLocalizedCoverInvoiceParagraph(model)).toContain('EUR 3,250.50');
    });

    it('keeps extra client address lines so tax and city stay on the invoice', () => {
        const model = buildInvoiceCoverLetterModel({
            issueDateIso: '2026-08-26',
            clientName: 'Baker McKenzie LLP',
            clientAddress: [
                'Al Fattan Currency House Level 16, Tower 2',
                'PO Box 507176 DIFC Dubai, United Arab Emirates',
                'TAX #: 104020839700003',
            ].join('\n'),
            contactName: null,
            totalAmount: 7000,
            currency: 'USD',
            coverLanguage: 'ENG',
        });
        expect(model.recipientAddressLines[0]).toBe('Al Fattan Currency House Level 16, Tower 2');
        expect(model.recipientAddressLines[1]).toContain('DIFC Dubai');
        expect(model.recipientAddressLines[1]).toContain('TAX #: 104020839700003');
        expect(model.recipientAddressLines[1]).not.toContain(', TAX #');
    });

    it('switches language and refreshes template fields', () => {
        const eng = buildInvoiceCoverLetterModel({
            issueDateIso: '2026-07-20',
            clientName: 'GOR INVESTMENT',
            clientAddress: null,
            contactName: null,
            totalAmount: 3250.5,
            currency: 'EUR',
            coverLanguage: 'ENG',
        });
        const ru = applyCoverLetterLanguage(eng, 'RU', '2026-07-20');
        expect(ru.coverLanguage).toBe('RU');
        expect(formatCoverLetterDate('2026-07-20', 'RU')).toContain('июл');
        expect(formatCoverServicesPeriod('2026-07-20', 'ENG')).toBe('July 2026');
        expect(formatCoverServicesPeriodRange('2026-07-01', '2026-08-31', 'ENG')).toBe('July and August 2026');
        expect(formatCoverServicesPeriodRange('2026-07-01', '2026-08-31', 'RU')).toBe('июле и августе 2026 года');
        expect(buildInvoiceCoverLetterModel({
            issueDateIso: '2026-09-04',
            billingPeriodFromIso: '2026-07-01',
            billingPeriodIso: '2026-08-31',
            clientName: 'GOR',
            clientAddress: null,
            contactName: null,
            totalAmount: 1,
            currency: 'UZS',
            coverLanguage: 'ENG',
        }).servicesMonthYear).toBe('July and August 2026');
        expect(resolveLocalizedCoverIntroParagraph(ru)).toMatch(/юридическую помощь/i);
    });

    it('rewrites FX-cent total inside a saved invoice paragraph override', () => {
        const model = buildInvoiceCoverLetterModel({
            issueDateIso: '2026-10-07',
            clientName: 'ALLIED GREEN AMMONIA',
            clientAddress: null,
            contactName: 'Mr. Alfred Benedict',
            totalAmount: 596.6,
            currency: 'USD',
            coverLanguage: 'ENG',
        });
        model.invoiceParagraphOverride = 'Herewith, we are sending the report with the invoice on legal services rendered in September 2026 for the total amount of USD 596.61.';
        expect(resolveLocalizedCoverInvoiceParagraph(model)).toContain('USD 596.60');
        expect(resolveLocalizedCoverInvoiceParagraph(model)).not.toContain('USD 596.61');
        expect(syncStaleCoverTotalInText(
            'на общую сумму USD 596.61.',
            'USD 596.60',
        )).toBe('на общую сумму USD 596.60.');
    });
});
