import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import {} from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { routes } from '@shared/config';
export function GuestOnlyRoute({ children }) {
    if (isAuthenticated()) {
        return _jsx(Navigate, { to: routes.home, replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
