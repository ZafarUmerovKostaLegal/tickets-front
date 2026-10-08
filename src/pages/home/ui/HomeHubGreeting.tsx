import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import './HomeHubGreeting.css';

function getGreetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
    if (hour >= 5 && hour < 12)
        return 'morning';
    if (hour >= 12 && hour < 18)
        return 'afternoon';
    return 'evening';
}

function getFirstName(displayName: string | null | undefined, email: string | undefined, fallback: string): string {
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

    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const formattedDate = useMemo(() => {
        const tag = locale === 'en' ? 'en-US' : 'ru-RU';
        const date = new Intl.DateTimeFormat(tag, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(now);
        const time = new Intl.DateTimeFormat(tag, {
            hour: '2-digit',
            minute: '2-digit',
        }).format(now);
        return `${date}, ${time}`;
    }, [locale, now]);

    return (
        <header className="home-hub-greeting">
            <div className="home-hub-greeting__text">
                <h1 className="home-hub-greeting__title">
                    {loading ? t('common.loading') : greeting}
                </h1>
                <p className="home-hub-greeting__subtitle">{t('homeHub.greetingSubtitle')}</p>
            </div>
            <time className="home-hub-greeting__date" dateTime={now.toISOString()}>
                {formattedDate}
            </time>
        </header>
    );
}
