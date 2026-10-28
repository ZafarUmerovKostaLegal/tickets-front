import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import {} from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminOnlyModules } from '@shared/lib/orgRoles';
export function AdminOnlyModuleRoute({ children }) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessAdminOnlyModules(user?.role))
        return _jsx(Navigate, { to: routes.home, replace: true });
    return _jsx(_Fragment, { children: children });
}
