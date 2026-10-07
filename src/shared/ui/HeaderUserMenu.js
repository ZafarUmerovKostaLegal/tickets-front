import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { logout } from '@shared/lib/auth';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
const IconUserSimple = () => (_jsxs("svg", { className: "header-user-menu__user-icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "8", r: "4" }), _jsx("path", { d: "M20 21a8 8 0 0 0-16 0" })] }));
function getInitials(displayName, email) {
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
function shortDisplayName(displayName, email, fallbackUser) {
    if (!displayName?.trim())
        return email?.split('@')[0] || fallbackUser;
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1)
        return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${last[0]}.`;
}
const ChevronDown = () => (_jsx("svg", { className: "header-user-menu__chevron-icon", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m6 9 6 6 6-6" }) }));
export function HeaderUserMenu({ variant = 'default' }) {
    const { t } = useI18n();
    const { user, loading } = useCurrentUser();
    const triggerId = useId();
    const [open, setOpen] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const rootRef = useRef(null);
    const onToggle = useCallback(() => setOpen((v) => !v), []);
    const close = useCallback(() => setOpen(false), []);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target))
                close();
        };
        const onKey = (e) => {
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
    const name = loading ? t('common.loading') : shortDisplayName(user?.display_name, user?.email, t('common.user'));
    const roleText = loading ? t('common.loading') : (user?.role || '—');
    const isStandalone = variant === 'standalone' || variant === 'inCard';
    const rootClass = isStandalone
        ? 'header-user-menu header-user-menu--standalone'
        : 'header-user-menu';
    return (_jsxs("div", { className: rootClass, ref: rootRef, children: [_jsxs("button", { type: "button", className: "header-user-menu__trigger", onClick: onToggle, "aria-expanded": open, "aria-haspopup": "menu", "aria-label": t('header.userMenu'), id: triggerId, children: [_jsx("span", { className: "header-user-menu__avatar-wrap", "aria-hidden": true, children: user?.picture && !loading
                            ? (_jsx("img", { src: user.picture, className: "header-user-menu__avatar", alt: "", width: 32, height: 32 }))
                            : user && !loading
                                ? (_jsx("span", { className: "header-user-menu__avatar header-user-menu__avatar--initials", children: getInitials(user.display_name ?? '', user.email ?? '') }))
                                : (_jsx("span", { className: "header-user-menu__avatar header-user-menu__avatar--empty", children: _jsx(IconUserSimple, {}) })) }), _jsxs("span", { className: "header-user-menu__text", children: [_jsx("span", { className: "header-user-menu__name", children: name }), _jsx("span", { className: "header-user-menu__role", children: roleText })] }), _jsx("span", { className: `header-user-menu__chevron${open ? ' header-user-menu__chevron--open' : ''}`, children: _jsx(ChevronDown, {}) })] }), open && (_jsxs("div", { className: "header-user-menu__dropdown", role: "menu", "aria-labelledby": triggerId, children: [_jsx(LanguageSwitcher, {}), _jsx("div", { className: "header-user-menu__dropdown-sep", role: "separator" }), _jsx("button", { type: "button", className: "header-user-menu__item", role: "menuitem", onClick: () => {
                            close();
                            setLogoutConfirm(true);
                        }, children: t('header.logout') })] })), _jsx(LogoutConfirmDialog, { open: logoutConfirm, onCancel: () => setLogoutConfirm(false), onConfirm: () => {
                    setLogoutConfirm(false);
                    void logout();
                } })] }));
}
