import '@pages/time-tracking/ui/TimeTrackingPage.css';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
import { InvoicePreviewPage } from '@pages/invoice-preview';

export function InvoicePreviewRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return (<div className="tt-inv-preview" role="status" aria-live="polite" aria-label="Загрузка профиля">
        <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '40vh',
                color: 'var(--app-muted, #64748b)',
            }}>
          Загрузка…
        </div>
      </div>);
    }
    if (!user || !canAccessTimeTracking(user)) {
        return <Navigate to={routes.home} replace/>;
    }
    return <InvoicePreviewPage />;
}
