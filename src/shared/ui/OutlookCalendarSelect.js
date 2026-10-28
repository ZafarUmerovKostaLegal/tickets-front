import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { buildOutlookCalendarOptions, displayOutlookCalendarLabel, } from './outlookCalendarSelectUtils';
import './OutlookCalendarSelect.css';
const Chevron = () => (_jsx("svg", { className: "ocs__chev", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M6 9l6 6 6-6" }) }));
export function OutlookCalendarSelect({ value, onChange, calendars, showLabel, listAriaLabel, defaultCalendarLabel, allCalendarsId, allCalendarsLabel, disabled = false, layout = 'inline', minPanelWidth = 220, }) {
    const menuId = useId();
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState(null);
    const options = useMemo(() => buildOutlookCalendarOptions(calendars, defaultCalendarLabel, allCalendarsId && allCalendarsLabel
        ? { id: allCalendarsId, label: allCalendarsLabel }
        : undefined), [calendars, defaultCalendarLabel, allCalendarsId, allCalendarsLabel]);
    const selected = useMemo(() => options.find((o) => o.id === value) ?? options[0], [options, value]);
    const label = selected
        ? selected.id === 'default'
            ? defaultCalendarLabel
            : selected.id === allCalendarsId
                ? allCalendarsLabel ?? selected.name
                : displayOutlookCalendarLabel(selected.name)
        : '—';
    const placePanel = useCallback(() => {
        const el = triggerRef.current;
        if (!el) {
            setBox(null);
            return;
        }
        const r = el.getBoundingClientRect();
        const w = Math.max(r.width, minPanelWidth);
        const maxW = Math.max(0, typeof window !== 'undefined' ? window.innerWidth - 16 : 0);
        const width = maxW > 0 ? Math.min(w, maxW) : w;
        let left = r.left;
        if (typeof window !== 'undefined' && maxW > 0) {
            const rightEdge = r.left + width;
            if (rightEdge > window.innerWidth - 8)
                left = Math.max(8, window.innerWidth - 8 - width);
        }
        setBox({ top: r.bottom + 4, left, width });
    }, [minPanelWidth]);
    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        placePanel();
        window.addEventListener('resize', placePanel);
        window.addEventListener('scroll', placePanel, true);
        return () => {
            window.removeEventListener('resize', placePanel);
            window.removeEventListener('scroll', placePanel, true);
        };
    }, [open, placePanel]);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e) => {
            const target = e.target;
            if (triggerRef.current?.contains(target) || panelRef.current?.contains(target))
                return;
            setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    const onPick = (id) => {
        onChange(id);
        setOpen(false);
    };
    return (_jsxs("div", { className: `ocs${layout === 'block' ? ' ocs--block' : ''}`, children: [_jsx("span", { className: "ocs__label", id: `${menuId}-lbl`, children: showLabel }), _jsxs("button", { ref: triggerRef, type: "button", className: "ocs__trigger", disabled: disabled, "aria-disabled": disabled, "aria-haspopup": "listbox", "aria-expanded": open, "aria-controls": open ? `${menuId}-list` : undefined, "aria-labelledby": `${menuId}-lbl`, onClick: () => {
                    if (!disabled)
                        setOpen((v) => !v);
                }, children: [_jsx("span", { className: "ocs__trigger-text", children: label }), _jsx(Chevron, {})] }), open && box && typeof document !== 'undefined'
                ? createPortal(_jsx("div", { ref: panelRef, id: `${menuId}-list`, className: "ocs__panel", style: {
                        position: 'fixed',
                        top: box.top,
                        left: box.left,
                        width: box.width,
                        zIndex: 6000,
                    }, role: "listbox", "aria-label": listAriaLabel, onKeyDown: (e) => {
                        if (e.key === 'Escape')
                            setOpen(false);
                    }, children: _jsx("ul", { className: "ocs__ul", role: "none", children: options.map((o) => {
                            const isSelected = o.id === value;
                            const rowLabel = o.id === 'default'
                                ? defaultCalendarLabel
                                : o.id === allCalendarsId
                                    ? allCalendarsLabel ?? o.name
                                    : displayOutlookCalendarLabel(o.name);
                            return (_jsx("li", { role: "none", className: "ocs__li", children: _jsxs("button", { type: "button", role: "option", "aria-selected": isSelected, className: `ocs__opt${isSelected ? ' ocs__opt--active' : ''}${o.isKosta ? ' ocs__opt--kosta' : ''}`, onClick: () => onPick(o.id), children: [_jsx("span", { className: "ocs__opt-label", children: rowLabel }), o.isKosta ? (_jsx("span", { className: "ocs__kosta-badge", "aria-hidden": true, children: "Kosta" })) : null] }) }, o.id));
                        }) }) }), document.body)
                : null] }));
}
