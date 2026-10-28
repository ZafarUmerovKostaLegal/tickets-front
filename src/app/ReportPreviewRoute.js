import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import '@pages/report-preview/ui/ReportPreviewPage.css';
import '@pages/time-tracking/ui/TimePageShell.css';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { EnsureTimeTrackingI18n } from '@shared/i18n';
import { canAccessTimeTracking, canViewTimeTrackingReports } from '@entities/time-tracking/model/timeTrackingAccess';
import { ReportPreviewPage, ReportPreviewNavBar } from '@pages/report-preview';
function PreviewFallback() {
    return (_jsxs("div", { className: "tt-rp-preview", role: "status", "aria-live": "polite", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430", children: [_jsx(ReportPreviewNavBar, {}), _jsx("div", { className: "tt-rp-preview__main", children: _jsx("p", { className: "tt-rp-preview__muted", style: { margin: 0 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }) })] }));
}
export function ReportPreviewRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return _jsx(PreviewFallback, {});
    }
    if (!user || !canAccessTimeTracking(user)) {
        return _jsx(Navigate, { to: routes.home, replace: true });
    }
    if (!canViewTimeTrackingReports(user)) {
        return _jsx(Navigate, { to: routes.timeTracking, replace: true });
    }
    return (_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(PreviewFallback, {}), children: _jsx(ReportPreviewPage, {}) }));
}
