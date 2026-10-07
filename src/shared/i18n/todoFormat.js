export const TODO_WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const TODO_MONTH_IDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function todoLocaleTag(locale) {
    return locale === 'ru' ? 'ru-RU' : 'en-US';
}
export function todoWeekdayLabels(t) {
    return TODO_WEEKDAY_IDS.map((id) => t(`todoPage.weekdays.${id}`));
}
export function todoMonthName(monthIndex, t) {
    const id = TODO_MONTH_IDS[monthIndex];
    return id ? t(`todoPage.months.${id}`) : '';
}
export function formatTodoFromColumn(name, t) {
    return t('todoPage.fromColumn').replace('{name}', name);
}
export function formatTodoArchiveClear(count, t) {
    return t('todoPage.archive.clear').replace('{count}', String(count));
}
export function formatTodoBoardFallback(id, t) {
    return t('todoPage.boards.boardFallback').replace('{id}', String(id));
}
export function formatTodoUploading(name, t) {
    return t('todoPage.cardModal.uploading').replace('{name}', name);
}
export function formatTodoPlannerHour(hour, pad2, selected, t) {
    const h = pad2(hour);
    const key = selected ? 'todoPage.planner.deselectHour' : 'todoPage.planner.selectHour';
    return t(key).replace('{hour}', h);
}
export function formatTodoAddMember(name, t) {
    return t('todoPage.cardModal.addMember').replace('{name}', name);
}
