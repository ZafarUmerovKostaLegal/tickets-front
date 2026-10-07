import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { logout } from '@shared/lib/auth';
import { applyTheme, getInitialTheme, THEME_KEY } from '@shared/lib/theme';
import { useI18n } from '@shared/i18n';
import { IconMoon, IconSun } from '@widgets/sidebar/ui/SidebarIcons';
import '../styles/AppErrorPage.css';
function classifyError(raw) {
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
function pad2(n) {
    return String(n).padStart(2, '0');
}
function buildCaseMeta(now) {
    const y = now.getFullYear();
    const md = `${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const hm = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    return {
        caseNo: `${y}-${md}-${hm}`,
        filedAt: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
    };
}
function readTheme() {
    if (typeof document === 'undefined')
        return getInitialTheme();
    const fromBody = document.body.getAttribute('data-theme');
    if (fromBody === 'dark' || fromBody === 'light')
        return fromBody;
    return getInitialTheme();
}
export function AppErrorPage({ message, onRetry }) {
    const { t } = useI18n();
    const [retrying, setRetrying] = useState(false);
    const [theme, setTheme] = useState(readTheme);
    const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    const caseMeta = useMemo(() => buildCaseMeta(new Date()), []);
    const kind = useMemo(() => classifyError(message), [message]);
    useEffect(() => {
        const onStorage = (e) => {
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
            const next = prev === 'light' ? 'dark' : 'light';
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
    return (_jsxs("div", { className: "app-error", children: [_jsxs("button", { type: "button", className: "app-error__theme", title: themeLabel, "aria-label": themeLabel, onClick: toggleTheme, children: [_jsx("span", { className: "app-error__theme-label", children: themeLabel }), _jsx("span", { className: "app-error__theme-icon", "aria-hidden": true, children: theme === 'dark' ? _jsx(IconSun, {}) : _jsx(IconMoon, {}) })] }), _jsxs("div", { className: "app-error__stage", children: [_jsxs("div", { className: "app-error__tab", "aria-hidden": true, children: [_jsx("span", { className: "app-error__tab-dot" }), t('app.errorPage.tab')] }), _jsxs("div", { className: "app-error__card", role: "alert", children: [_jsxs("div", { className: "app-error__left", children: [_jsxs("div", { className: "app-error__meta", children: [_jsx("span", { children: t('app.errorPage.caseNo').replace('{id}', caseMeta.caseNo) }), _jsx("span", { children: t('app.errorPage.filedAt').replace('{time}', caseMeta.filedAt) })] }), _jsx("p", { className: "app-error__act", children: t('app.errorPage.act') }), _jsx("h1", { className: "app-error__title", children: title }), _jsx("p", { className: "app-error__text", children: body }), _jsx("div", { className: "app-error__stamp", "aria-hidden": true, children: _jsx("span", { className: "app-error__stamp-ring", children: _jsx("span", { className: "app-error__stamp-text", children: t('app.errorPage.stamp') }) }) }), _jsxs("div", { className: "app-error__chips", children: [_jsx("span", { className: "app-error__chip", children: t('app.errorPage.tagServer') }), _jsx("span", { className: "app-error__chip", children: t('app.errorPage.tagNetwork') }), _jsx("span", { className: "app-error__chip", children: t('app.errorPage.tagSession') })] })] }), _jsxs("div", { className: "app-error__right", children: [_jsx("p", { className: "app-error__checks-title", children: t('app.errorPage.checkedTitle') }), _jsxs("ul", { className: "app-error__checks", children: [_jsxs("li", { className: `app-error__check${online ? ' app-error__check--ok' : ' app-error__check--bad'}`, children: [_jsx("span", { className: "app-error__check-mark", "aria-hidden": true, children: online ? '✓' : '✕' }), _jsx("span", { className: "app-error__check-label", children: t('app.errorPage.check.internet') }), _jsx("span", { className: "app-error__check-status", children: online ? t('app.errorPage.check.internetOk') : t('app.errorPage.check.internetBad') })] }), _jsxs("li", { className: "app-error__check app-error__check--bad", children: [_jsx("span", { className: "app-error__check-mark", "aria-hidden": true, children: "\u2715" }), _jsx("span", { className: "app-error__check-label", children: t('app.errorPage.check.vpn') }), _jsx("span", { className: "app-error__check-status", children: t('app.errorPage.check.vpnUnknown') })] }), _jsxs("li", { className: `app-error__check${kind === 'session' ? ' app-error__check--bad' : ' app-error__check--warn'}`, children: [_jsx("span", { className: "app-error__check-mark", "aria-hidden": true, children: kind === 'session' ? '✕' : '·' }), _jsx("span", { className: "app-error__check-label", children: t('app.errorPage.check.session') }), _jsx("span", { className: "app-error__check-status", children: sessionStatus })] })] }), _jsxs("div", { className: "app-error__actions", children: [_jsx("button", { type: "button", className: `app-error__btn app-error__btn--primary${retrying ? ' app-error__btn--loading' : ''}`, onClick: handleRetry, disabled: retrying, children: retrying
                                                    ? _jsx("span", { className: "app-error__spinner", "aria-hidden": true })
                                                    : t('app.errorPage.retry') }), _jsx("button", { type: "button", className: "app-error__btn app-error__btn--secondary", onClick: handleLogout, children: t('app.errorPage.logout') })] })] })] })] })] }));
}
