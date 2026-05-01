import { type ReactNode } from 'react';
import { AppRouter } from './router';
import { CalendarReminder } from '@widgets/calendar-reminder';
import { GlobalTimerWidget } from '@widgets/global-timer';
import { AppDialogProvider } from '@shared/ui/app-dialog';
import { AppToastProvider } from '@shared/ui/app-toast';
type ProvidersProps = {
    children?: ReactNode;
};
export function Providers({ children }: ProvidersProps) {
    return (<AppDialogProvider>
      <AppToastProvider>
        {children ?? <AppRouter />}
      </AppToastProvider>
      <CalendarReminder />
      <GlobalTimerWidget />
    </AppDialogProvider>);
}
