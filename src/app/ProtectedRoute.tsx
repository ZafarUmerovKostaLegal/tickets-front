import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessAdminPanel } from '@shared/lib/orgRoles';
import { resolveDesktopBackgroundDisplayUrl } from '@entities/user';
import './ProtectedRoute.css';

function ProtectedRouteLoading() {
    return (<div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            minHeight: '100vh',
            background: 'var(--app-bg, #f8fafc)',
        }}>
      <div className="app-splash__progress-wrap" style={{ opacity: 0.55 }}>
        <svg className="app-splash__progress-ring" viewBox="0 0 36 36" width={36} height={36}>
          <circle className="app-splash__progress-bg" cx="18" cy="18" r="15.9"/>
          <circle className="app-splash__progress-fill" cx="18" cy="18" r="15.9" strokeDasharray="30 100" transform="rotate(-90 18 18)"/>
        </svg>
      </div>
    </div>);
}
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
        return <>{fallback ?? <ProtectedRouteLoading />}</>;
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
    const desktopBgUrl = resolveDesktopBackgroundDisplayUrl(user.desktop_background);
    return (<>
      {desktopBgUrl ? (<div className="app-desktop-bg" style={{ backgroundImage: `url(${desktopBgUrl})` }} aria-hidden/>) : null}
      {children}
    </>);
}
