import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import {
    ensureContactsPageMessages,
    ensureTimeTrackingPageMessages,
    ensureTodoPageMessages,
    isContactsPageMessagesReady,
    isTimeTrackingPageMessagesReady,
    isTodoPageMessagesReady,
} from './messages';
import type { AppLocale } from './types';

type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};

type EnsureMessagesProps = Props & {
    ensure: (locale: AppLocale) => Promise<void>;
    isReady: (locale: AppLocale) => boolean;
};

function EnsureMessages({ children, fallback = null, ensure, isReady }: EnsureMessagesProps) {
    const { locale } = useI18n();
    const [ready, setReady] = useState(() => isReady(locale));

    useEffect(() => {
        let cancelled = false;
        if (isReady(locale)) {
            setReady(true);
            return;
        }
        setReady(false);
        void ensure(locale)
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
    }, [ensure, isReady, locale]);

    if (!ready)
        return <>{fallback}</>;
    return <>{children}</>;
}

export function EnsureTimeTrackingI18n(props: Props) {
    return <EnsureMessages {...props} ensure={ensureTimeTrackingPageMessages} isReady={isTimeTrackingPageMessagesReady} />;
}

export function EnsureTodoI18n(props: Props) {
    return <EnsureMessages {...props} ensure={ensureTodoPageMessages} isReady={isTodoPageMessagesReady} />;
}

export function EnsureContactsI18n(props: Props) {
    return <EnsureMessages {...props} ensure={ensureContactsPageMessages} isReady={isContactsPageMessagesReady} />;
}
