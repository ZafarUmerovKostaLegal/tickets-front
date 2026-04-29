import { type ReactNode } from 'react';
import { AppRouter } from './router';
import { CalendarReminder } from '@widgets/calendar-reminder';
import { GlobalTimerWidget } from '@widgets/global-timer';
type ProvidersProps = {
    children?: ReactNode;
};
export function Providers({ children }: ProvidersProps) {
    return (<>
      {children ?? <AppRouter />}
      <CalendarReminder />
      <GlobalTimerWidget />
    </>);
}
