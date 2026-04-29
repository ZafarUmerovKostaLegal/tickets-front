import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { TimeTrackingPage } from '@pages/time-tracking';

export function TimeTrackingRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return (<div className="time-page" role="status" aria-live="polite" aria-label="Загрузка профиля">
        <main className="time-page__main" style={{ minHeight: '50vh' }}/>
      </div>);
    }
    if (!user || !canAccessTimeTracking(user)) {
        return <Navigate to={routes.home} replace/>;
    }
    return <TimeTrackingPage />;
}
