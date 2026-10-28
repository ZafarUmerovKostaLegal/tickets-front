import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { isMeetingRoomAccount } from '@shared/lib/meetingRoomAccounts';
import { AppPageSettings } from '@shared/ui';
import { HeaderNotifications } from '@pages/home/ui/HeaderNotifications';
import './HomeHubTopBar.css';
function IconSearch() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "m20 20-3.5-3.5" })] }));
}
export function HomeHubTopBar({ searchQuery, onSearchChange }) {
    const { t } = useI18n();
    const { user, loading } = useCurrentUser();
    const meetingRoom = !loading && isMeetingRoomAccount(user);
    return (_jsx("header", { className: "home-hub-topbar", children: _jsxs("div", { className: `home-hub-topbar__inner${meetingRoom ? ' home-hub-topbar__inner--meeting-room' : ''}`, children: [_jsx(Link, { to: routes.home, className: "home-hub-topbar__brand", "aria-label": t('brand.homeAria'), children: _jsx("img", { src: "/KostaLegal-logo-02-black.svg", alt: "Kosta Legal", className: "home-hub-topbar__brand-logo", width: 439, height: 219, draggable: false }) }), meetingRoom ? null : (_jsxs("label", { className: "home-hub-topbar__search", children: [_jsx("span", { className: "home-hub-topbar__search-icon", "aria-hidden": true, children: _jsx(IconSearch, {}) }), _jsx("input", { type: "search", className: "home-hub-topbar__search-input", value: searchQuery, onChange: (e) => onSearchChange(e.target.value), placeholder: t('homeHub.searchPlaceholder'), "aria-label": t('homeHub.searchPlaceholder'), autoComplete: "off", spellCheck: false }), _jsx("kbd", { className: "home-hub-topbar__search-kbd", "aria-hidden": true, children: "/" })] })), _jsx("div", { className: "home-hub-topbar__actions", children: _jsx(AppPageSettings, { showUserMenu: true, beforeUserMenu: meetingRoom ? null : _jsx(HeaderNotifications, {}) }) })] }) }));
}
