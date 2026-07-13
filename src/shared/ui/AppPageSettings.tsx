import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { applyTheme, getInitialTheme, THEME_KEY, type AppTheme } from '@shared/lib/theme';
import { IconMoon, IconSun } from '@widgets/sidebar/ui/SidebarIcons';
import { HeaderUserMenu } from './HeaderUserMenu';
import { useI18n } from '@shared/i18n';
import '@shared/styles/app-page-settings.css';

function readTheme(): AppTheme {
    if (typeof document === 'undefined')
        return getInitialTheme();
    const fromBody = document.body.getAttribute('data-theme');
    if (fromBody === 'dark' || fromBody === 'light')
        return fromBody;
    return getInitialTheme();
}

export type AppPageSettingsProps = {
    className?: string;
    showUserMenu?: boolean;
    beforeUserMenu?: ReactNode;
};

export function AppPageSettings({ className, showUserMenu = false, beforeUserMenu }: AppPageSettingsProps) {
    const { t } = useI18n();
    const [theme, setTheme] = useState<AppTheme>(readTheme);
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark'))
                setTheme(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next: AppTheme = prev === 'light' ? 'dark' : 'light';
            applyTheme(next);
            return next;
        });
    }, []);
    const rootClass = ['app-page-settings', className].filter(Boolean).join(' ');
    const themeLabel = theme === 'dark' ? t('header.themeLight') : t('header.themeDark');
    return (
        <div className={rootClass}>
            <div
                className="app-header-actions"
                role="toolbar"
                aria-label={showUserMenu ? t('header.themeAndProfile') : t('header.themeOnly')}
            >
                <button
                    type="button"
                    className="app-header-action app-header-action--icon"
                    title={themeLabel}
                    aria-label={themeLabel}
                    onClick={toggleTheme}
                >
                    <span className="app-header-action__icon" aria-hidden>
                        {theme === 'dark' ? <IconSun /> : <IconMoon />}
                    </span>
                </button>
                {beforeUserMenu}
                {showUserMenu ? <HeaderUserMenu variant="standalone" /> : null}
            </div>
        </div>
    );
}
