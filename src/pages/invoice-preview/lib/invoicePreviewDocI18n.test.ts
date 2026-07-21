import { describe, expect, it } from 'vitest';
import {
    formatTimeReportDateDisplay,
    getTimeReportLabels,
    localizeTimeReportTaskLabel,
} from './invoiceTimeReportI18n';
import {
    formatLegalRibbonDate,
    getLegalInvoiceLabels,
    resolveLocalizedLegalServiceDescription,
} from './invoiceLegalPageI18n';
import { buildInvoiceCoverLetterModel } from './invoiceCoverLetterModel';

describe('invoiceTimeReportI18n', () => {
    it('returns Russian labels and title', () => {
        const labels = getTimeReportLabels('RU');
        expect(labels.date).toBe('Дата');
        expect(labels.confidential).toMatch(/конфиденциально/i);
        expect(labels.title('июле 2026 года')).toMatch(/ОТЧЁТ О ВРЕМЕНИ/i);
        expect(labels.titleContinued('июле 2026 года')).toMatch(/ПРОДОЛЖЕНИЕ/i);
        expect(labels.amount('EUR')).toBe('Сумма (EUR)');
    });

    it('formats dates and task labels by language', () => {
        expect(formatTimeReportDateDisplay('2026-06-08', 'ENG')).toMatch(/Jun/i);
        expect(formatTimeReportDateDisplay('2026-06-08', 'RU')).toMatch(/июн/i);
        expect(localizeTimeReportTaskLabel('Document Review', 'RU')).toBe('Просмотр документов');
        expect(localizeTimeReportTaskLabel('Telephone calls', 'ENG')).toBe('Telephone calls');
    });
});

describe('invoiceLegalPageI18n', () => {
    it('localizes legal invoice strings', () => {
        const labels = getLegalInvoiceLabels('RU');
        expect(labels.invoiceNo('INV-1')).toBe('СЧЁТ № INV-1');
        expect(labels.billTo).toBe('Плательщик');
        expect(formatLegalRibbonDate('2026-07-09', 'RU')).toMatch(/ИЮЛ/i);

        const model = buildInvoiceCoverLetterModel({
            issueDateIso: '2026-07-20',
            clientName: 'GOR',
            clientAddress: null,
            contactName: null,
            totalAmount: 1,
            currency: 'EUR',
            coverLanguage: 'RU',
        });
        expect(resolveLocalizedLegalServiceDescription(model)).toMatch(/Юридические услуги/i);
    });
});
