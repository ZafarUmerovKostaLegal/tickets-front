import {
    normalizeCoverLanguage,
    type InvoiceCoverLanguage,
} from './invoiceCoverLetterI18n';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

export type LegalInvoiceLabels = {
    invoiceNo: (number: string) => string;
    invoiceNoPrefix: string;
    billTo: string;
    address: string;
    bankName: string;
    swift: string;
    caseDetails: string;
    description: string;
    total: (currency: string) => string;
    subtotal: string;
    vat: string;
    extraExpenses: string;
    totalDueBy: (dueBanner: string) => string;
    totalDueByPrefix: string;
    thanks: string;
    tin: string;
    bankAddress: string;
    accountNumber: (currency: string) => string;
    bankCode: string;
    correspondentBank: string;
    correspondentAccount: (currency: string) => string;
    serviceDescription: (servicesMonthYear: string) => string;
    paymentDisclaimer: string;
    legalServicesFallback: string;
};

const LABELS: Record<InvoiceCoverLanguage, LegalInvoiceLabels> = {
    ENG: {
        invoiceNo: (n) => `INVOICE No. ${n}`,
        invoiceNoPrefix: 'INVOICE No.',
        billTo: 'Bill to',
        address: 'Address',
        bankName: 'Bank name',
        swift: 'SWIFT',
        caseDetails: 'Case details',
        description: 'Description',
        total: (cur) => `Total (${cur})`,
        subtotal: 'SUBTOTAL',
        vat: 'VAT',
        extraExpenses: 'EXTRA EXPENSES',
        totalDueBy: (due) => `TOTAL DUE BY ${due}`,
        totalDueByPrefix: 'TOTAL DUE BY',
        thanks: 'Thank you for your business!',
        tin: 'TIN',
        bankAddress: 'Bank address',
        accountNumber: (cur) => `AC (${cur})`,
        bankCode: 'Bank code',
        correspondentBank: 'Correspondent bank',
        correspondentAccount: (cur) => `Corr. ACC (${cur})`,
        serviceDescription: (period) => `Legal services rendered in ${period}`,
        paymentDisclaimer: (
            'The payment under this invoice shall constitute the due acceptance of the Services by '
            + 'the Client. Perfection of a separate document on acceptance of the Services is not '
            + 'required.'
        ),
        legalServicesFallback: 'Legal services',
    },
    RU: {
        invoiceNo: (n) => `СЧЁТ № ${n}`,
        invoiceNoPrefix: 'СЧЁТ №',
        billTo: 'Плательщик',
        address: 'Адрес',
        bankName: 'Банк',
        swift: 'SWIFT',
        caseDetails: 'Детали дела',
        description: 'Описание',
        total: (cur) => `Итого (${cur})`,
        subtotal: 'ПРОМЕЖУТОЧНЫЙ ИТОГ',
        vat: 'НДС',
        extraExpenses: 'ДОП. РАСХОДЫ',
        totalDueBy: (due) => `ИТОГО К ОПЛАТЕ ДО ${due}`,
        totalDueByPrefix: 'ИТОГО К ОПЛАТЕ ДО',
        thanks: 'Благодарим за сотрудничество!',
        tin: 'ИНН',
        bankAddress: 'Адрес банка',
        accountNumber: (cur) => `Счёт (${cur})`,
        bankCode: 'Код банка',
        correspondentBank: 'Банк-корреспондент',
        correspondentAccount: (cur) => `Корр. счёт (${cur})`,
        serviceDescription: (period) => `Юридические услуги, оказанные в ${period}`,
        paymentDisclaimer: (
            'Оплата по настоящему счёту означает надлежащее принятие Услуг Клиентом. '
            + 'Отдельный акт приёмки Услуг не требуется.'
        ),
        legalServicesFallback: 'Юридические услуги',
    },
};

export function getLegalInvoiceLabels(lang?: InvoiceCoverLanguage | null): LegalInvoiceLabels {
    return LABELS[normalizeCoverLanguage(lang)];
}

export function formatLegalRibbonDate(
    isoYmd: string,
    lang?: InvoiceCoverLanguage | null,
): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}$/.test(isoYmd))
        return '—';
    const d = new Date(`${isoYmd}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    if (normalizeCoverLanguage(lang) === 'RU') {
        return d.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).toUpperCase();
    }
    return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).toUpperCase();
}

export function resolveLocalizedLegalServiceDescription(
    model: InvoiceCoverLetterModel,
    override?: string | null,
): string {
    const custom = override?.trim();
    if (custom)
        return custom;
    const labels = getLegalInvoiceLabels(model.coverLanguage);
    return labels.serviceDescription(model.servicesMonthYear);
}

export function resolveLocalizedLegalPaymentDisclaimer(
    lang?: InvoiceCoverLanguage | null,
    override?: string | null,
): string {
    const custom = override?.trim();
    if (custom)
        return custom;
    return getLegalInvoiceLabels(lang).paymentDisclaimer;
}
