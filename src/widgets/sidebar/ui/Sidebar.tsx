import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedNavLink, LogoutConfirmDialog } from '@shared/ui';
import { routes } from '@shared/config';
import { logout } from '@shared/lib';
import { applyTheme, getInitialTheme, type AppTheme } from '@shared/lib/theme';
import { useCurrentUser } from '@shared/hooks';
import { getVisibleAppNavItems } from '../model/appNavConfig';
import { IconTicket, IconMoon, IconLogOut, IconUser, IconChevronLeft, IconChevronRight, } from './SidebarIcons';
import './Sidebar.css';
function getInitials(displayName: string, email: string): string {
    const name = displayName?.trim();
    if (name) {
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length >= 2)
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        if (parts[0].length)
            return parts[0].slice(0, 2).toUpperCase();
    }
    if (email?.trim())
        return email.trim().slice(0, 2).toUpperCase();
    return '?';
}
type SidebarProps = {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
    isMobile?: boolean;
};
export function Sidebar({ isCollapsed = false, onToggleCollapse, isMobileOpen = false, onCloseMobile, isMobile = false, }: SidebarProps) {
    const [theme, setTheme] = useState<AppTheme>(() => {
        const initial = getInitialTheme();
        if (typeof document !== 'undefined') {
            document.body.setAttribute('data-theme', initial);
        }
        return initial;
    });
    const toggleTheme = () => {
        const next: AppTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        applyTheme(next);
    };
    const showCollapsed = !isMobile && isCollapsed;
    const { user, loading } = useCurrentUser();
    const visibleNavItems = getVisibleAppNavItems(user, loading);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const sidebarContent = (<>
      {isMobile && (<button type="button" className={`sidebar__backdrop ${isMobileOpen ? 'sidebar__backdrop--visible' : ''}`} aria-hidden={!isMobileOpen} onClick={onCloseMobile} tabIndex={isMobileOpen ? 0 : -1}/>)}
      <aside className={`sidebar ${showCollapsed ? 'sidebar--collapsed' : ''} ${isMobile ? 'sidebar--mobile' : ''} ${isMobile && isMobileOpen ? 'sidebar--mobile-open' : ''}`} aria-label="Навигация">
        <div className="sidebar__header">
          <div className="sidebar__header-brand">
            <span className="sidebar__header-icon">
              <IconTicket />
            </span>
            <span className="sidebar__header-title">Тикет-система</span>
          </div>
          {!isMobile && onToggleCollapse && (<button type="button" className="sidebar__toggle" onClick={onToggleCollapse} aria-label={showCollapsed ? 'Развернуть меню' : 'Свернуть меню'} title={showCollapsed ? 'Развернуть' : 'Свернуть'}>
              {showCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
            </button>)}
          {isMobile && onCloseMobile && (<button type="button" className="sidebar__close" onClick={onCloseMobile} aria-label="Закрыть меню"/>)}
        </div>
        <div className="sidebar__user">
          <span className="sidebar__user-icon">
            {user?.picture ? (<img src={user.picture} alt="" className="sidebar__user-avatar" width={40} height={40}/>) : user ? (<span className="sidebar__user-avatar sidebar__user-avatar--initials">
                {getInitials(user?.display_name ?? '', user?.email ?? '')}
              </span>) : (<IconUser />)}
          </span>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">
              {loading ? '…' : (user?.display_name || 'Пользователь')}
            </span>
            <span className="sidebar__user-dept">
              {loading ? '…' : (user?.role || 'Отдел')}
            </span>
          </div>
        </div>
        <nav className="sidebar__nav">
          <ul className="sidebar__nav-list">
            {visibleNavItems.map(({ to, label, icon: Icon }) => {
            const IconComponent = Icon;
            return (<li key={label}>
                  <AnimatedNavLink to={to} className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`} end={to === routes.home} onClick={isMobile ? onCloseMobile : undefined} title={label}>
                    <span className="sidebar__link-icon"><IconComponent /></span>
                    <span className="sidebar__link-text">{label}</span>
                  </AnimatedNavLink>
                </li>);
        })}
          </ul>
        </nav>
        <div className="sidebar__footer">
          <button type="button" className="sidebar__btn" title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'} onClick={toggleTheme}>
            <span className="sidebar__btn-icon"><IconMoon /></span>
            <span className="sidebar__btn-text">
              {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
            </span>
          </button>
          <button type="button" className="sidebar__btn sidebar__btn--logout" onClick={() => setLogoutConfirm(true)} title="Выход">
            <span className="sidebar__btn-icon"><IconLogOut /></span>
            <span className="sidebar__btn-text">Выход</span>
          </button>
        </div>
        <LogoutConfirmDialog open={logoutConfirm} onCancel={() => setLogoutConfirm(false)} onConfirm={() => {
        setLogoutConfirm(false);
        void logout();
    }}/>
      </aside>
    </>);
    if (isMobile && typeof document !== 'undefined') {
        return createPortal(sidebarContent, document.body);
    }
    return sidebarContent;
}
