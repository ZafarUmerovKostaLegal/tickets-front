import '@pages/report-preview/ui/ReportPreviewPage.css';
import '@pages/time-tracking/ui/TimePageShell.css';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { EnsureTimeTrackingI18n } from '@shared/i18n';
import { canAccessTimeTracking, canViewTimeTrackingReports } from '@entities/time-tracking/model/timeTrackingAccess';
import { ReportPreviewPage, ReportPreviewNavBar } from '@pages/report-preview';

function PreviewFallback() {
    return (
        <div className="tt-rp-preview" role="status" aria-live="polite" aria-label="Загрузка">
            <ReportPreviewNavBar />
            <div className="tt-rp-preview__main">
                <p className="tt-rp-preview__muted" style={{ margin: 0 }}>
                    Загрузка…
                </p>
            </div>
        </div>
    );
}

export function ReportPreviewRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return <PreviewFallback />;
    }
    if (!user || !canAccessTimeTracking(user)) {
        return <Navigate to={routes.home} replace />;
    }
    if (!canViewTimeTrackingReports(user)) {
        return <Navigate to={routes.timeTracking} replace />;
    }
    return (
        <EnsureTimeTrackingI18n fallback={<PreviewFallback />}>
            <ReportPreviewPage />
        </EnsureTimeTrackingI18n>
    );
}
