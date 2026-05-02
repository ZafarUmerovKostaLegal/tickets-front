/** Константы фирмы для сопроводительного письма к счёту (первый лист). */
export const KOSTA_LEGAL_FIRM = {
    brandName: 'KOSTA LEGAL',
    addressLine: '18 Anhor Buyi Street, 100011, Tashkent, Uzbekistan',
    phone: 'tel.: +998 71 209 02 40',
    email: 'info@kostalegal.com',
    web: 'www.kostalegal.com',
    defaultSignatoryName: 'Azizbek Akhmadjonov',
    defaultSignatoryTitle: 'Partner',
} as const;

export type InvoiceCoverLetterInput = {
    issueDateIso: string;
    clientName: string;
    clientAddress: string | null;
    contactName: string | null;
    totalAmount: number | null;
    currency: string;
};

export type InvoiceCoverLetterModel = {
    letterDateDisplay: string;
    recipientCompany: string;
    recipientAddressLines: [string, string];
    attentionName: string;
    attentionTitle: string;
    quotedCompanyName: string;
    servicesMonthYear: string;
    totalFormatted: string;
    signatoryName: string;
    signatoryTitle: string;
};

function letterDateEn(isoYmd: string): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}/.test(isoYmd))
        return '—';
    const d = new Date(`${isoYmd.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return isoYmd;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function servicesMonthYearEn(isoYmd: string): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}/.test(isoYmd))
        return 'Month 2026';
    const d = new Date(`${isoYmd.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return 'Month 2026';
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Формат суммы как в примере: «EUR 3 845,83» (пробел как разделитель тысяч). */
export function formatCoverLetterTotal(amount: number | null, currency: string): string {
    const cur = (currency || 'EUR').trim().toUpperCase() || 'EUR';
    if (amount == null || !Number.isFinite(amount))
        return `${cur} 0 000,00`;
    const neg = amount < 0;
    const v = Math.abs(amount);
    const [intRaw, frac = '00'] = v.toFixed(2).split('.');
    const intPart = intRaw!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const num = `${intPart},${frac}`;
    return neg ? `−${cur} ${num}` : `${cur} ${num}`;
}

function splitAddress(raw: string | null): [string, string] {
    if (!raw || !raw.trim())
        return ['Full address', ''];
    const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length >= 2)
        return [lines[0]!, lines.slice(1).join(', ')];
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2)
        return [parts[0]!, parts.slice(1).join(', ')];
    return [lines[0] ?? raw.trim(), ''];
}

export function buildInvoiceCoverLetterModel(input: InvoiceCoverLetterInput): InvoiceCoverLetterModel {
    const iso = input.issueDateIso.slice(0, 10);
    const [a1, a2] = splitAddress(input.clientAddress);
    const company = input.clientName.trim() || 'Company Name';
    const contact = (input.contactName ?? '').trim();
    return {
        letterDateDisplay: letterDateEn(iso),
        recipientCompany: company,
        recipientAddressLines: [
            a1 || 'Full address',
            a2,
        ],
        attentionName: contact || 'Mr./Ms. Name Surname',
        attentionTitle: 'Position',
        quotedCompanyName: company,
        servicesMonthYear: servicesMonthYearEn(iso),
        totalFormatted: formatCoverLetterTotal(input.totalAmount, input.currency),
        signatoryName: KOSTA_LEGAL_FIRM.defaultSignatoryName,
        signatoryTitle: KOSTA_LEGAL_FIRM.defaultSignatoryTitle,
    };
}
