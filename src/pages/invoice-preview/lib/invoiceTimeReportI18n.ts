import {
    INVOICE_DESCRIPTION_TASK_PREFIXES,
} from '@pages/time-tracking/lib/invoiceClientDescription';
import {
    formatCoverServicesPeriodFromIsoDates,
    normalizeCoverLanguage,
    type InvoiceCoverLanguage,
} from './invoiceCoverLetterI18n';
import type { InvoiceTimeReportDetailRow, InvoiceTimeReportPack } from './invoiceTimeReportModel';

export type TimeReportLabels = {
    confidential: string;
    title: (servicesMonthYear: string) => string;
    titleContinued: (servicesMonthYear: string) => string;
    date: string;
    initials: string;
    task: string;
    description: string;
    initiatorName: string;
    hours: string;
    rate: string;
    amount: (currency: string) => string;
    total: string;
    summaryTitle: string;
    expensesTitle: string;
    mehnatTitle: string;
    name: string;
    titleCol: string;
    hourlyRate: string;
    totalPrice: (currency: string) => string;
};

export function isoDateFromTimeReportDisplay(display: string): string | null {
    const raw = String(display ?? '').trim();
    const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmy)
        return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const iso = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function isoDatesFromTimeReportRows(rows: readonly InvoiceTimeReportDetailRow[] | undefined): string[] {
    const out: string[] = [];
    for (const row of rows ?? []) {
        const iso = isoDateFromTimeReportDisplay(row.date);
        if (iso)
            out.push(iso);
    }
    return out;
}

export function timeReportServicesMonthYear(
    pack: Pick<InvoiceTimeReportPack, 'detailSlots' | 'expenseSlots' | 'mehnatSlots'>,
    fallback: string,
    language: InvoiceCoverLanguage,
): string {
    const dates = [
        ...isoDatesFromTimeReportRows(pack.detailSlots),
        ...isoDatesFromTimeReportRows(pack.expenseSlots),
        ...isoDatesFromTimeReportRows(pack.mehnatSlots),
    ];
    if (dates.length === 0)
        return fallback;
    return formatCoverServicesPeriodFromIsoDates(dates, language);
}

export function isGeneratedTimeReportHeading(title: string | null | undefined): boolean {
    const t = String(title ?? '').replace(/\s+/g, ' ').trim();
    if (!t)
        return false;
    return /^(TIME REPORT FOR SERVICES PROVIDED IN |ОТЧЁТ О ВРЕМЕНИ ЗА УСЛУГИ, ОКАЗАННЫЕ В )/i.test(t);
}

export function timeReportHeading(opts: {
    language: InvoiceCoverLanguage;
    servicesMonthYear: string;
    continuation: boolean;
    reportTitle?: string | null;
    reportTitleContinued?: string | null;
}): string {
    const custom = (opts.continuation ? opts.reportTitleContinued : opts.reportTitle) ?? '';
    if (custom.trim() && !isGeneratedTimeReportHeading(custom))
        return custom.replace(/^\s+/, '');
    const labels = getTimeReportLabels(opts.language);
    return opts.continuation
        ? labels.titleContinued(opts.servicesMonthYear)
        : labels.title(opts.servicesMonthYear);
}

const LABELS: Record<InvoiceCoverLanguage, TimeReportLabels> = {
    ENG: {
        confidential: 'CONFIDENTIAL',
        title: (period) => `TIME REPORT FOR SERVICES PROVIDED IN ${period.toUpperCase()}`,
        titleContinued: (period) => `TIME REPORT FOR SERVICES PROVIDED IN ${period.toUpperCase()} — CONTINUED`,
        date: 'Date',
        initials: 'Initials',
        task: 'Task',
        description: 'Description',
        initiatorName: 'Name',
        hours: 'Hours',
        rate: 'Rate',
        amount: (cur) => (cur === 'EUR' ? 'Amount (EUR)' : `Amount (${cur})`),
        total: 'Total',
        summaryTitle: 'Summary of services',
        expensesTitle: 'Expenses',
        mehnatTitle: 'My Mehnat',
        name: 'Name',
        titleCol: 'Title',
        hourlyRate: 'Hourly rate',
        totalPrice: (cur) => `Total price (${cur})`,
    },
    RU: {
        confidential: 'КОНФИДЕНЦИАЛЬНО',
        title: (period) => `ОТЧЁТ О ВРЕМЕНИ ЗА УСЛУГИ, ОКАЗАННЫЕ В ${period.toUpperCase()}`,
        titleContinued: (period) => `ОТЧЁТ О ВРЕМЕНИ ЗА УСЛУГИ, ОКАЗАННЫЕ В ${period.toUpperCase()} — ПРОДОЛЖЕНИЕ`,
        date: 'Дата',
        initials: 'Инициалы',
        task: 'Задача',
        description: 'Описание',
        initiatorName: 'Имя',
        hours: 'Часы',
        rate: 'Ставка',
        amount: (cur) => `Сумма (${cur})`,
        total: 'Итого',
        summaryTitle: 'Сводка по услугам',
        expensesTitle: 'Расходы',
        mehnatTitle: 'My Mehnat',
        name: 'ФИО',
        titleCol: 'Должность',
        hourlyRate: 'Ставка',
        totalPrice: (cur) => `Итого (${cur})`,
    },
};

/** Known default project task names → Russian labels for client-facing reports. */
const TASK_LABEL_RU: Record<string, string> = {
    'court hearing preparation': 'Подготовка к судебному заседанию',
    'court hearing': 'Судебное заседание',
    'document submission': 'Подача документов',
    'document review': 'Просмотр документов',
    'drafting documents': 'Подготовка документов',
    drafting: 'Подготовка документов',
    'telephone calls': 'Телефонные звонки',
    'my mehnat registration': 'Регистрация My mehnat',
    'kosta legal internal': 'Внутренние дела Kosta Legal',
    'business development': 'Развитие бизнеса',
    'other research': 'Прочие исследования',
    'review new legislation': 'Обзор нового законодательства',
    emails: 'Электронная переписка',
    meetings: 'Встречи',
    research: 'Исследования',
    accounting: 'Бухгалтерия',
    'lunch/dinner': 'Обед/ужин',
    proposals: 'Предложения',
    publications: 'Публикации',
    expense: 'Расход',
    manual: 'Вручную',
    other: 'Прочее',
};

for (const prefix of INVOICE_DESCRIPTION_TASK_PREFIXES) {
    const key = prefix.toLowerCase();
    if (!(key in TASK_LABEL_RU))
        TASK_LABEL_RU[key] = prefix;
}

export function getTimeReportLabels(lang?: InvoiceCoverLanguage | null): TimeReportLabels {
    return LABELS[normalizeCoverLanguage(lang)];
}

export function formatTimeReportDateDisplay(
    iso: string | undefined | null,
    lang?: InvoiceCoverLanguage | null,
): string {
    void lang;
    const s = (iso ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '—';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}

export function localizeTimeReportTaskLabel(
    task: string | null | undefined,
    lang?: InvoiceCoverLanguage | null,
): string {
    const raw = (task ?? '').trim();
    if (!raw)
        return '';
    if (normalizeCoverLanguage(lang) !== 'RU')
        return raw;
    const mapped = TASK_LABEL_RU[raw.toLowerCase()];
    return mapped ?? raw;
}
