import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, } from 'react';
export function ReportPreviewFilterPopover({ title, 'aria-label': ariaLabel, children, active = false, }) {
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState(null);
    const wrapRef = useRef(null);
    const panelRef = useRef(null);
    const updateBox = useCallback(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const r = el.getBoundingClientRect();
        const w = Math.min(320, Math.max(220, window.innerWidth - 24));
        let left = r.right - w;
        left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
        setBox({ top: r.bottom + 6, left, width: w });
    }, []);
    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        updateBox();
    }, [open, updateBox]);
    useEffect(() => {
        if (!open)
            return;
        const onScroll = () => {
            updateBox();
        };
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [open, updateBox]);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (e) => {
            const n = e.target;
            if (wrapRef.current?.contains(n) || panelRef.current?.contains(n))
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
    const panel = open && box && typeof document !== 'undefined'
        ? createPortal(_jsx("div", { ref: panelRef, className: "tt-rp-xlf__panel--portal", role: "dialog", "aria-label": ariaLabel, style: {
                position: 'fixed',
                top: box.top,
                left: box.left,
                width: box.width,
                zIndex: 6000,
            }, onMouseDown: (e) => e.stopPropagation(), children: children }), document.body)
        : null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `tt-rp-xlf${open ? ' tt-rp-xlf--open' : ''}${active ? ' tt-rp-xlf--active' : ''}`, ref: wrapRef, children: _jsx("button", { type: "button", className: "tt-rp-xlf__trigger", "aria-expanded": open, "aria-haspopup": "true", "aria-label": ariaLabel, title: title, onClick: () => setOpen((o) => !o), children: _jsx("span", { className: "tt-rp-xlf__chev", "aria-hidden": true, children: "\u25BC" }) }) }), panel] }));
}
