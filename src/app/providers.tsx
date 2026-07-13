import { useEffect, useState, type ReactNode } from 'react';
import { AppRouter } from './router';
import { CalendarReminder } from '@widgets/calendar-reminder';
import { ChatNotificationHost } from '@widgets/chat-notification';
import { GlobalTimerWidget } from '@widgets/global-timer';
import { AppDialogProvider } from '@shared/ui/app-dialog';
import { AppToastProvider } from '@shared/ui/app-toast';

type ProvidersProps = {
    children?: ReactNode;
};

/** Mount always-on widgets after first paint so they don't compete with route boot. */
function DeferredBackgroundWidgets() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const enable = () => {
            if (!cancelled)
                setReady(true);
        };
        const ric = typeof window !== 'undefined'
            ? (window as Window & {
                requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
                cancelIdleCallback?: (id: number) => void;
            })
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
    if (!ready)
        return null;
    return (
        <>
            <CalendarReminder />
            <ChatNotificationHost />
            <GlobalTimerWidget />
        </>
    );
}

export function Providers({ children }: ProvidersProps) {
    return (
        <AppDialogProvider>
            <AppToastProvider>
                {children ?? <AppRouter />}
                <DeferredBackgroundWidgets />
            </AppToastProvider>
        </AppDialogProvider>
    );
}
