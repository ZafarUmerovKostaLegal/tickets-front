import { useState, useCallback, useEffect } from 'react';
import { applyTheme, getInitialTheme, THEME_KEY, type AppTheme } from '@shared/lib/theme';
import { IconMoon } from '@widgets/sidebar/ui/SidebarIcons';
import { HeaderUserMenu } from './HeaderUserMenu';
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
};

export function AppPageSettings({ className, showUserMenu = false }: AppPageSettingsProps) {
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
    return (<div className={rootClass}>
      <div className="hub-header-card" role="group" aria-label={showUserMenu ? 'Тема оформления и профиль' : 'Тема оформления'}>
        <button type="button" className="hub-header-card__theme" title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} onClick={toggleTheme}>
          <span className="hub-header-card__theme-icon" aria-hidden>
            <IconMoon />
          </span>
        </button>
        {showUserMenu && (<>
          <span className="hub-header-card__divider" aria-hidden/>
          <div className="hub-header-card__user">
            <HeaderUserMenu variant="inCard"/>
          </div>
        </>)}
      </div>
    </div>);
}
