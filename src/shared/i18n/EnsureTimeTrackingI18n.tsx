import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import { ensureTimeTrackingPageMessages, isTimeTrackingPageMessagesReady } from './messages';

type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};

/** Gates TT / report / project screens until the large timeTrackingPage catalog is loaded. */
export function EnsureTimeTrackingI18n({ children, fallback = null }: Props) {
    const { locale } = useI18n();
    const [ready, setReady] = useState(() => isTimeTrackingPageMessagesReady(locale));

    useEffect(() => {
        let cancelled = false;
        if (isTimeTrackingPageMessagesReady(locale)) {
            setReady(true);
            return;
        }
        setReady(false);
        void ensureTimeTrackingPageMessages(locale)
            .then(() => {
                if (!cancelled)
                    setReady(true);
            })
            .catch(() => {
                if (!cancelled)
                    setReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [locale]);

    if (!ready)
        return <>{fallback}</>;
    return <>{children}</>;
}
