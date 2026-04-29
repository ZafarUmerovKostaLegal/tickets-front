import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { logout } from '@shared/lib';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';

const IconUserSimple = () => (<svg className="header-user-menu__user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
  <circle cx="12" cy="8" r="4"/>
  <path d="M20 21a8 8 0 0 0-16 0"/>
  </svg>);

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

function shortDisplayName(displayName: string | null | undefined, email: string | undefined): string {
    if (!displayName?.trim())
        return email?.split('@')[0] || 'Пользователь';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1)
        return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${last[0]}.`;
}

const ChevronDown = () => (<svg className="header-user-menu__chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <path d="m6 9 6 6 6-6"/>
  </svg>);

export type HeaderUserMenuProps = {
    
    variant?: 'default' | 'inCard';
};

export function HeaderUserMenu({ variant = 'default' }: HeaderUserMenuProps) {
    const { user, loading } = useCurrentUser();
    const triggerId = useId();
    const [open, setOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const onToggle = useCallback(() => setOpen((v) => !v), []);
    const close = useCallback(() => setOpen(false), []);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node))
                close();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                close();
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, close]);
    const name = loading ? '…' : shortDisplayName(user?.display_name, user?.email);
    const roleText = loading ? '…' : (user?.role || '—');
    const rootClass = variant === 'inCard' ? 'header-user-menu header-user-menu--in-card' : 'header-user-menu';
    return (<div className={rootClass} ref={rootRef}>
      <button type="button" className="header-user-menu__trigger" onClick={onToggle} aria-expanded={open} aria-haspopup="menu" aria-label="Меню пользователя" id={triggerId}>
        <span className="header-user-menu__avatar-wrap" aria-hidden>
          {user?.picture && !loading
            ? (<img src={user.picture} className="header-user-menu__avatar" alt="" width={40} height={40}/>)
            : user && !loading
                ? (<span className="header-user-menu__avatar header-user-menu__avatar--initials">
                    {getInitials(user.display_name ?? '', user.email ?? '')}
                  </span>)
                : (<span className="header-user-menu__avatar header-user-menu__avatar--empty">
                    <IconUserSimple />
                  </span>)}
        </span>
        <span className="header-user-menu__text">
          <span className="header-user-menu__name">{name}</span>
          <span className="header-user-menu__role">{roleText}</span>
        </span>
        <span className={`header-user-menu__chevron${open ? ' header-user-menu__chevron--open' : ''}`}>
          <ChevronDown />
        </span>
      </button>
      {open && (<div className="header-user-menu__dropdown" role="menu" aria-labelledby={triggerId}>
          <button type="button" className="header-user-menu__item" role="menuitem" onClick={() => {
                close();
                setLogoutConfirm(true);
            }}>
            Выйти
          </button>
        </div>)}
      <LogoutConfirmDialog open={logoutConfirm} onCancel={() => setLogoutConfirm(false)} onConfirm={() => {
        setLogoutConfirm(false);
        void logout();
    }}/>
    </div>);
}
