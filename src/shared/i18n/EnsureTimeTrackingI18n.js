import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { ensureContactsPageMessages, ensureTimeTrackingPageMessages, ensureTodoPageMessages, isContactsPageMessagesReady, isTimeTrackingPageMessagesReady, isTodoPageMessagesReady, } from './messages';
function EnsureMessages({ children, fallback = null, ensure, isReady }) {
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
        return _jsx(_Fragment, { children: fallback });
    return _jsx(_Fragment, { children: children });
}
export function EnsureTimeTrackingI18n(props) {
    return _jsx(EnsureMessages, { ...props, ensure: ensureTimeTrackingPageMessages, isReady: isTimeTrackingPageMessagesReady });
}
export function EnsureTodoI18n(props) {
    return _jsx(EnsureMessages, { ...props, ensure: ensureTodoPageMessages, isReady: isTodoPageMessagesReady });
}
export function EnsureContactsI18n(props) {
    return _jsx(EnsureMessages, { ...props, ensure: ensureContactsPageMessages, isReady: isContactsPageMessagesReady });
}
