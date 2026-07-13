import type { TranslationKey } from './translate';

export type TicketCategoryId = 'hardware' | 'network' | 'software' | 'equipment' | 'access' | 'general';

const CATEGORY_BY_RU: Record<string, TicketCategoryId> = {
    'Техника': 'hardware',
    'Сеть': 'network',
    'Программное обеспечение': 'software',
    'Оборудование': 'equipment',
    'Доступы': 'access',
    'Общее': 'general',
};

export function translateTicketCategory(category: string, t: (key: TranslationKey) => string): string {
    const id = CATEGORY_BY_RU[category.trim()];
    if (id)
        return t(`ticketsPage.categories.${id}` as TranslationKey);
    return category;
}

export function formatPriorityLabel(value: string, label: string | undefined, t: (key: TranslationKey) => string): string {
    const v = (value || '').toLowerCase();
    if (v === 'high')
        return t('ticketsPage.priority.high');
    if (v === 'low')
        return t('ticketsPage.priority.low');
    if (v === 'medium')
        return t('ticketsPage.priority.medium');
    const l = (label || '').toLowerCase();
    if (l === 'high' || /высок/i.test(label || ''))
        return t('ticketsPage.priority.high');
    if (l === 'low' || /низк/i.test(label || ''))
        return t('ticketsPage.priority.low');
    if (l === 'medium' || /средн/i.test(label || ''))
        return t('ticketsPage.priority.medium');
    return label || value || t('ticketsPage.priority.medium');
}

export function formatUserRef(userId: number, t: (key: TranslationKey) => string): string {
    return `${t('common.user')} #${userId}`;
}

export function isTicketAccessDeniedMessage(raw: string): boolean {
    const lower = raw.toLowerCase();
    return lower.includes('403') || lower.includes('forbidden') || lower.includes('доступ') || lower.includes('access denied');
}

export function ticketErrorMessage(
    err: unknown,
    fallbackKey: TranslationKey,
    forbiddenKey: TranslationKey,
    t: (key: TranslationKey) => string,
): string {
    const raw = err instanceof Error ? err.message : t(fallbackKey);
    return isTicketAccessDeniedMessage(raw) ? t(forbiddenKey) : raw;
}

export function localeTag(locale: 'ru' | 'en'): string {
    return locale === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatDateInfoLocalized(iso: string, locale: 'ru' | 'en'): string {
    try {
        const d = new Date(iso);
        const tag = localeTag(locale);
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleDateString(tag, { month: 'short' });
        const year = d.getFullYear();
        const time = d.toLocaleTimeString(tag, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        return `${day} ${month} ${year} ${time}`;
    }
    catch {
        return iso;
    }
}

export function formatDateShortLocalized(iso: string, locale: 'ru' | 'en'): string {
    try {
        return new Date(iso).toLocaleDateString(localeTag(locale), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    catch {
        return iso;
    }
}
