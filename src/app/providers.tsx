import { type ReactNode } from 'react';
import { AppRouter } from './router';
import { CalendarReminder } from '@widgets/calendar-reminder';
import { GlobalTimerWidget } from '@widgets/global-timer';
import { AppDialogProvider } from '@shared/ui/app-dialog';
type ProvidersProps = {
    children?: ReactNode;
};
export function Providers({ children }: ProvidersProps) {
    return (<AppDialogProvider>
      {children ?? <AppRouter />}
      <CalendarReminder />
      <GlobalTimerWidget />
    </AppDialogProvider>);
}
