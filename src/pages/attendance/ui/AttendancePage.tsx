import { AttendanceProvider } from '../model/AttendanceContext';
import { AttendancePageView } from './AttendancePageView';
export function AttendancePage() {
    return (<AttendanceProvider>
      <AttendancePageView />
    </AttendanceProvider>);
}
