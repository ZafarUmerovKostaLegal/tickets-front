
export const KOSTA_LEGAL_FIRM = {
    brandName: 'KOSTA LEGAL',
    addressLine: '18 Anhor Buyi Street, 100011, Tashkent, Uzbekistan',
    phone: 'tel.: +998 71 209 02 40',
    email: 'info@kostalegal.com',
    web: 'www.kostalegal.com',
    defaultSignatoryName: 'Azizbek Akhmadjonov',
    defaultSignatoryTitle: 'Partner',
} as const;

export type InvoiceCoverLanguage = 'ENG' | 'RU';

export type InvoiceCoverLetterInput = {
    issueDateIso: string;
    clientName: string;
    clientAddress: string | null;
    contactName: string | null;
    totalAmount: number | null;
    currency: string;
    coverLanguage?: InvoiceCoverLanguage;
};

export type InvoiceCoverLetterModel = {
    coverLanguage: InvoiceCoverLanguage;
    issueDateIso: string;
    letterDateDisplay: string;
    recipientCompany: string;
    recipientAddressLines: [string, string];
    attentionName: string;
    attentionTitle: string;
    quotedCompanyName: string;
    servicesMonthYear: string;
    totalFormatted: string;
    signatoryName: string;
    /** Partner initials matching `public/signatures/{initials}.*` when known. */
    signatoryInitials: string;
    signatoryTitle: string;

    introParagraphOverride?: string | null;

    invoiceParagraphOverride?: string | null;
};

export {
    formatCoverLetterDate,
    formatCoverServicesPeriod,
    getCoverLetterLabels,
    normalizeCoverLanguage,
    resolveLocalizedCoverIntroParagraph as resolveCoverIntroParagraph,
    resolveLocalizedCoverInvoiceParagraph as resolveCoverInvoiceParagraph,
} from './invoiceCoverLetterI18n';

import {
    formatCoverLetterDate,
    formatCoverServicesPeriod,
    getCoverLetterLabels,
    normalizeCoverLanguage,
} from './invoiceCoverLetterI18n';
import { findCoverSignatoryPartnerByName } from './invoiceCoverSignature';
import { formatTimeReportAmount } from './invoiceTimeReportModel';

export function formatCoverLetterTotal(amount: number | null, currency: string): string {
    if (amount == null || !Number.isFinite(amount))
        return formatTimeReportAmount(0, currency);
    return formatTimeReportAmount(amount, currency);
}

function splitAddress(raw: string | null, lang: InvoiceCoverLanguage): [string, string] {
    const fallback = getCoverLetterLabels(lang).defaultAddress;
    if (!raw || !raw.trim())
        return [fallback, ''];
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length >= 2)
        return [lines[0]!, lines.slice(1).join(', ')];
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2)
        return [parts[0]!, parts.slice(1).join(', ')];
    return [lines[0] ?? raw.trim(), ''];
}

export function buildInvoiceCoverLetterModel(input: InvoiceCoverLetterInput): InvoiceCoverLetterModel {
    const lang = normalizeCoverLanguage(input.coverLanguage);
    const labels = getCoverLetterLabels(lang);
    const iso = input.issueDateIso.slice(0, 10);
    const [a1, a2] = splitAddress(input.clientAddress, lang);
    const company = input.clientName.trim() || 'Company Name';
    const contact = (input.contactName ?? '').trim();
    return {
        coverLanguage: lang,
        issueDateIso: iso,
        letterDateDisplay: formatCoverLetterDate(iso, lang),
        recipientCompany: company,
        recipientAddressLines: [
            a1 || labels.defaultAddress,
            a2,
        ],
        attentionName: contact || labels.defaultAttentionName,
        attentionTitle: labels.defaultAttentionTitle,
        quotedCompanyName: company,
        servicesMonthYear: formatCoverServicesPeriod(iso, lang),
        totalFormatted: formatCoverLetterTotal(input.totalAmount, input.currency),
        signatoryName: KOSTA_LEGAL_FIRM.defaultSignatoryName,
        signatoryInitials: findCoverSignatoryPartnerByName(KOSTA_LEGAL_FIRM.defaultSignatoryName)?.initials
            ?? 'AAA',
        signatoryTitle: labels.defaultSignatoryTitle,
    };
}
