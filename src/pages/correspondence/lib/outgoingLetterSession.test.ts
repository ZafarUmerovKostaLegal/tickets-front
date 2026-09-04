import { describe, expect, it } from 'vitest';
import { buildInvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { isOutgoingLetterDraftValid, resolveOutgoingCounterparty } from './outgoingLetterSession';
import { outgoingLetterPdfFileName } from './buildOutgoingLetterPdf';
import { outgoingLetterDocxFileName } from './buildOutgoingLetterDocx';
import { isWordLetterFile } from './openOutgoingLetterInWord';

describe('outgoing letter draft validation', () => {
    it('requires subject and recipient company', () => {
        const empty = buildInvoiceCoverLetterModel({
            issueDateIso: '2026-08-04',
            clientName: '',
            clientAddress: null,
            contactName: null,
            totalAmount: null,
            currency: 'USD',
        });
        expect(isOutgoingLetterDraftValid('', empty).ok).toBe(false);
        expect(isOutgoingLetterDraftValid('Тема', empty).ok).toBe(false);

        const filled = {
            ...empty,
            recipientCompany: 'Acme LLC',
        };
        expect(resolveOutgoingCounterparty(filled)).toBe('Acme LLC');
        expect(isOutgoingLetterDraftValid('Тема', filled).ok).toBe(true);
    });

    it('builds a safe pdf file name', () => {
        expect(outgoingLetterPdfFileName('Договор / тест*', '2026-08-04')).toBe('ИСХ_Договор___тест__2026-08-04.pdf');
    });

    it('builds a safe docx file name and detects Word files', () => {
        expect(outgoingLetterDocxFileName('Договор / тест*', '2026-08-04')).toBe('ИСХ_Договор___тест__2026-08-04.docx');
        expect(isWordLetterFile(new File(['x'], 'letter.docx'))).toBe(true);
        expect(isWordLetterFile(new File(['x'], 'scan.pdf'))).toBe(false);
    });
});
