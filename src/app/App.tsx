import { useEffect, useState } from 'react';
import { Providers } from './providers';
import { AppErrorPage } from './ui';
import { StartupStatus } from './startupStatus';
import '@shared/styles/index.css';
import { useFontsReady } from '@shared/hooks';
import { isAuthenticated } from '@shared/lib';
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
const DEFAULT_ERROR_MESSAGE = 'Не удалось загрузить данные. Проверьте подключение и повторите попытку.';
function AppSplash() {
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
        <div className="app-splash__logo">Тикет-система</div>
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
    const fontsReady = useFontsReady();
    const [startupStatus, setStartupStatus] = useState<StartupStatus>(StartupStatus.Idle);
    const [startupError, setStartupError] = useState<string | null>(null);
    useEffect(() => {
        if (!fontsReady)
            return;
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
            setStartupError(e instanceof Error ? e.message : DEFAULT_ERROR_MESSAGE);
            setStartupStatus(StartupStatus.Error);
        });
    }, [fontsReady, startupStatus]);
    const handleRetry = () => {
        setStartupError(null);
        setStartupStatus(StartupStatus.Idle);
    };
    if (!fontsReady) {
        return <AppSplash />;
    }
    if (isAuthenticated() && startupStatus === StartupStatus.Checking) {
        return <AppSplash />;
    }
    if (isAuthenticated() && startupStatus === StartupStatus.Error) {
        return (<AppErrorPage message={startupError ?? DEFAULT_ERROR_MESSAGE} onRetry={handleRetry}/>);
    }
    return <Providers />;
}
