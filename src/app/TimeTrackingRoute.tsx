import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { EnsureTimeTrackingI18n } from '@shared/i18n';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';

const TimeTrackingPage = lazy(() => import('@pages/time-tracking').then((m) => ({ default: m.TimeTrackingPage })));

function TtRouteFallback({ label }: { label: string }) {
    return (
        <div className="time-page" role="status" aria-live="polite" aria-label={label}>
            <main className="time-page__main" style={{ minHeight: '50vh' }} />
        </div>
    );
}

export function TimeTrackingRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return <TtRouteFallback label="Загрузка профиля" />;
    }
    if (!user || !canAccessTimeTracking(user)) {
        return <Navigate to={routes.home} replace/>;
    }
    return (
        <EnsureTimeTrackingI18n fallback={<TtRouteFallback label="Загрузка учёта времени" />}>
            <Suspense fallback={<TtRouteFallback label="Загрузка учёта времени" />}>
                <TimeTrackingPage />
            </Suspense>
        </EnsureTimeTrackingI18n>
    );
}
