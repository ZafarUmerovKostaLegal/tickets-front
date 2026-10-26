import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessItSecurity } from '@shared/lib/itSecurityAccess';

type ItSecurityAccessRouteProps = {
    children: ReactNode;
};

export function ItSecurityAccessRoute({ children }: ItSecurityAccessRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessItSecurity(user))
        return <Navigate to={routes.home} replace />;
    return <>{children}</>;
}
