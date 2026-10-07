import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '@shared/config';
import { AppBackButton, AppPageSettings, AttentionBanner } from '@shared/ui';
import { useCurrentUser } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { useI18n } from '@shared/i18n';
import { isTimeTrackingHttpError, listTimeTrackingUsers } from '@entities/time-tracking';
import { usePartnerForReviewBadge } from '@entities/time-tracking/lib/usePartnerForReviewBadge';
import { TABS } from '@entities/time-tracking/model/constants';
import { canAccessTimeTracking, canViewTimeTrackingReports, getVisibleTimeTrackingTabs, hasFullTimeTrackingTabs, resolveInitialTimeTab, } from '@entities/time-tracking/model/timeTrackingAccess';
import { ExpensesPanel, InvoicesPanel, ProjectsPanel, ReportsPanel, StatisticsPanel, TimeTrackingClientsPanel, TimeTrackingPanelSuspense, TimeTrackingSettingsPanel, TimeUsersPanel, TimesheetPanel, } from './timeTrackingLazyPanels';
import { IconMenu } from '@widgets/sidebar/ui/SidebarIcons';
import './TimeTrackingPage.css';
function nameInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function nameToHue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++)
        h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % 360;
}
function isAbortError(error) {
    return ((error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError'));
}
function UserAvatar({ user, size = 28 }) {
    const name = user.display_name?.trim() || user.email || String(user.id);
    const hue = nameToHue(name);
    const initials = nameInitials(name);
    return (_jsx("span", { className: "tt-scope-avatar", style: {
            width: size,
            height: size,
            fontSize: size * 0.38,
            background: `hsl(${hue},55%,52%)`,
        }, "aria-hidden": true, children: initials }));
}
function EmployeeScopePicker({ currentUser, ttScopeUsers, selectedId, onSelect }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef(null);
    const inputRef = useRef(null);
    const activeId = selectedId ?? currentUser.id;
    const options = useMemo(() => {
        const selfName = currentUser.display_name?.trim() || currentUser.email || `id ${currentUser.id}`;
        const self = { id: currentUser.id, display_name: `${t('timeTrackingPage.page.scopeMePrefix')} (${selfName})`, email: currentUser.email };
        const others = ttScopeUsers
            .filter((r) => r.id !== currentUser.id && !r.is_archived && !r.is_blocked)
            .sort((a, b) => {
            const na = (a.display_name?.trim() || a.email || '').toLowerCase();
            const nb = (b.display_name?.trim() || b.email || '').toLowerCase();
            return na.localeCompare(nb, 'ru');
        });
        return [self, ...others];
    }, [currentUser, ttScopeUsers, t]);
    const filtered = useMemo(() => {
        if (!query.trim())
            return options;
        const q = query.toLowerCase();
        return options.filter((u) => (u.display_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q));
    }, [options, query]);
    useEffect(() => {
        if (!open)
            return;
        function onDown(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);
    useEffect(() => {
        if (open)
            setTimeout(() => inputRef.current?.focus(), 40);
    }, [open]);
    const activeUser = options.find((u) => u.id === activeId) ?? options[0];
    const activeName = activeUser?.display_name?.trim() || activeUser?.email || '';
    function handleSelect(id) {
        onSelect(id === currentUser.id ? null : id);
        setOpen(false);
        setQuery('');
    }
    return (_jsxs("div", { className: "tt-scope-picker", ref: wrapRef, children: [_jsxs("button", { type: "button", className: `tt-scope-trigger${open ? ' tt-scope-trigger--open' : ''}`, onClick: () => setOpen((v) => !v), "aria-haspopup": "listbox", "aria-expanded": open, children: [_jsx(UserAvatar, { user: activeUser ?? currentUser, size: 26 }), _jsx("span", { className: "tt-scope-trigger__name", children: activeName }), _jsx("svg", { className: "tt-scope-trigger__chevron", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), open && (_jsxs("div", { className: "tt-scope-panel", role: "listbox", "aria-label": t('timeTrackingPage.page.scopePickerAria'), children: [_jsx("div", { className: "tt-scope-panel__header", children: _jsx("span", { className: "tt-scope-panel__title", children: t('timeTrackingPage.page.scopeEmployee') }) }), options.length > 5 && (_jsxs("div", { className: "tt-scope-panel__search", children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })] }), _jsx("input", { ref: inputRef, className: "tt-scope-panel__search-input", placeholder: t('timeTrackingPage.page.scopeSearch'), value: query, onChange: (e) => setQuery(e.target.value) }), query && (_jsx("button", { type: "button", className: "tt-scope-panel__search-clear", onClick: () => setQuery(''), children: _jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] })), _jsxs("ul", { className: "tt-scope-panel__list", children: [filtered.length === 0 && (_jsx("li", { className: "tt-scope-panel__empty", children: t('timeTrackingPage.page.scopeEmpty') })), filtered.map((u) => {
                                const isActive = u.id === activeId;
                                const name = u.display_name?.trim() || u.email || `id ${u.id}`;
                                return (_jsx("li", { children: _jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `tt-scope-panel__item${isActive ? ' tt-scope-panel__item--active' : ''}`, onClick: () => handleSelect(u.id), children: [_jsx(UserAvatar, { user: u, size: 30 }), _jsx("span", { className: "tt-scope-panel__item-name", children: name }), isActive && (_jsx("svg", { className: "tt-scope-panel__check", width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }))] }) }, u.id));
                            })] })] }))] }));
}
const IconLock = () => (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }), _jsx("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })] }));
function TimePageInitSkeleton() {
    return (_jsxs("div", { className: "time-page-init-skel", "aria-hidden": "true", children: [_jsxs("div", { className: "time-page-init-skel__strip", children: [_jsxs("div", { className: "time-page-init-skel__strip-left", children: [_jsx("span", { className: "time-page-init-skel__btn-sm" }), _jsx("span", { className: "time-page-init-skel__btn-sm" }), _jsx("span", { className: "time-page-init-skel__heading" }), _jsx("span", { className: "time-page-init-skel__btn-sm" })] }), _jsxs("div", { className: "time-page-init-skel__strip-right", children: [_jsx("span", { className: "time-page-init-skel__seg-btn" }), _jsx("span", { className: "time-page-init-skel__seg-btn" })] })] }), _jsxs("div", { className: "time-page-init-skel__days", children: [[1, 2, 3, 4, 5, 6, 7].map((i) => (_jsxs("div", { className: "time-page-init-skel__day", style: { animationDelay: `${i * 0.04}s` }, children: [_jsx("span", { className: "time-page-init-skel__day-label" }), _jsx("span", { className: "time-page-init-skel__day-num" }), _jsx("div", { className: "time-page-init-skel__day-bar-wrap", children: _jsx("span", { className: "time-page-init-skel__day-bar", style: { height: `${20 + Math.sin(i) * 18}%` } }) }), _jsx("span", { className: "time-page-init-skel__day-h" })] }, i))), _jsxs("div", { className: "time-page-init-skel__total-col", children: [_jsx("span", { className: "time-page-init-skel__total-label" }), _jsx("span", { className: "time-page-init-skel__total-num" })] })] }), _jsx("div", { className: "time-page-init-skel__entries", children: [1, 2, 3].map((i) => (_jsxs("div", { className: "time-page-init-skel__row", style: { animationDelay: `${i * 0.06}s` }, children: [_jsx("span", { className: "time-page-init-skel__row-color" }), _jsxs("div", { className: "time-page-init-skel__row-text", children: [_jsx("span", { className: "time-page-init-skel__row-proj", style: { width: `${55 + i * 12}%` } }), _jsx("span", { className: "time-page-init-skel__row-task", style: { width: `${35 + i * 8}%` } })] }), _jsx("div", { className: "time-page-init-skel__row-cells", children: [1, 2, 3, 4, 5, 6, 7].map((d) => (_jsx("span", { className: "time-page-init-skel__cell" }, d))) })] }, i))) })] }));
}
const VALID_TABS = TABS.map(t => t.id);
function readTabFromUrl() {
    try {
        const q = new URLSearchParams(window.location.search).get('tab');
        if (q && VALID_TABS.includes(q))
            return q;
    }
    catch {
    }
    return null;
}
const TT_SCOPE_STORAGE = 'tt_manager_scope_user_id';
function readStoredScopeUserId() {
    try {
        const raw = sessionStorage.getItem(TT_SCOPE_STORAGE);
        if (raw == null || raw === '')
            return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    catch {
        return null;
    }
}
export function TimeTrackingPage() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, loading } = useCurrentUser();
    const [activeTab, setActiveTab] = useState(() => readTabFromUrl() ?? 'timesheet');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [managedScopeUserId, setManagedScopeUserId] = useState(() => readStoredScopeUserId());
    const [ttScopeUsers, setTtScopeUsers] = useState([]);
    const [ttScopeLoadError, setTtScopeLoadError] = useState(null);
    const hasAccess = !loading && canAccessTimeTracking(user);
    const accessDenied = !loading && user != null && !canAccessTimeTracking(user);
    const { badge: forReviewBadge, count: forReviewCount } = usePartnerForReviewBadge(hasAccess && canViewTimeTrackingReports(user));
    const forReviewBadgeAria = forReviewCount > 0
        ? t('timeTrackingPage.reports.forReview.pendingBadgeAria').replace('{count}', String(forReviewCount))
        : undefined;
    const visibleTabDefs = useMemo(() => {
        const ids = new Set(getVisibleTimeTrackingTabs(user));
        return TABS.filter((tab) => ids.has(tab.id)).map((tab) => ({
            id: tab.id,
            label: t(`timeTrackingPage.tabs.${tab.id}`),
        }));
    }, [user, t]);
    const activeTabLabel = useMemo(() => visibleTabDefs.find((tab) => tab.id === activeTab)?.label ?? t('timeTrackingPage.page.title'), [visibleTabDefs, activeTab, t]);
    const isTtManager = Boolean(user && hasFullTimeTrackingTabs(user));
    useEffect(() => {
        if (loading || !user || !hasAccess)
            return;
        const allowed = getVisibleTimeTrackingTabs(user);
        if (!allowed.includes(activeTab))
            return;
        const urlTab = searchParams.get('tab');
        if (urlTab === activeTab)
            return;
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set('tab', activeTab);
            return p;
        }, { replace: true });
    }, [activeTab, loading, user, hasAccess, searchParams, setSearchParams]);
    useEffect(() => {
        if (loading || !user || !isTtManager) {
            setTtScopeUsers([]);
            setTtScopeLoadError(null);
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        void listTimeTrackingUsers(controller.signal)
            .then((rows) => {
            if (cancelled)
                return;
            const list = Array.isArray(rows) ? rows.filter((r) => !isHiddenSystemUser(r)) : [];
            setTtScopeUsers(list);
            setTtScopeLoadError(null);
        })
            .catch((e) => {
            if (cancelled || isAbortError(e))
                return;
            const msg = e instanceof Error ? e.message : String(e);
            const forbidden = isTimeTrackingHttpError(e, 403) ||
                /403|forbidden|недостаточно|запрещ/i.test(msg);
            const unavailable = isTimeTrackingHttpError(e, 502) || isTimeTrackingHttpError(e, 503);
            setTtScopeLoadError({
                forbidden,
                message: forbidden
                    ? t('timeTrackingPage.page.scopeLoadForbidden')
                    : unavailable
                        ? t('timeTrackingPage.page.serviceUnavailable')
                        : msg || t('timeTrackingPage.page.scopeLoadFailed'),
            });
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [loading, user, isTtManager, t]);
    const managedEntriesUserRow = useMemo(() => {
        if (!user || managedScopeUserId == null || managedScopeUserId === user.id)
            return null;
        return ttScopeUsers.find((r) => r.id === managedScopeUserId) ?? null;
    }, [user, managedScopeUserId, ttScopeUsers]);
    const setManagedScope = useCallback((id) => {
        setManagedScopeUserId(id);
        try {
            if (id == null || id <= 0)
                sessionStorage.removeItem(TT_SCOPE_STORAGE);
            else
                sessionStorage.setItem(TT_SCOPE_STORAGE, String(id));
        }
        catch {
        }
    }, []);
    useEffect(() => {
        if (!user?.id)
            return;
        if (managedScopeUserId == null || managedScopeUserId === user.id)
            return;
        if (ttScopeUsers.length === 0)
            return;
        if (!ttScopeUsers.some((r) => r.id === managedScopeUserId)) {
            setManagedScope(null);
        }
    }, [user?.id, managedScopeUserId, ttScopeUsers, setManagedScope]);
    useEffect(() => {
        if (loading || !user)
            return;
        const allowed = getVisibleTimeTrackingTabs(user);
        if (allowed.length === 0)
            return;
        setActiveTab(prev => {
            if (allowed.includes(prev))
                return prev;
            return resolveInitialTimeTab(user, readTabFromUrl());
        });
    }, [loading, user]);
    function handleTabChange(id) {
        if (!getVisibleTimeTrackingTabs(user).includes(id))
            return;
        if (id === activeTab)
            return;
        setActiveTab(id);
    }
    function handleTabChangeFromSidebar(id) {
        handleTabChange(id);
        setMobileNavOpen(false);
    }
    useEffect(() => {
        if (!mobileNavOpen)
            return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        function onKeyDown(e) {
            if (e.key === 'Escape')
                setMobileNavOpen(false);
        }
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileNavOpen]);
    useEffect(() => {
        setMobileNavOpen(false);
    }, [activeTab]);
    const headerManagerTrailing = useMemo(() => {
        if (loading || !hasAccess || !user || !isTtManager)
            return null;
        if (activeTab !== 'timesheet' && activeTab !== 'expenses')
            return null;
        if (ttScopeLoadError) {
            return (_jsx("div", { className: "time-page__navbar-manager", children: _jsxs("span", { className: "time-page__navbar-manager-err", title: ttScopeLoadError.message, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }), ttScopeLoadError.forbidden
                            ? t('timeTrackingPage.page.noAccess')
                            : t('timeTrackingPage.page.scopeUnavailable')] }) }));
        }
        return (_jsx("div", { className: "time-page__navbar-manager", children: _jsx(EmployeeScopePicker, { currentUser: user, ttScopeUsers: ttScopeUsers, selectedId: managedScopeUserId, onSelect: setManagedScope }) }));
    }, [
        loading,
        hasAccess,
        user,
        isTtManager,
        activeTab,
        ttScopeLoadError,
        managedScopeUserId,
        ttScopeUsers,
        setManagedScope,
        t,
    ]);
    return (_jsx("div", { className: "time-page time-page--enter", children: _jsxs("main", { className: "time-page__main", children: [accessDenied && (_jsx("div", { className: "time-page__dev-overlay", role: "status", "aria-label": t('timeTrackingPage.page.accessDeniedAria'), children: _jsxs("div", { className: "time-page__dev-overlay-inner", children: [_jsx("span", { className: "time-page__dev-overlay-icon", "aria-hidden": true, children: _jsx(IconLock, {}) }), _jsx("p", { className: "time-page__dev-overlay-text", children: t('timeTrackingPage.page.accessDeniedText') }), _jsx(AppBackButton, { to: routes.home })] }) })), _jsxs("nav", { className: "time-page__navbar", "aria-label": t('timeTrackingPage.page.navAria'), children: [_jsx(AppBackButton, { to: routes.home, hideLabelOnMobile: true }), _jsx("button", { type: "button", className: "time-page__navbar-menu-btn", onClick: () => setMobileNavOpen(true), "aria-label": t('timeTrackingPage.page.openMenu'), "aria-expanded": mobileNavOpen, "aria-controls": "time-page-mobile-nav", children: _jsx(IconMenu, {}) }), _jsx("div", { className: "time-page__navbar-sep time-page__navbar-sep--logo", "aria-hidden": "true" }), _jsx("button", { type: "button", className: "time-page__navbar-logo-btn", onClick: () => navigate(routes.home), "aria-label": t('brand.homeAria'), title: t('brand.homeAria'), children: _jsx("img", { src: "/logo.svg", alt: "", className: "time-page__navbar-logo-img", width: 26, height: 38, draggable: false }) }), loading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "time-page__navbar-sep", "aria-hidden": "true" }), _jsx("div", { className: "time-page__navbar-tabs time-page__navbar-tabs--skel", "aria-hidden": "true", children: [118, 60, 56, 48, 72, 58, 66, 80, 64].map((w, i) => (_jsx("span", { className: "time-page__navbar-tab-skel", style: { width: w } }, i))) })] })) : hasAccess && user ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "time-page__navbar-sep time-page__navbar-sep--tabs", "aria-hidden": "true" }), _jsx("span", { className: "time-page__navbar-current", title: activeTabLabel, children: activeTabLabel }), _jsx("div", { className: "time-page__navbar-tabs", role: "tablist", "aria-label": t('timeTrackingPage.page.sectionsTablistAria'), children: visibleTabDefs.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === tab.id, "aria-controls": `time-tab-${tab.id}`, id: `time-tab-btn-${tab.id}`, className: `time-page__navbar-tab${activeTab === tab.id ? ' time-page__navbar-tab--active' : ''}`, onClick: () => handleTabChange(tab.id), "aria-label": tab.id === 'reports' && forReviewBadgeAria ? `${tab.label}. ${forReviewBadgeAria}` : undefined, children: _jsxs("span", { className: "time-page__navbar-tab-inner", children: [tab.label, tab.id === 'reports' && forReviewBadge ? (_jsx("span", { className: "time-page__navbar-tab-badge", "aria-hidden": true, children: forReviewBadge })) : null] }) }, tab.id))) })] })) : null, _jsx("div", { className: "time-page__navbar-spacer" }), _jsx("div", { className: "time-page__navbar-settings", children: _jsx(AppPageSettings, {}) }), headerManagerTrailing] }), hasAccess && user && forReviewCount > 0 && activeTab !== 'reports' ? (_jsx(AttentionBanner, { text: t('attentionBanner.reportsForReview').replace('{count}', String(forReviewCount)), actionLabel: t('attentionBanner.reportsGo'), onAction: () => {
                        setActiveTab('reports');
                        setSearchParams((prev) => {
                            const p = new URLSearchParams(prev);
                            p.set('tab', 'reports');
                            p.set('reportsSection', 'for-review');
                            return p;
                        }, { replace: true });
                    } })) : null, typeof document !== 'undefined' && hasAccess && user ? createPortal(_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: `time-page__mobile-nav-backdrop${mobileNavOpen ? ' time-page__mobile-nav-backdrop--visible' : ''}`, "aria-hidden": !mobileNavOpen, tabIndex: mobileNavOpen ? 0 : -1, onClick: () => setMobileNavOpen(false) }), _jsxs("aside", { id: "time-page-mobile-nav", className: `time-page__mobile-nav${mobileNavOpen ? ' time-page__mobile-nav--open' : ''}`, "aria-hidden": !mobileNavOpen, "aria-label": t('timeTrackingPage.page.sidebarAria'), children: [_jsxs("div", { className: "time-page__mobile-nav-head", children: [_jsxs("div", { className: "time-page__mobile-nav-brand", children: [_jsx("img", { src: "/logo.svg", alt: "", className: "time-page__mobile-nav-logo", width: 22, height: 32, draggable: false }), _jsx("span", { className: "time-page__mobile-nav-title", children: t('timeTrackingPage.page.title') })] }), _jsx("button", { type: "button", className: "time-page__mobile-nav-close", onClick: () => setMobileNavOpen(false), "aria-label": t('timeTrackingPage.page.closeMenu') })] }), _jsx("nav", { className: "time-page__mobile-nav-list", role: "tablist", "aria-label": t('timeTrackingPage.page.sectionsTablistAria'), children: visibleTabDefs.map((tab) => (_jsxs("button", { type: "button", role: "tab", "aria-selected": activeTab === tab.id, "aria-controls": `time-tab-${tab.id}`, className: `time-page__mobile-nav-item${activeTab === tab.id ? ' time-page__mobile-nav-item--active' : ''}`, onClick: () => handleTabChangeFromSidebar(tab.id), "aria-label": tab.id === 'reports' && forReviewBadgeAria ? `${tab.label}. ${forReviewBadgeAria}` : undefined, children: [_jsx("span", { className: "time-page__mobile-nav-item-label", children: tab.label }), tab.id === 'reports' && forReviewBadge ? (_jsx("span", { className: "time-page__mobile-nav-item-badge", "aria-hidden": true, children: forReviewBadge })) : null] }, tab.id))) }), headerManagerTrailing ? (_jsx("div", { className: "time-page__mobile-nav-foot", children: headerManagerTrailing })) : null] })] }), document.body) : null, loading && _jsx(TimePageInitSkeleton, {}), hasAccess && user && (_jsxs(_Fragment, { children: [activeTab === 'users' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-users", "aria-labelledby": "time-tab-btn-users", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(TimeUsersPanel, {}) }) })), activeTab === 'projects' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-projects", "aria-labelledby": "time-tab-btn-projects", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(ProjectsPanel, {}) }) })), activeTab === 'expenses' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-expenses", "aria-labelledby": "time-tab-btn-expenses", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(ExpensesPanel, { managedExpenseAuthorId: managedScopeUserId }) }) })), activeTab === 'timesheet' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-timesheet", "aria-labelledby": "time-tab-btn-timesheet", children: _jsx("div", { className: "tsp-wrap", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(TimesheetPanel, { managedEntriesUserId: managedScopeUserId, managedEntriesUserRow: managedEntriesUserRow }) }) }) })), activeTab === 'reports' && canViewTimeTrackingReports(user) && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-reports", "aria-labelledby": "time-tab-btn-reports", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(ReportsPanel, {}) }) })), activeTab === 'statistics' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-statistics", "aria-labelledby": "time-tab-btn-statistics", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(StatisticsPanel, {}) }) })), activeTab === 'invoices' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-invoices", "aria-labelledby": "time-tab-btn-invoices", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(InvoicesPanel, {}) }) })), activeTab === 'settings' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-settings", "aria-labelledby": "time-tab-btn-settings", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(TimeTrackingSettingsPanel, {}) }) })), activeTab === 'clients' && (_jsx("div", { className: "time-page__content time-page__content--enter", role: "tabpanel", id: "time-tab-clients", "aria-labelledby": "time-tab-btn-clients", children: _jsx("div", { className: "tt-settings", children: _jsx(TimeTrackingPanelSuspense, { children: _jsx(TimeTrackingClientsPanel, {}) }) }) }))] }))] }) }));
}
export default TimeTrackingPage;
