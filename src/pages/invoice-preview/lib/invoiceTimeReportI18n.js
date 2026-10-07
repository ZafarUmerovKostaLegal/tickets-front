import { INVOICE_DESCRIPTION_TASK_PREFIXES, } from '@pages/time-tracking/lib/invoiceClientDescription';
import { normalizeCoverLanguage, } from './invoiceCoverLetterI18n';
const LABELS = {
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
const TASK_LABEL_RU = {
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
export function getTimeReportLabels(lang) {
    return LABELS[normalizeCoverLanguage(lang)];
}
export function formatTimeReportDateDisplay(iso, lang) {
    void lang;
    const s = (iso ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return '—';
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y}`;
}
export function localizeTimeReportTaskLabel(task, lang) {
    const raw = (task ?? '').trim();
    if (!raw)
        return '';
    if (normalizeCoverLanguage(lang) !== 'RU')
        return raw;
    const mapped = TASK_LABEL_RU[raw.toLowerCase()];
    return mapped ?? raw;
}
