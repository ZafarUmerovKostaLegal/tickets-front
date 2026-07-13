import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminOnlyModules } from '@shared/lib/orgRoles';

type AdminOnlyModuleRouteProps = {
    children: ReactNode;
};

export function AdminOnlyModuleRoute({ children }: AdminOnlyModuleRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessAdminOnlyModules(user?.role))
        return <Navigate to={routes.home} replace />;
    return <>{children}</>;
}
