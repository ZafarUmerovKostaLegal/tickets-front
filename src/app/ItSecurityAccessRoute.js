import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessItSecurity } from '@shared/lib/itSecurityAccess';
export function ItSecurityAccessRoute({ children }) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessItSecurity(user))
        return _jsx(Navigate, { to: routes.home, replace: true });
    return _jsx(_Fragment, { children: children });
}
