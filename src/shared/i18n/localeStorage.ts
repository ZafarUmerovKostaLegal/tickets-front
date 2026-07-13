import { DEFAULT_LOCALE, type AppLocale } from './types';

export const LOCALE_STORAGE_KEY = 'app_locale_v1';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
    return value === 'ru' || value === 'en';
}

export function getStoredLocale(): AppLocale | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        return isAppLocale(raw) ? raw : null;
    }
    catch {
        return null;
    }
}

export function getInitialLocale(): AppLocale {
    const stored = getStoredLocale();
    if (stored)
        return stored;
    if (typeof navigator !== 'undefined') {
        const lang = navigator.language.toLowerCase();
        if (lang.startsWith('en'))
            return 'en';
    }
    return DEFAULT_LOCALE;
}

export function persistLocale(locale: AppLocale): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    catch {

    }
}

export function applyDocumentLocale(locale: AppLocale): void {
    if (typeof document === 'undefined')
        return;
    document.documentElement.lang = locale;
}
