import { describe, expect, it } from 'vitest';
import { buildInvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import {
    applyCoverLetterLanguage,
    formatCoverLetterDate,
    formatCoverServicesPeriod,
    resolveLocalizedCoverIntroParagraph,
    resolveLocalizedCoverInvoiceParagraph,
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
        expect(resolveLocalizedCoverInvoiceParagraph(model)).toContain('EUR 3 250,50');
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
        expect(resolveLocalizedCoverIntroParagraph(ru)).toMatch(/юридическую помощь/i);
    });
});
