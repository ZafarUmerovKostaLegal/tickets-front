import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AppRouter } from './router';
import { AppDialogProvider } from '@shared/ui/app-dialog';
import { AppToastProvider } from '@shared/ui/app-toast';
import { useCurrentUser } from '@shared/hooks';

const BirthdayPostcardHost = lazy(() => import('@widgets/birthday-postcard').then((m) => ({ default: m.BirthdayPostcardHost })));
const CalendarReminder = lazy(() => import('@widgets/calendar-reminder').then((m) => ({ default: m.CalendarReminder })));
const ChatNotificationHost = lazy(() => import('@widgets/chat-notification').then((m) => ({ default: m.ChatNotificationHost })));
const GlobalTimerWidget = lazy(() => import('@widgets/global-timer').then((m) => ({ default: m.GlobalTimerWidget })));

type ProvidersProps = {
    children?: ReactNode;
};


function ImmediatePostcardHost() {
    const { user } = useCurrentUser();
    if (!user || user.is_blocked || user.is_archived)
        return null;
    return <Suspense fallback={null}><BirthdayPostcardHost /></Suspense>;
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
    if (!ready || !user || user.is_blocked || user.is_archived)
        return null;
    return (
        <>
            <Suspense fallback={null}><CalendarReminder /></Suspense>
            <Suspense fallback={null}><ChatNotificationHost /></Suspense>
            <Suspense fallback={null}><GlobalTimerWidget /></Suspense>
        </>
    );
}

export function Providers({ children }: ProvidersProps) {
    return (
        <AppDialogProvider>
            <AppToastProvider>
                {children ?? <AppRouter />}
                <ImmediatePostcardHost />
                <DeferredBackgroundWidgets />
            </AppToastProvider>
        </AppDialogProvider>
    );
}

