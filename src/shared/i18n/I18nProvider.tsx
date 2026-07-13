import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMessages, subscribeMessageCatalog } from './messages';
import { applyDocumentLocale, getInitialLocale, persistLocale } from './localeStorage';
import { createTranslator, type TranslationKey } from './translate';
import type { AppLocale } from './types';

type I18nContextValue = {
    locale: AppLocale;
    setLocale: (locale: AppLocale) => void;
    t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<AppLocale>(() => {
        const initial = getInitialLocale();
        applyDocumentLocale(initial);
        return initial;
    });
    const [catalogEpoch, setCatalogEpoch] = useState(0);

    const setLocale = useCallback((next: AppLocale) => {
        setLocaleState(next);
        persistLocale(next);
        applyDocumentLocale(next);
    }, []);

    useEffect(() => subscribeMessageCatalog(() => {
        setCatalogEpoch((n) => n + 1);
    }), []);

    const messages = useMemo(() => getMessages(locale), [locale, catalogEpoch]);
    const t = useMemo(() => createTranslator(messages), [messages]);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== 'app_locale_v1')
                return;
            if (e.newValue === 'ru' || e.newValue === 'en')
                setLocaleState(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx)
        throw new Error('useI18n must be used within I18nProvider');
    return ctx;
}
