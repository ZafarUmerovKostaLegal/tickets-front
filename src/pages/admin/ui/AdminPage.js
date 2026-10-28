import { jsx as _jsx } from "react/jsx-runtime";
import { AdminProvider } from '../model/AdminContext';
import { AdminPageView } from './AdminPageView';
export function AdminPage() {
    return (_jsx(AdminProvider, { children: _jsx(AdminPageView, {}) }));
}
