import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Providers } from './providers';
import { AppErrorPage } from './ui';
import { MobileApiConfigGate } from './ui/MobileApiConfigGate';
import { DesktopApiConfigGate } from './ui/DesktopApiConfigGate';
import { StartupStatus } from './startupStatus';
import '@shared/styles/index.css';
import { APP_LOGO_PATH } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { isAuthenticated } from '@shared/lib/auth';
import { ensureCurrentUserLoaded } from '@shared/hooks';
const TT_MINUTE_MIGRATION_KEY = 'tt_minute_migration_v1';
function runOneTimeTimeTrackingCacheReset() {
    if (typeof window === 'undefined')
        return;
    try {
        if (window.localStorage.getItem(TT_MINUTE_MIGRATION_KEY))
            return;
        window.localStorage.setItem(TT_MINUTE_MIGRATION_KEY, '1');
        window.dispatchEvent(new Event('tt-reports-invalidate'));
    }
    catch {
    }
}
function AppSplash() {
    const { t } = useI18n();
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const duration = 2500;
        const start = performance.now();
        let rafId;
        const tick = (now) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - (1 - t) ** 2;
            setProgress(Math.min(Math.round(eased * 95), 95));
            if (t < 1)
                rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, []);
    return (_jsx("div", { className: "app-splash", children: _jsxs("div", { className: "app-splash__inner", children: [_jsx("img", { src: APP_LOGO_PATH, alt: "", className: "app-splash__logo-mark", width: 56, height: 82, draggable: false }), _jsxs("div", { className: "app-splash__brand", children: [_jsx("span", { className: "app-splash__brand-title", children: t('brand.title') }), _jsx("span", { className: "app-splash__brand-sub", children: t('brand.subtitle') })] }), _jsxs("div", { className: "app-splash__progress-wrap", children: [_jsxs("svg", { className: "app-splash__progress-ring", viewBox: "0 0 36 36", children: [_jsx("circle", { className: "app-splash__progress-bg", cx: "18", cy: "18", r: "15.9" }), _jsx("circle", { className: "app-splash__progress-fill", cx: "18", cy: "18", r: "15.9", strokeDasharray: `${progress} 100`, transform: "rotate(-90 18 18)" })] }), _jsxs("span", { className: "app-splash__progress-text", children: [progress, "%"] })] })] }) }));
}
export function App() {
    const { t } = useI18n();
    const [startupStatus, setStartupStatus] = useState(StartupStatus.Idle);
    const [startupError, setStartupError] = useState(null);
    useEffect(() => {
        if (!isAuthenticated())
            return;
        if (startupStatus !== StartupStatus.Idle)
            return;
        setStartupStatus(StartupStatus.Checking);
        setStartupError(null);
        runOneTimeTimeTrackingCacheReset();
        ensureCurrentUserLoaded()
            .then(() => {
            setStartupStatus(StartupStatus.Ready);
        })
            .catch((e) => {
            setStartupError(e instanceof Error ? e.message : t('app.startupError'));
            setStartupStatus(StartupStatus.Error);
        });
    }, [startupStatus, t]);
    const handleRetry = () => {
        setStartupError(null);
        setStartupStatus(StartupStatus.Idle);
    };
    if (isAuthenticated() && startupStatus === StartupStatus.Checking) {
        return _jsx(AppSplash, {});
    }
    if (isAuthenticated() && startupStatus === StartupStatus.Error) {
        return (_jsx(AppErrorPage, { message: startupError ?? t('app.startupError'), onRetry: handleRetry }));
    }
    return (_jsx(DesktopApiConfigGate, { children: _jsx(MobileApiConfigGate, { children: _jsx(Providers, {}) }) }));
}
