export const JOURNAL_DAYS = [];
export const JOURNAL_PERIOD_LABEL = '';
export function journalUsers() {
    return [];
}
export function journalSeedEvents() {
    return [];
}
export function journalEventKey(eventRow) {
    return eventRow.d.slice(6, 10) + eventRow.d.slice(3, 5) + eventRow.d.slice(0, 2) + eventRow.t;
}
const MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTH_TITLE = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
export function journalMonthKey(day) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(day);
    if (!match)
        return day || 'unknown';
    return `${match[3]}-${match[2]}`;
}
export function journalMonthLabel(day) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(day);
    if (!match)
        return day || 'Без даты';
    const title = MONTH_TITLE[Number(match[2]) - 1] ?? match[2];
    return `${title} ${match[3]}`;
}
export function journalDayLabel(day) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(day);
    if (!match)
        return day;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const text = `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''}`;
    if (date.getTime() === today.getTime())
        return `Сегодня, ${text}`;
    if (date.getTime() === yesterday.getTime())
        return `Вчера, ${text}`;
    return text;
}
