import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { applyTheme, getInitialTheme, THEME_KEY } from '@shared/lib/theme';
import { IconMoon, IconSun } from '@widgets/sidebar/ui/SidebarIcons';
import { HeaderUserMenu } from './HeaderUserMenu';
import { useI18n } from '@shared/i18n';
import '@shared/styles/app-page-settings.css';
function readTheme() {
    if (typeof document === 'undefined')
        return getInitialTheme();
    const fromBody = document.body.getAttribute('data-theme');
    if (fromBody === 'dark' || fromBody === 'light')
        return fromBody;
    return getInitialTheme();
}
export function AppPageSettings({ className, showUserMenu = false, beforeUserMenu }) {
    const { t } = useI18n();
    const [theme, setTheme] = useState(readTheme);
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark'))
                setTheme(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            applyTheme(next);
            return next;
        });
    }, []);
    const rootClass = ['app-page-settings', className].filter(Boolean).join(' ');
    const themeLabel = theme === 'dark' ? t('header.themeLight') : t('header.themeDark');
    return (_jsx("div", { className: rootClass, children: _jsxs("div", { className: "app-header-actions", role: "toolbar", "aria-label": showUserMenu ? t('header.themeAndProfile') : t('header.themeOnly'), children: [_jsx("button", { type: "button", className: "app-header-action app-header-action--icon", title: themeLabel, "aria-label": themeLabel, onClick: toggleTheme, children: _jsx("span", { className: "app-header-action__icon", "aria-hidden": true, children: theme === 'dark' ? _jsx(IconSun, {}) : _jsx(IconMoon, {}) }) }), beforeUserMenu, showUserMenu ? _jsx(HeaderUserMenu, { variant: "standalone" }) : null] }) }));
}
