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

const EN_MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
] as const;

function parseIsoMonth(isoYmd: string): { year: number; month: number } | null {
    const s = isoYmd.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return null;
    const d = new Date(`${s}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return null;
    return { year: d.getFullYear(), month: d.getMonth() };
}

function joinWithAnd(items: string[], andWord: string): string {
    if (items.length <= 1)
        return items[0] ?? '';
    if (items.length === 2)
        return `${items[0]} ${andWord} ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} ${andWord} ${items[items.length - 1]}`;
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
    return `${EN_MONTHS[d.getMonth()] ?? 'Month'} ${d.getFullYear()}`;
}

/** «July 2026» or «July and August 2026» when the billing period crosses months. */
export function formatCoverServicesPeriodRange(
    fromIso: string | null | undefined,
    toIso: string | null | undefined,
    lang: InvoiceCoverLanguage,
): string {
    const from = parseIsoMonth(fromIso ?? '');
    const to = parseIsoMonth(toIso ?? '');
    if (!from && !to)
        return formatCoverServicesPeriod('', lang);
    if (!from || !to || (from.year === to.year && from.month === to.month))
        return formatCoverServicesPeriod((toIso || fromIso || '').slice(0, 10), lang);

    let start = from;
    let end = to;
    if (start.year > end.year || (start.year === end.year && start.month > end.month)) {
        start = to;
        end = from;
    }

    const points: { year: number; month: number }[] = [];
    let year = start.year;
    let month = start.month;
    while (year < end.year || (year === end.year && month <= end.month)) {
        points.push({ year, month });
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
        if (points.length > 24)
            break;
    }

    const sameYear = start.year === end.year;
    if (lang === 'RU') {
        const names = points.map((p) => RU_MONTH_GENITIVE[p.month] ?? 'месяце');
        if (sameYear)
            return `${joinWithAnd(names, 'и')} ${end.year} года`;
        return joinWithAnd(points.map((p) => `${RU_MONTH_GENITIVE[p.month] ?? 'месяце'} ${p.year} года`), 'и');
    }
    const names = points.map((p) => EN_MONTHS[p.month] ?? 'Month');
    if (sameYear)
        return `${joinWithAnd(names, 'and')} ${end.year}`;
    return joinWithAnd(points.map((p) => `${EN_MONTHS[p.month] ?? 'Month'} ${p.year}`), 'and');
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
        servicesMonthYear: formatCoverServicesPeriodRange(
            model.billingPeriodFromIso || model.billingPeriodIso || iso,
            model.billingPeriodIso || iso,
            nextLang,
        ),
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
