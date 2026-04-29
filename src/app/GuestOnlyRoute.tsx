import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib';
import { routes } from '@shared/config';
type GuestOnlyRouteProps = {
    children: ReactNode;
};
export function GuestOnlyRoute({ children }: GuestOnlyRouteProps) {
    if (isAuthenticated()) {
        return <Navigate to={routes.home} replace/>;
    }
    return <>{children}</>;
}
