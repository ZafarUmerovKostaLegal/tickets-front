import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMessages, subscribeMessageCatalog } from './messages';
import { applyDocumentLocale, getInitialLocale, persistLocale } from './localeStorage';
import { createTranslator } from './translate';
const I18nContext = createContext(null);
export function I18nProvider({ children }) {
    const [locale, setLocaleState] = useState(() => {
        const initial = getInitialLocale();
        applyDocumentLocale(initial);
        return initial;
    });
    const [catalogEpoch, setCatalogEpoch] = useState(0);
    const setLocale = useCallback((next) => {
        setLocaleState(next);
        persistLocale(next);
        applyDocumentLocale(next);
    }, []);
    useEffect(() => subscribeMessageCatalog(() => {
        setCatalogEpoch((n) => n + 1);
    }), []);
    const messages = useMemo(() => {
        void catalogEpoch;
        return getMessages(locale);
    }, [locale, catalogEpoch]);
    const t = useMemo(() => createTranslator(messages), [messages]);
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key !== 'app_locale_v1')
                return;
            if (e.newValue === 'ru' || e.newValue === 'en')
                setLocaleState(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
    return _jsx(I18nContext.Provider, { value: value, children: children });
}
export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx)
        throw new Error('useI18n must be used within I18nProvider');
    return ctx;
}
