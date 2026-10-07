export const KOSTA_LEGAL_FIRM = {
    brandName: 'KOSTA LEGAL',
    addressLine: '18 Anhor Buyi Street, 100011, Tashkent, Uzbekistan',
    phone: 'tel.: +998 71 209 02 40',
    email: 'info@kostalegal.com',
    web: 'www.kostalegal.com',
    defaultSignatoryName: 'Azizbek Akhmadjonov',
    defaultSignatoryTitle: 'Partner',
};
/** Right-hand letterhead on the combined fees sheet. */
export const KOSTA_LEGAL_LETTERHEAD_LINES = [
    '18 Anhor Buyi Street',
    '100011, Tashkent, Uzbekistan',
    KOSTA_LEGAL_FIRM.phone,
    KOSTA_LEGAL_FIRM.email,
    KOSTA_LEGAL_FIRM.web,
];
export { formatCoverLetterDate, formatCoverServicesPeriod, getCoverLetterLabels, normalizeCoverLanguage, resolveLocalizedCoverIntroParagraph as resolveCoverIntroParagraph, resolveLocalizedCoverInvoiceParagraph as resolveCoverInvoiceParagraph, } from './invoiceCoverLetterI18n';
import { formatCoverLetterDate, formatCoverServicesPeriodRange, getCoverLetterLabels, normalizeCoverLanguage, } from './invoiceCoverLetterI18n';
import { findCoverSignatoryPartnerByName } from './invoiceCoverSignature';
import { formatTimeReportAmount } from './invoiceTimeReportModel';
export function formatCoverLetterTotal(amount, currency) {
    if (amount == null || !Number.isFinite(amount))
        return formatTimeReportAmount(0, currency);
    return formatTimeReportAmount(amount, currency);
}
function splitAddress(raw, lang) {
    const fallback = getCoverLetterLabels(lang).defaultAddress;
    if (!raw || !raw.trim())
        return [fallback, ''];
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length >= 2)
        return [lines[0], lines.slice(1).join('\n')];
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2)
        return [parts[0], parts.slice(1).join(', ')];
    return [lines[0] ?? raw.trim(), ''];
}
export function buildInvoiceCoverLetterModel(input) {
    const lang = normalizeCoverLanguage(input.coverLanguage);
    const labels = getCoverLetterLabels(lang);
    const iso = input.issueDateIso.slice(0, 10);
    const periodRaw = (input.billingPeriodIso ?? iso).slice(0, 10);
    const periodIso = /^\d{4}-\d{2}-\d{2}$/.test(periodRaw) ? periodRaw : iso;
    const fromRaw = (input.billingPeriodFromIso ?? periodIso).slice(0, 10);
    const periodFromIso = /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : periodIso;
    const [a1, a2] = splitAddress(input.clientAddress, lang);
    const company = input.clientName.trim() || 'Company Name';
    const contact = (input.contactName ?? '').trim();
    return {
        coverLanguage: lang,
        issueDateIso: iso,
        billingPeriodIso: periodIso,
        billingPeriodFromIso: periodFromIso,
        letterDateDisplay: formatCoverLetterDate(iso, lang),
        recipientCompany: company,
        recipientAddressLines: [
            a1 || labels.defaultAddress,
            a2,
        ],
        attentionName: contact || labels.defaultAttentionName,
        attentionTitle: labels.defaultAttentionTitle,
        quotedCompanyName: company,
        servicesMonthYear: formatCoverServicesPeriodRange(periodFromIso, periodIso, lang),
        totalFormatted: formatCoverLetterTotal(input.totalAmount, input.currency),
        signatoryName: KOSTA_LEGAL_FIRM.defaultSignatoryName,
        signatoryInitials: findCoverSignatoryPartnerByName(KOSTA_LEGAL_FIRM.defaultSignatoryName)?.initials
            ?? 'AAA',
        signatoryTitle: labels.defaultSignatoryTitle,
    };
}
