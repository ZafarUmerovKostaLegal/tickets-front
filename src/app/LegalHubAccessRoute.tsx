import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessLegalHub } from '@shared/lib/legalHubAccess';

type LegalHubAccessRouteProps = {
    children: ReactNode;
};

export function LegalHubAccessRoute({ children }: LegalHubAccessRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading)
        return null;
    if (!canAccessLegalHub(user))
        return <Navigate to={routes.home} replace />;
    return <>{children}</>;
}
