import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

export type InvoiceCoverLanguage = 'ENG' | 'RU';

export type CoverLetterLabels = {
    attention: string;
    dear: string;
    closing: string;
    defaultAttentionName: string;
    defaultAttentionTitle: string;
    defaultAddress: string;
    defaultSignatoryTitle: string;
};

const LABELS: Record<InvoiceCoverLanguage, CoverLetterLabels> = {
    ENG: {
        attention: 'Attention',
        dear: 'Dear',
        closing: 'Kind regards,',
        defaultAttentionName: 'Mr./Ms. Name Surname',
        defaultAttentionTitle: 'Position',
        defaultAddress: 'Full address',
        defaultSignatoryTitle: 'Partner',
    },
    RU: {
        attention: 'Вниманию',
        dear: 'Уважаемый(ая)',
        closing: 'С уважением,',
        defaultAttentionName: 'г-н/г-жа Имя Фамилия',
        defaultAttentionTitle: 'Должность',
        defaultAddress: 'Полный адрес',
        defaultSignatoryTitle: 'Партнёр',
    },
};

const RU_MONTH_GENITIVE = [
    'январе',
    'феврале',
    'марте',
    'апреле',
    'мае',
    'июне',
    'июле',
    'августе',
    'сентябре',
    'октябре',
    'ноябре',
    'декабре',
] as const;

export function normalizeCoverLanguage(raw?: string | null): InvoiceCoverLanguage {
    return String(raw ?? '').trim().toUpperCase() === 'RU' ? 'RU' : 'ENG';
}

export function coverLanguageFromRecordsLanguage(recordsLanguage?: string | null): InvoiceCoverLanguage {
    return normalizeCoverLanguage(recordsLanguage);
}

export function getCoverLetterLabels(lang?: InvoiceCoverLanguage | null): CoverLetterLabels {
    return LABELS[normalizeCoverLanguage(lang)];
}

export function formatCoverLetterDate(isoYmd: string, lang: InvoiceCoverLanguage): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}/.test(isoYmd))
        return '—';
    const d = new Date(`${isoYmd.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return isoYmd;
    if (lang === 'RU') {
        const formatted = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        return formatted.endsWith(' г.') ? formatted : `${formatted} г.`;
    }
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatCoverServicesPeriod(isoYmd: string, lang: InvoiceCoverLanguage): string {
    if (!isoYmd || !/^\d{4}-\d{2}-\d{2}/.test(isoYmd))
        return lang === 'RU' ? 'месяц 2026 года' : 'Month 2026';
    const d = new Date(`${isoYmd.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return lang === 'RU' ? 'месяц 2026 года' : 'Month 2026';
    if (lang === 'RU') {
        const month = RU_MONTH_GENITIVE[d.getMonth()] ?? 'месяце';
        return `${month} ${d.getFullYear()} года`;
    }
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function resolveLocalizedCoverIntroParagraph(model: InvoiceCoverLetterModel): string {
    const custom = model.introParagraphOverride?.trim();
    if (custom)
        return custom;
    const lang = normalizeCoverLanguage(model.coverLanguage);
    if (lang === 'RU') {
        return `Мы рады оказать юридическую помощь «${model.quotedCompanyName}» в связи с её деятельностью в Узбекистане.`;
    }
    return `It is our pleasure to provide legal assistance to «${model.quotedCompanyName}» in connection with its activities in Uzbekistan.`;
}

export function resolveLocalizedCoverInvoiceParagraph(model: InvoiceCoverLetterModel): string {
    const custom = model.invoiceParagraphOverride?.trim();
    if (custom)
        return custom;
    const lang = normalizeCoverLanguage(model.coverLanguage);
    if (lang === 'RU') {
        return `Настоящим направляем отчёт и/или счёт за юридические услуги, оказанные в ${model.servicesMonthYear}, на общую сумму ${model.totalFormatted}.`;
    }
    return `Herewith, we are sending the report or/and with the invoice on legal services rendered in ${model.servicesMonthYear} for the total amount of ${model.totalFormatted}.`;
}

export function applyCoverLetterLanguage(
    model: InvoiceCoverLetterModel,
    lang: InvoiceCoverLanguage,
    issueDateIso: string,
): InvoiceCoverLetterModel {
    const nextLang = normalizeCoverLanguage(lang);
    const prevLang = normalizeCoverLanguage(model.coverLanguage);
    const prevLabels = getCoverLetterLabels(prevLang);
    const nextLabels = getCoverLetterLabels(nextLang);
    const iso = issueDateIso.slice(0, 10);

    const next: InvoiceCoverLetterModel = {
        ...model,
        coverLanguage: nextLang,
        issueDateIso: iso,
        letterDateDisplay: formatCoverLetterDate(iso, nextLang),
        servicesMonthYear: formatCoverServicesPeriod(iso, nextLang),
        introParagraphOverride: null,
        invoiceParagraphOverride: null,
    };

    if (
        model.signatoryTitle === prevLabels.defaultSignatoryTitle
        || model.signatoryTitle === 'Partner'
        || model.signatoryTitle === 'Партнёр'
    ) {
        next.signatoryTitle = nextLabels.defaultSignatoryTitle;
    }
    if (model.attentionTitle === prevLabels.defaultAttentionTitle)
        next.attentionTitle = nextLabels.defaultAttentionTitle;
    if (model.attentionName === prevLabels.defaultAttentionName)
        next.attentionName = nextLabels.defaultAttentionName;
    if (model.recipientAddressLines[0] === prevLabels.defaultAddress) {
        next.recipientAddressLines = [nextLabels.defaultAddress, model.recipientAddressLines[1] ?? ''];
    }

    return next;
}
