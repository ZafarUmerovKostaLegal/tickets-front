import { AdminProvider } from '../model/AdminContext';
import { AdminPageView } from './AdminPageView';
export function AdminPage() {
    return (<AdminProvider>
      <AdminPageView />
    </AdminProvider>);
}
