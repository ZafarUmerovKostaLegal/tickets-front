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
import { getMe } from '@entities/user';
import { setCachedUser } from '@shared/hooks';
const TT_MINUTE_MIGRATION_KEY = 'tt_minute_migration_v1';
function runOneTimeTimeTrackingCacheReset(): void {
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
        let rafId: number;
        const tick = (now: number) => {
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
    return (<div className="app-splash">
      <div className="app-splash__inner">
        <img
          src={APP_LOGO_PATH}
          alt=""
          className="app-splash__logo-mark"
          width={56}
          height={82}
          draggable={false}
        />
        <div className="app-splash__brand">
          <span className="app-splash__brand-title">{t('brand.title')}</span>
          <span className="app-splash__brand-sub">{t('brand.subtitle')}</span>
        </div>
        <div className="app-splash__progress-wrap">
          <svg className="app-splash__progress-ring" viewBox="0 0 36 36">
            <circle className="app-splash__progress-bg" cx="18" cy="18" r="15.9"/>
            <circle className="app-splash__progress-fill" cx="18" cy="18" r="15.9" strokeDasharray={`${progress} 100`} transform="rotate(-90 18 18)"/>
          </svg>
          <span className="app-splash__progress-text">{progress}%</span>
        </div>
      </div>
    </div>);
}
export function App() {
    const { t } = useI18n();
    const [startupStatus, setStartupStatus] = useState<StartupStatus>(StartupStatus.Idle);
    const [startupError, setStartupError] = useState<string | null>(null);
    useEffect(() => {
        if (!isAuthenticated())
            return;
        if (startupStatus !== StartupStatus.Idle)
            return;
        setStartupStatus(StartupStatus.Checking);
        setStartupError(null);
        runOneTimeTimeTrackingCacheReset();
        getMe()
            .then((user) => {
            setCachedUser(user);
            setStartupStatus(StartupStatus.Ready);
        })
            .catch((e) => {
            setCachedUser(null, e instanceof Error ? e : new Error(String(e)));
            setStartupError(e instanceof Error ? e.message : t('app.startupError'));
            setStartupStatus(StartupStatus.Error);
        });
    }, [startupStatus, t]);
    const handleRetry = () => {
        setStartupError(null);
        setStartupStatus(StartupStatus.Idle);
    };
    if (isAuthenticated() && startupStatus === StartupStatus.Checking) {
        return <AppSplash />;
    }
    if (isAuthenticated() && startupStatus === StartupStatus.Error) {
        return (<AppErrorPage message={startupError ?? t('app.startupError')} onRetry={handleRetry}/>);
    }
    return (
        <DesktopApiConfigGate>
            <MobileApiConfigGate>
                <Providers />
            </MobileApiConfigGate>
        </DesktopApiConfigGate>
    );
}
