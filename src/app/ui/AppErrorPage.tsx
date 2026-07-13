import { useCallback, useEffect, useMemo, useState } from 'react';
import { logout } from '@shared/lib/auth';
import { applyTheme, getInitialTheme, THEME_KEY, type AppTheme } from '@shared/lib/theme';
import { useI18n } from '@shared/i18n';
import { IconMoon, IconSun } from '@widgets/sidebar/ui/SidebarIcons';
import '../styles/AppErrorPage.css';

type AppErrorPageProps = {
    message?: string;
    onRetry: () => void;
};

type ErrorKind = 'network' | 'session' | 'forbidden' | 'server' | 'generic';

function classifyError(raw: string | undefined): ErrorKind {
    const t = raw?.trim() ?? '';
    if (!t)
        return 'generic';
    if (/failed to fetch|networkerror|load failed|timeout|timed out|econnrefused|network/i.test(t))
        return 'network';
    if (/401|unauthorized|session|сесси/i.test(t))
        return 'session';
    if (/403|forbidden/i.test(t))
        return 'forbidden';
    if (/5\d\d|server error|internal server/i.test(t))
        return 'server';
    return 'generic';
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function buildCaseMeta(now: Date): { caseNo: string; filedAt: string } {
    const y = now.getFullYear();
    const md = `${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const hm = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    return {
        caseNo: `${y}-${md}-${hm}`,
        filedAt: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
    };
}

function readTheme(): AppTheme {
    if (typeof document === 'undefined')
        return getInitialTheme();
    const fromBody = document.body.getAttribute('data-theme');
    if (fromBody === 'dark' || fromBody === 'light')
        return fromBody;
    return getInitialTheme();
}

export function AppErrorPage({ message, onRetry }: AppErrorPageProps) {
    const { t } = useI18n();
    const [retrying, setRetrying] = useState(false);
    const [theme, setTheme] = useState<AppTheme>(readTheme);
    const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    const caseMeta = useMemo(() => buildCaseMeta(new Date()), []);
    const kind = useMemo(() => classifyError(message), [message]);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark'))
                setTheme(e.newValue);
        };
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener('storage', onStorage);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next: AppTheme = prev === 'light' ? 'dark' : 'light';
            applyTheme(next);
            return next;
        });
    }, []);

    const handleRetry = () => {
        setRetrying(true);
        onRetry();
    };

    const handleLogout = () => {
        logout();
    };

    const title = kind === 'network'
        ? t('app.errorPage.titleNetwork')
        : kind === 'session'
            ? t('app.errorPage.titleSession')
            : kind === 'forbidden'
                ? t('app.errorPage.titleForbidden')
                : kind === 'server'
                    ? t('app.errorPage.titleServer')
                    : t('app.errorPage.titleGeneric');

    const body = kind === 'network'
        ? t('app.errorPage.bodyNetwork')
        : kind === 'session'
            ? t('app.errorPage.bodySession')
            : kind === 'forbidden'
                ? t('app.errorPage.bodyForbidden')
                : kind === 'server'
                    ? t('app.errorPage.bodyServer')
                    : (message?.trim() || t('app.errorPage.bodyGeneric'));

    const sessionStatus = kind === 'session'
        ? t('app.errorPage.check.sessionExpired')
        : t('app.errorPage.check.sessionUnverified');

    const themeLabel = theme === 'dark' ? t('header.themeLight') : t('header.themeDark');

    return (
        <div className="app-error">
            <button
                type="button"
                className="app-error__theme"
                title={themeLabel}
                aria-label={themeLabel}
                onClick={toggleTheme}
            >
                <span className="app-error__theme-label">{themeLabel}</span>
                <span className="app-error__theme-icon" aria-hidden>
                    {theme === 'dark' ? <IconSun /> : <IconMoon />}
                </span>
            </button>

            <div className="app-error__stage">
                <div className="app-error__tab" aria-hidden>
                    <span className="app-error__tab-dot" />
                    {t('app.errorPage.tab')}
                </div>

                <div className="app-error__card" role="alert">
                    <div className="app-error__left">
                        <div className="app-error__meta">
                            <span>{t('app.errorPage.caseNo').replace('{id}', caseMeta.caseNo)}</span>
                            <span>{t('app.errorPage.filedAt').replace('{time}', caseMeta.filedAt)}</span>
                        </div>

                        <p className="app-error__act">{t('app.errorPage.act')}</p>
                        <h1 className="app-error__title">{title}</h1>
                        <p className="app-error__text">{body}</p>

                        <div className="app-error__stamp" aria-hidden>
                            <span className="app-error__stamp-ring">
                                <span className="app-error__stamp-text">{t('app.errorPage.stamp')}</span>
                            </span>
                        </div>

                        <div className="app-error__chips">
                            <span className="app-error__chip">{t('app.errorPage.tagServer')}</span>
                            <span className="app-error__chip">{t('app.errorPage.tagNetwork')}</span>
                            <span className="app-error__chip">{t('app.errorPage.tagSession')}</span>
                        </div>
                    </div>

                    <div className="app-error__right">
                        <p className="app-error__checks-title">{t('app.errorPage.checkedTitle')}</p>
                        <ul className="app-error__checks">
                            <li className={`app-error__check${online ? ' app-error__check--ok' : ' app-error__check--bad'}`}>
                                <span className="app-error__check-mark" aria-hidden>{online ? '✓' : '✕'}</span>
                                <span className="app-error__check-label">{t('app.errorPage.check.internet')}</span>
                                <span className="app-error__check-status">
                                    {online ? t('app.errorPage.check.internetOk') : t('app.errorPage.check.internetBad')}
                                </span>
                            </li>
                            <li className="app-error__check app-error__check--bad">
                                <span className="app-error__check-mark" aria-hidden>✕</span>
                                <span className="app-error__check-label">{t('app.errorPage.check.vpn')}</span>
                                <span className="app-error__check-status">{t('app.errorPage.check.vpnUnknown')}</span>
                            </li>
                            <li className={`app-error__check${kind === 'session' ? ' app-error__check--bad' : ' app-error__check--warn'}`}>
                                <span className="app-error__check-mark" aria-hidden>{kind === 'session' ? '✕' : '·'}</span>
                                <span className="app-error__check-label">{t('app.errorPage.check.session')}</span>
                                <span className="app-error__check-status">{sessionStatus}</span>
                            </li>
                        </ul>

                        <div className="app-error__actions">
                            <button
                                type="button"
                                className={`app-error__btn app-error__btn--primary${retrying ? ' app-error__btn--loading' : ''}`}
                                onClick={handleRetry}
                                disabled={retrying}
                            >
                                {retrying
                                    ? <span className="app-error__spinner" aria-hidden />
                                    : t('app.errorPage.retry')}
                            </button>
                            <button type="button" className="app-error__btn app-error__btn--secondary" onClick={handleLogout}>
                                {t('app.errorPage.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
