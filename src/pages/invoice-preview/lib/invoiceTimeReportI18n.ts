import {
    INVOICE_DESCRIPTION_TASK_PREFIXES,
} from '@pages/time-tracking/lib/invoiceClientDescription';
import {
    normalizeCoverLanguage,
    type InvoiceCoverLanguage,
} from './invoiceCoverLetterI18n';

export type TimeReportLabels = {
    confidential: string;
    title: (servicesMonthYear: string) => string;
    titleContinued: (servicesMonthYear: string) => string;
    date: string;
    initials: string;
    task: string;
    description: string;
    hours: string;
    rate: string;
    amount: (currency: string) => string;
    total: string;
    summaryTitle: string;
    name: string;
    titleCol: string;
    hourlyRate: string;
    totalPrice: (currency: string) => string;
};

const LABELS: Record<InvoiceCoverLanguage, TimeReportLabels> = {
    ENG: {
        confidential: 'Private and confidential',
        title: (period) => `TIME REPORT FOR SERVICES PROVIDED IN ${period.toUpperCase()}`,
        titleContinued: (period) => `TIME REPORT FOR SERVICES PROVIDED IN ${period.toUpperCase()} — CONTINUED`,
        date: 'Date',
        initials: 'Initials',
        task: 'Task',
        description: 'Description',
        hours: 'Hours',
        rate: 'Rate',
        amount: (cur) => (cur === 'EUR' ? 'Amount (EUR)' : `Amount (${cur})`),
        total: 'Total',
        summaryTitle: 'Summary of services',
        name: 'Name',
        titleCol: 'Title',
        hourlyRate: 'Hourly rate',
        totalPrice: (cur) => `Total price (${cur})`,
    },
    RU: {
        confidential: 'Конфиденциально',
        title: (period) => `ОТЧЁТ О ВРЕМЕНИ ЗА УСЛУГИ, ОКАЗАННЫЕ В ${period.toUpperCase()}`,
        titleContinued: (period) => `ОТЧЁТ О ВРЕМЕНИ ЗА УСЛУГИ, ОКАЗАННЫЕ В ${period.toUpperCase()} — ПРОДОЛЖЕНИЕ`,
        date: 'Дата',
        initials: 'Инициалы',
        task: 'Задача',
        description: 'Описание',
        hours: 'Часы',
        rate: 'Ставка',
        amount: (cur) => `Сумма (${cur})`,
        total: 'Итого',
        summaryTitle: 'Сводка по услугам',
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
    const s = (iso ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '—';
    const d = new Date(`${s}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    const locale = normalizeCoverLanguage(lang) === 'RU' ? 'ru-RU' : 'en-GB';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
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
