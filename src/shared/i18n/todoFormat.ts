import type { TranslationKey } from './translate';
import type { AppLocale } from './types';

export const TODO_WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const TODO_MONTH_IDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export function todoLocaleTag(locale: AppLocale): string {
    return locale === 'ru' ? 'ru-RU' : 'en-US';
}

export function todoWeekdayLabels(t: (key: TranslationKey) => string): string[] {
    return TODO_WEEKDAY_IDS.map((id) => t(`todoPage.weekdays.${id}` as TranslationKey));
}

export function todoMonthName(monthIndex: number, t: (key: TranslationKey) => string): string {
    const id = TODO_MONTH_IDS[monthIndex];
    return id ? t(`todoPage.months.${id}` as TranslationKey) : '';
}

export function formatTodoFromColumn(name: string, t: (key: TranslationKey) => string): string {
    return t('todoPage.fromColumn' as TranslationKey).replace('{name}', name);
}

export function formatTodoArchiveClear(count: number, t: (key: TranslationKey) => string): string {
    return t('todoPage.archive.clear' as TranslationKey).replace('{count}', String(count));
}

export function formatTodoBoardFallback(id: number | string, t: (key: TranslationKey) => string): string {
    return t('todoPage.boards.boardFallback' as TranslationKey).replace('{id}', String(id));
}

export function formatTodoUploading(name: string, t: (key: TranslationKey) => string): string {
    return t('todoPage.cardModal.uploading' as TranslationKey).replace('{name}', name);
}

export function formatTodoPlannerHour(
    hour: number,
    pad2: (n: number) => string,
    selected: boolean,
    t: (key: TranslationKey) => string,
): string {
    const h = pad2(hour);
    const key = selected ? 'todoPage.planner.deselectHour' : 'todoPage.planner.selectHour';
    return t(key as TranslationKey).replace('{hour}', h);
}

export function formatTodoAddMember(name: string, t: (key: TranslationKey) => string): string {
    return t('todoPage.cardModal.addMember' as TranslationKey).replace('{name}', name);
}
