import { INVOICE_DESCRIPTION_TASK_PREFIXES, } from '@pages/time-tracking/lib/invoiceClientDescription';
import { formatCoverServicesPeriodFromIsoDates, normalizeCoverLanguage, } from './invoiceCoverLetterI18n';
export function isoDateFromTimeReportDisplay(display) {
    const raw = String(display ?? '').trim();
    const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmy)
        return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const iso = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}
function isoDatesFromTimeReportRows(rows) {
    const out = [];
    for (const row of rows ?? []) {
        const iso = isoDateFromTimeReportDisplay(row.date);
        if (iso)
            out.push(iso);
    }
    return out;
}
export function timeReportServicesMonthYear(pack, fallback, language) {
    const dates = [
        ...isoDatesFromTimeReportRows(pack.detailSlots),
        ...isoDatesFromTimeReportRows(pack.expenseSlots),
        ...isoDatesFromTimeReportRows(pack.mehnatSlots),
    ];
    if (dates.length === 0)
        return fallback;
    return formatCoverServicesPeriodFromIsoDates(dates, language);
}
const MONTH_TOKEN = {
    january: '1', february: '2', march: '3', april: '4', may: '5', june: '6',
    july: '7', august: '8', september: '9', october: '10', november: '11', december: '12',
    январь: '1', января: '1', январе: '1',
    февраль: '2', февраля: '2', феврале: '2',
    март: '3', марта: '3', марте: '3',
    апрель: '4', апреля: '4', апреле: '4',
    май: '5', мая: '5', мае: '5',
    июнь: '6', июня: '6', июне: '6',
    июль: '7', июля: '7', июле: '7',
    август: '8', августа: '8', августе: '8',
    сентябрь: '9', сентября: '9', сентябре: '9',
    октябрь: '10', октября: '10', октябре: '10',
    ноябрь: '11', ноября: '11', ноябре: '11',
    декабрь: '12', декабря: '12', декабре: '12',
};
function monthYearPairs(text) {
    const tokens = text.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter(Boolean);
    const pairs = [];
    for (let i = 0; i < tokens.length; i += 1) {
        const month = MONTH_TOKEN[tokens[i] ?? ''];
        if (!month)
            continue;
        const next = tokens[i + 1] ?? '';
        pairs.push(/^\d{4}$/.test(next) ? `${month}-${next}` : month);
    }
    return pairs;
}
export function isGeneratedTimeReportHeading(title) {
    const t = String(title ?? '').replace(/\s+/g, ' ').trim();
    if (!t)
        return false;
    return /^(TIME REPORT FOR SERVICES PROVIDED IN |ОТЧЁТ О ВРЕМЕНИ ЗА УСЛУГИ, ОКАЗАННЫЕ В )/i.test(t);
}
/** Saved auto-titles that still list months absent from the current rows. */
export function generatedTitleListsMonthsOutside(title, servicesMonthYear) {
    if (!isGeneratedTimeReportHeading(title))
        return false;
    const live = new Set(monthYearPairs(servicesMonthYear));
    if (live.size === 0)
        return false;
    return monthYearPairs(title).some((pair) => {
        if (live.has(pair))
            return false;
        if (!pair.includes('-'))
            return ![...live].some((item) => item === pair || item.startsWith(`${pair}-`));
        return true;
    });
}
export function timeReportHeading(opts) {
    const custom = (opts.continuation ? opts.reportTitleContinued : opts.reportTitle) ?? '';
    if (custom.trim() && !generatedTitleListsMonthsOutside(custom, opts.servicesMonthYear))
        return custom.replace(/^\s+/, '');
    const labels = getTimeReportLabels(opts.language);
    return opts.continuation
        ? labels.titleContinued(opts.servicesMonthYear)
        : labels.title(opts.servicesMonthYear);
}
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
