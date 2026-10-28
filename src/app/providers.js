import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect, useState } from 'react';
import { AppRouter } from './router';
import { AppDialogProvider } from '@shared/ui/app-dialog';
import { AppToastProvider } from '@shared/ui/app-toast';
import { useCurrentUser } from '@shared/hooks';
const BirthdayPostcardHost = lazy(() => import('@widgets/birthday-postcard').then((m) => ({ default: m.BirthdayPostcardHost })));
const CalendarReminder = lazy(() => import('@widgets/calendar-reminder').then((m) => ({ default: m.CalendarReminder })));
const ChatNotificationHost = lazy(() => import('@widgets/chat-notification').then((m) => ({ default: m.ChatNotificationHost })));
const GlobalTimerWidget = lazy(() => import('@widgets/global-timer').then((m) => ({ default: m.GlobalTimerWidget })));
function ImmediatePostcardHost() {
    const { user } = useCurrentUser();
    if (!user || user.is_blocked || user.is_archived)
        return null;
    return _jsx(Suspense, { fallback: null, children: _jsx(BirthdayPostcardHost, {}) });
}
function DeferredBackgroundWidgets() {
    const { user } = useCurrentUser();
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const enable = () => {
            if (!cancelled)
                setReady(true);
        };
        const ric = typeof window !== 'undefined'
            ? window
            : null;
        if (ric?.requestIdleCallback) {
            const id = ric.requestIdleCallback(enable, { timeout: 2500 });
            return () => {
                cancelled = true;
                ric.cancelIdleCallback?.(id);
            };
        }
        const t = window.setTimeout(enable, 1200);
        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, []);
    if (!ready || !user || user.is_blocked || user.is_archived)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx(Suspense, { fallback: null, children: _jsx(CalendarReminder, {}) }), _jsx(Suspense, { fallback: null, children: _jsx(ChatNotificationHost, {}) }), _jsx(Suspense, { fallback: null, children: _jsx(GlobalTimerWidget, {}) })] }));
}
export function Providers({ children }) {
    return (_jsx(AppDialogProvider, { children: _jsxs(AppToastProvider, { children: [children ?? _jsx(AppRouter, {}), _jsx(ImmediatePostcardHost, {}), _jsx(DeferredBackgroundWidgets, {})] }) }));
}
