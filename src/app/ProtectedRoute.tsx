import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';
const ADMIN_ROLE = 'Администратор';
type ProtectedRouteProps = {
    children: ReactNode;
    adminOnly?: boolean;
    fallback?: ReactNode;
};
export function ProtectedRoute({ children, adminOnly = false, fallback = null }: ProtectedRouteProps) {
    const location = useLocation();
    const { user, loading, error } = useCurrentUser();
    if (!isAuthenticated()) {
        return <Navigate to={routes.login} state={{ from: location }} replace/>;
    }
    if (loading) {
        return <>{fallback}</>;
    }
    if (error || !user) {
        return <Navigate to={routes.login} replace/>;
    }
    if (user.is_blocked) {
        return <Navigate to={routes.login} state={{ blocked: true }} replace/>;
    }
    if (user.is_archived) {
        return <Navigate to={routes.login} state={{ archived: true }} replace/>;
    }
    if (adminOnly) {
        const strictAdminOnly = location.pathname === routes.networkDriveAccess;
        if (strictAdminOnly) {
            if (user.role !== ADMIN_ROLE)
                return <Navigate to={routes.home} replace/>;
        }
        else if (!canAccessAdminPanel(user.role, user.position)) {
            return <Navigate to={routes.home} replace/>;
        }
    }
    return <>{children}</>;
}
