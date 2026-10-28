import { jsx as _jsx } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { EnsureTimeTrackingI18n } from '@shared/i18n';
import { canAccessTimeTracking } from '@entities/time-tracking/model/timeTrackingAccess';
const TimeTrackingPage = lazy(() => import('@pages/time-tracking').then((m) => ({ default: m.TimeTrackingPage })));
function TtRouteFallback({ label }) {
    return (_jsx("div", { className: "time-page", role: "status", "aria-live": "polite", "aria-label": label, children: _jsx("main", { className: "time-page__main", style: { minHeight: '50vh' } }) }));
}
export function TimeTrackingRoute() {
    const { user, loading } = useCurrentUser();
    if (loading) {
        return _jsx(TtRouteFallback, { label: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u043E\u0444\u0438\u043B\u044F" });
    }
    if (!user || !canAccessTimeTracking(user)) {
        return _jsx(Navigate, { to: routes.home, replace: true });
    }
    return (_jsx(EnsureTimeTrackingI18n, { fallback: _jsx(TtRouteFallback, { label: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), children: _jsx(Suspense, { fallback: _jsx(TtRouteFallback, { label: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0443\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), children: _jsx(TimeTrackingPage, {}) }) }));
}
