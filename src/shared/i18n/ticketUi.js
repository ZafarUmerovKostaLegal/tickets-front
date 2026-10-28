const CATEGORY_BY_RU = {
    'Техника': 'hardware',
    'Сеть': 'network',
    'Программное обеспечение': 'software',
    'Оборудование': 'equipment',
    'Доступы': 'access',
    'Общее': 'general',
};
export function translateTicketCategory(category, t) {
    const id = CATEGORY_BY_RU[category.trim()];
    if (id)
        return t(`ticketsPage.categories.${id}`);
    return category;
}
export function formatPriorityLabel(value, label, t) {
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
export function formatUserRef(userId, t) {
    return `${t('common.user')} #${userId}`;
}
export function isTicketAccessDeniedMessage(raw) {
    const lower = raw.toLowerCase();
    return lower.includes('403') || lower.includes('forbidden') || lower.includes('доступ') || lower.includes('access denied');
}
export function ticketErrorMessage(err, fallbackKey, forbiddenKey, t) {
    const raw = err instanceof Error ? err.message : t(fallbackKey);
    return isTicketAccessDeniedMessage(raw) ? t(forbiddenKey) : raw;
}
export function localeTag(locale) {
    return locale === 'ru' ? 'ru-RU' : 'en-US';
}
export function formatDateInfoLocalized(iso, locale) {
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
export function formatDateShortLocalized(iso, locale) {
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
