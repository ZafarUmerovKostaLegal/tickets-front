import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';
export function AccountingAccessRoute({ children }) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessAdminPanel(user?.role, user?.position))
        return _jsx(Navigate, { to: routes.home, replace: true });
    return _jsx(_Fragment, { children: children });
}
