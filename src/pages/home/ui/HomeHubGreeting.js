import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import './HomeHubGreeting.css';
function getGreetingKey(hour) {
    if (hour >= 5 && hour < 12)
        return 'morning';
    if (hour >= 12 && hour < 18)
        return 'afternoon';
    return 'evening';
}
function getFirstName(displayName, email, fallback) {
    if (displayName?.trim()) {
        const first = displayName.trim().split(/\s+/)[0];
        if (first)
            return first;
    }
    if (email?.trim())
        return email.split('@')[0] || fallback;
    return fallback;
}
export function HomeHubGreeting() {
    const { t, locale } = useI18n();
    const { user, loading } = useCurrentUser();
    const greeting = useMemo(() => {
        const key = getGreetingKey(new Date().getHours());
        const name = getFirstName(user?.display_name, user?.email, t('common.user'));
        return `${t(`homeHub.greeting.${key}`)}, ${name}`;
    }, [t, user?.display_name, user?.email]);
    const formattedDate = useMemo(() => {
        const tag = locale === 'en' ? 'en-US' : 'ru-RU';
        return new Intl.DateTimeFormat(tag, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(new Date());
    }, [locale]);
    return (_jsxs("header", { className: "home-hub-greeting", children: [_jsxs("div", { className: "home-hub-greeting__text", children: [_jsx("h1", { className: "home-hub-greeting__title", children: loading ? t('common.loading') : greeting }), _jsx("p", { className: "home-hub-greeting__subtitle", children: t('homeHub.greetingSubtitle') })] }), _jsx("time", { className: "home-hub-greeting__date", dateTime: new Date().toISOString().slice(0, 10), children: formattedDate })] }));
}
