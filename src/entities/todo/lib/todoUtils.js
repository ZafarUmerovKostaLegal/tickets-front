export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export function buildMonthGrid(baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - firstWeekday);
    const days = [];
    for (let i = 0; i < 42; i += 1) {
        days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
}
export const LABEL_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#22c55e',
    '#14b8a6', '#4f46e5', '#6366f1', '#a855f7',
    '#ec4899', '#64748b',
];
