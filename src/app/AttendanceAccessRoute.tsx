import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAttendance } from '@shared/lib/orgRoles';

type AttendanceAccessRouteProps = {
    children: ReactNode;
};

export function AttendanceAccessRoute({ children }: AttendanceAccessRouteProps) {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return null;
    }
    if (!canAccessAttendance(user?.role, user?.position)) {
        return <Navigate to={routes.home} replace />;
    }
    return <>{children}</>;
}
