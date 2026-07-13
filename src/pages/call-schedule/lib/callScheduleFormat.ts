import type { AppLocale } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';

export function localeTag(locale: AppLocale): string {
    return locale === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatDateLong(iso: string, locale: AppLocale): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m)
        return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const s = d.toLocaleDateString(localeTag(locale), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthTitle(anchorMonth: Date, locale: AppLocale): string {
    const s = anchorMonth.toLocaleDateString(localeTag(locale), { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtDuration(min: number, t: (key: TranslationKey) => string): string {
    if (!Number.isFinite(min) || min <= 0)
        return '—';
    if (min < 60)
        return `${min} ${t('callSchedulePage.duration.min')}`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (m === 0)
        return `${h} ${t('callSchedulePage.duration.hour')}`;
    return `${h} ${t('callSchedulePage.duration.hour')} ${m} ${t('callSchedulePage.duration.min')}`;
}

export function eventCountLabel(n: number, locale: AppLocale, t: (key: TranslationKey) => string): string {
    if (locale === 'en')
        return `${n} ${n === 1 ? t('callSchedulePage.events.one') : t('callSchedulePage.events.many')}`;
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11)
        return `${n} ${t('callSchedulePage.events.one')}`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20))
        return `${n} ${t('callSchedulePage.events.few')}`;
    return `${n} ${t('callSchedulePage.events.many')}`;
}

export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function weekdayLabels(t: (key: TranslationKey) => string): string[] {
    return WEEKDAY_IDS.map((id) => t(`callSchedulePage.weekdays.${id}` as TranslationKey));
}
