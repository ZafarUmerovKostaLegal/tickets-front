import { jsx as _jsx } from "react/jsx-runtime";
import '@pages/time-tracking/ui/TimePageShell.css';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { EnsureTimeTrackingI18n } from '@shared/i18n';
import { InvoicePreviewPage } from '@pages/invoice-preview';
function InvoicePreviewFallback() {
    return (_jsx("div", { className: "invoice-preview-route", role: "status", "aria-live": "polite", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430", children: _jsx("div", { style: {
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 0,
                color: 'var(--app-muted, #64748b)',
            }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }) }));
}
export function InvoicePreviewRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return _jsx(InvoicePreviewFallback, {});
    }
    if (!user) {
        return _jsx(Navigate, { to: routes.login, replace: true });
    }
    return (_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(InvoicePreviewFallback, {}), children: _jsx("div", { className: "invoice-preview-route", children: _jsx(InvoicePreviewPage, {}) }) }));
}
