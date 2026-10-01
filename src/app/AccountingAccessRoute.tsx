import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';

type AccountingAccessRouteProps = {
    children: ReactNode;
};

export function AccountingAccessRoute({ children }: AccountingAccessRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessAdminPanel(user?.role, user?.position))
        return <Navigate to={routes.home} replace />;
    return <>{children}</>;
}
