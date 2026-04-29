import '@pages/report-preview/ui/ReportPreviewPage.css';
import '@pages/time-tracking/ui/TimeTrackingPage.css';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { ReportPreviewPage, ReportPreviewNavBar } from '@pages/report-preview';
export function ReportPreviewRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return (<div className="tt-rp-preview" role="status" aria-live="polite" aria-label="Загрузка профиля">
        <ReportPreviewNavBar />
        <div className="tt-rp-preview__main">
          <p className="tt-rp-preview__muted" style={{ margin: 0 }}>
            Загрузка…
          </p>
        </div>
      </div>);
    }
    if (!user || !canAccessTimeTracking(user)) {
        return <Navigate to={routes.home} replace/>;
    }
    return <ReportPreviewPage />;
}
