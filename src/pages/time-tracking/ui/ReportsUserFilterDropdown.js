import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { compareRuLabels } from '@shared/lib';
import { useI18n } from '@shared/i18n';
const IcoChevDown = () => (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
const IcoUser = () => (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: [_jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "12", cy: "7", r: "4" })] }));
const IcoCheck = () => (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", "aria-hidden": true, children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
export function ReportsUserFilterDropdown({ users, selected, onChange, disabled = false, }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [menuLayout, setMenuLayout] = useState(null);
    const ref = useRef(null);
    const menuRef = useRef(null);
    const searchRef = useRef(null);
    const computeMenuLayout = useCallback(() => {
        const root = ref.current;
        if (!root)
            return null;
        const rect = root.getBoundingClientRect();
        const pad = 10;
        const gap = 6;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = Math.max(260, Math.min(380, vw - pad * 2));
        let left = rect.right - width;
        left = Math.min(Math.max(left, pad), vw - width - pad);
        const preferBelowTop = rect.bottom + gap;
        const spaceBelow = vh - preferBelowTop - pad;
        const spaceAbove = rect.top - pad - gap;
        const listCap = 320;
        let top;
        let maxHeight;
        if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
            top = preferBelowTop;
            maxHeight = Math.max(160, Math.min(listCap, spaceBelow));
        }
        else {
            maxHeight = Math.max(160, Math.min(listCap, spaceAbove));
            top = Math.max(pad, rect.top - gap - maxHeight);
        }
        return { top, left, width, maxHeight };
    }, []);
    const sortedUsers = useMemo(() => [...users].sort((a, b) => {
        const cmp = compareRuLabels(a.displayName, b.displayName);
        if (cmp !== 0)
            return cmp;
        return compareRuLabels(a.email, b.email);
    }), [users]);
    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = !q
            ? sortedUsers
            : sortedUsers.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        return base;
    }, [sortedUsers, search]);
    useEffect(() => {
        if (!open)
            setSearch('');
    }, [open]);
    useLayoutEffect(() => {
        if (!open) {
            setMenuLayout(null);
            return;
        }
        setMenuLayout(computeMenuLayout());
    }, [open, computeMenuLayout]);
    useEffect(() => {
        if (!open)
            return;
        const sync = () => {
            const L = computeMenuLayout();
            if (L)
                setMenuLayout(L);
        };
        window.addEventListener('resize', sync);
        window.addEventListener('scroll', sync, true);
        return () => {
            window.removeEventListener('resize', sync);
            window.removeEventListener('scroll', sync, true);
        };
    }, [open, computeMenuLayout]);
    useEffect(() => {
        if (!open || !menuLayout)
            return;
        const id = window.setTimeout(() => searchRef.current?.focus(), 40);
        return () => clearTimeout(id);
    }, [open, menuLayout]);
    useEffect(() => {
        if (!open)
            return;
        const h = (e) => {
            const t = e.target;
            if (ref.current?.contains(t) || menuRef.current?.contains(t))
                return;
            setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const label = selected.length === 0
        ? t('timeTrackingPage.reports.header.allEmployees')
        : selected.length === 1
            ? (users.find((u) => u.id === selected[0])?.displayName ?? t('timeTrackingPage.reports.header.oneEmployee'))
            : t('timeTrackingPage.reports.userFilter.employeesCount').replace('{count}', String(selected.length));
    function toggle(id) {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    }
    const menu = open && menuLayout
        ? createPortal(_jsx("div", { ref: menuRef, className: "rp-user-filter__menu rp-user-filter__menu--fixed", style: { top: menuLayout.top, left: menuLayout.left, width: menuLayout.width, maxHeight: menuLayout.maxHeight }, children: _jsxs("div", { className: "rp-user-filter__menu-inner", children: [_jsxs("div", { className: "rp-user-filter__header", children: [_jsx("span", { children: t('timeTrackingPage.reports.userFilter.employees') }), selected.length > 0 && (_jsx("button", { type: "button", className: "rp-user-filter__clear", onClick: () => onChange([]), children: t('timeTrackingPage.reports.userFilter.clear') }))] }), _jsx("div", { className: "rp-user-filter__search", children: _jsx("input", { ref: searchRef, type: "search", className: "rp-user-filter__search-input", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('timeTrackingPage.reports.userFilter.searchPlaceholder'), "aria-label": t('timeTrackingPage.reports.userFilter.searchAria'), autoComplete: "off", spellCheck: false }) }), _jsx("div", { className: "rp-user-filter__list", children: sortedUsers.length === 0 ? (_jsx("p", { className: "rp-user-filter__empty", children: t('timeTrackingPage.reports.userFilter.noUsers') })) : filteredUsers.length === 0 ? (_jsx("p", { className: "rp-user-filter__empty", children: t('timeTrackingPage.common.noMatch') })) : (filteredUsers.map((u) => (_jsxs("label", { className: "rp-user-filter__item", children: [_jsx("span", { className: `rp-user-filter__check${selected.includes(u.id) ? ' rp-user-filter__check--on' : ''}`, children: selected.includes(u.id) && _jsx(IcoCheck, {}) }), _jsx("input", { type: "checkbox", checked: selected.includes(u.id), onChange: () => toggle(u.id), tabIndex: -1 }), _jsxs("span", { className: "rp-user-filter__item-text", children: [_jsx("span", { className: "rp-user-filter__name", children: u.displayName }), _jsx("span", { className: "rp-user-filter__email", title: u.email, children: u.email })] })] }, u.id)))) })] }) }), document.body)
        : null;
    return (_jsxs("div", { className: "rp-user-filter", ref: ref, children: [_jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline rp-user-filter__btn", disabled: disabled, onClick: () => !disabled && setOpen((v) => !v), "aria-expanded": open, children: [_jsx(IcoUser, {}), _jsx("span", { className: "rp-user-filter__label", children: label }), _jsx(IcoChevDown, {})] }), menu] }));
}
