import { formatIsoRangeTitle, isoDateLocal, periodToDates, reportsYtdRange } from '@entities/time-tracking/lib/reportsPeriodRange';
export const EXPENSES_PERIOD_LABELS = {
    all: 'Весь период',
    today: 'Сегодня',
    week: 'Эта неделя',
    month: 'Этот месяц',
    prev_month: 'Прошлый месяц',
    quarter: 'Этот квартал',
    ytd: 'С начала года',
    last_90: 'Последние 90 дней',
    custom: 'Свой период',
};
export const EXPENSES_PERIOD_PRESET_IDS = [
    'today',
    'week',
    'month',
    'prev_month',
    'quarter',
    'ytd',
    'last_90',
];
function weekStartIsoLocal(reference = new Date()) {
    const d = new Date(reference);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoDateLocal(d);
}
function monthStartIsoLocal(reference = new Date()) {
    const d = new Date(reference);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
export function expensesPeriodPresetRange(id, reference = new Date()) {
    const today = isoDateLocal(reference);
    if (id === 'today')
        return { dateFrom: today, dateTo: today };
    if (id === 'week')
        return { dateFrom: weekStartIsoLocal(reference), dateTo: today };
    if (id === 'month')
        return { dateFrom: monthStartIsoLocal(reference), dateTo: today };
    if (id === 'prev_month') {
        const d = new Date(reference);
        const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const end = new Date(d.getFullYear(), d.getMonth(), 0);
        return { dateFrom: isoDateLocal(start), dateTo: isoDateLocal(end) };
    }
    if (id === 'quarter') {
        const range = periodToDates(reference, 'quarter');
        return { dateFrom: range.dateFrom, dateTo: today < range.dateTo ? today : range.dateTo };
    }
    if (id === 'ytd')
        return reportsYtdRange(reference);
    const from = new Date(reference);
    from.setDate(from.getDate() - 89);
    return { dateFrom: isoDateLocal(from), dateTo: today };
}
export function expensesPeriodFilterLabel(period, customFrom, customTo) {
    if (period === 'custom') {
        const from = customFrom.trim().slice(0, 10);
        const to = customTo.trim().slice(0, 10);
        if (from && to)
            return formatIsoRangeTitle(from, to, { prefix: false });
        return EXPENSES_PERIOD_LABELS.custom;
    }
    return EXPENSES_PERIOD_LABELS[period];
}
export function defaultExpensesCustomRange(reference = new Date()) {
    return expensesPeriodPresetRange('month', reference);
}
