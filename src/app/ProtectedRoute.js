import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';
import { isMeetingRoomAccount, isMeetingRoomAllowedPath } from '@shared/lib/meetingRoomAccounts';
import { resolveDesktopBackgroundDisplayUrl } from '@entities/user';
import './ProtectedRoute.css';
function ProtectedRouteLoading() {
    return (_jsx("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            minHeight: '100vh',
            background: 'var(--app-bg, #f8fafc)',
        }, children: _jsx("div", { className: "app-splash__progress-wrap", style: { opacity: 0.55 }, children: _jsxs("svg", { className: "app-splash__progress-ring", viewBox: "0 0 36 36", width: 36, height: 36, children: [_jsx("circle", { className: "app-splash__progress-bg", cx: "18", cy: "18", r: "15.9" }), _jsx("circle", { className: "app-splash__progress-fill", cx: "18", cy: "18", r: "15.9", strokeDasharray: "30 100", transform: "rotate(-90 18 18)" })] }) }) }));
}
const ADMIN_ROLE = 'Администратор';
export function ProtectedRoute({ children, adminOnly = false, fallback = null }) {
    const location = useLocation();
    const { user, loading, error } = useCurrentUser();
    if (!isAuthenticated()) {
        return _jsx(Navigate, { to: routes.login, state: { from: location }, replace: true });
    }
    if (loading) {
        return _jsx(_Fragment, { children: fallback ?? _jsx(ProtectedRouteLoading, {}) });
    }
    if (error || !user) {
        return _jsx(Navigate, { to: routes.login, replace: true });
    }
    if (user.is_blocked) {
        return _jsx(Navigate, { to: routes.login, state: { blocked: true }, replace: true });
    }
    if (user.is_archived) {
        return _jsx(Navigate, { to: routes.login, state: { archived: true }, replace: true });
    }
    if (adminOnly) {
        const strictAdminOnly = location.pathname === routes.networkDriveAccess;
        if (strictAdminOnly) {
            if (user.role !== ADMIN_ROLE)
                return _jsx(Navigate, { to: routes.home, replace: true });
        }
        else if (!canAccessAdminPanel(user.role, user.position)) {
            return _jsx(Navigate, { to: routes.home, replace: true });
        }
    }
    if (isMeetingRoomAccount(user) && !isMeetingRoomAllowedPath(location.pathname)) {
        return _jsx(Navigate, { to: routes.home, replace: true });
    }
    const desktopBgUrl = resolveDesktopBackgroundDisplayUrl(user.desktop_background);
    return (_jsxs(_Fragment, { children: [desktopBgUrl ? (_jsx("div", { className: "app-desktop-bg", style: { backgroundImage: `url(${desktopBgUrl})` }, "aria-hidden": true })) : null, children] }));
}
