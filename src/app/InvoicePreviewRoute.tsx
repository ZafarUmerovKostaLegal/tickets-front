import '@pages/time-tracking/ui/TimePageShell.css';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { EnsureTimeTrackingI18n } from '@shared/i18n';
import { InvoicePreviewPage } from '@pages/invoice-preview';

function InvoicePreviewFallback() {
    return (
        <div className="invoice-preview-route" role="status" aria-live="polite" aria-label="Загрузка">
            <div style={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 0,
                color: 'var(--app-muted, #64748b)',
            }}>
                Загрузка…
            </div>
        </div>
    );
}

export function InvoicePreviewRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return <InvoicePreviewFallback />;
    }
    if (!user) {
        return <Navigate to={routes.login} replace />;
    }
    return (
        <EnsureTimeTrackingI18n fallback={<InvoicePreviewFallback />}>
            <div className="invoice-preview-route">
                <InvoicePreviewPage />
            </div>
        </EnsureTimeTrackingI18n>
    );
}
