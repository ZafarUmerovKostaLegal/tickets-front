import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { REPORT_PREVIEW_SCOPE_DEFAULT, REPORT_PREVIEW_SCOPE_PALETTE, } from '../lib/reportPreviewScopePalette';
export function ReportPreviewScopeColorPicker({ value, usedColors = [], disabled = false, title, 'aria-label': ariaLabel, onPick, }) {
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState(null);
    const wrapRef = useRef(null);
    const panelRef = useRef(null);
    const current = (value ?? '').trim().toUpperCase() || null;
    const usedSet = new Set(usedColors.map((c) => c.toUpperCase()));
    const paletteSet = new Set(REPORT_PREVIEW_SCOPE_PALETTE);
    const extraUsed = usedColors
        .map((c) => c.toUpperCase())
        .filter((c) => /^#[0-9A-F]{6}$/.test(c) && !paletteSet.has(c));
    const updateBox = useCallback(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const r = el.getBoundingClientRect();
        const panelW = 196;
        const panelH = 220;
        let left = r.left;
        left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
        let top = r.bottom + 6;
        if (top + panelH > window.innerHeight - 8 && r.top - panelH - 6 > 8)
            top = r.top - panelH - 6;
        setBox({ top, left });
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
        const onScroll = () => updateBox();
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
    const pick = (color) => {
        onPick(color.toUpperCase());
        setOpen(false);
    };
    const panel = open && box && typeof document !== 'undefined'
        ? createPortal(_jsxs("div", { ref: panelRef, className: "tt-rp-scope-picker__panel", role: "dialog", "aria-label": ariaLabel, style: { top: box.top, left: box.left }, onMouseDown: (e) => e.stopPropagation(), children: [_jsx("div", { className: "tt-rp-scope-picker__title", children: "\u0426\u0432\u0435\u0442 Scope" }), _jsx("div", { className: "tt-rp-scope-picker__grid", role: "listbox", "aria-label": "\u041F\u0430\u043B\u0438\u0442\u0440\u0430", children: REPORT_PREVIEW_SCOPE_PALETTE.map((color) => {
                        const on = current === color;
                        const used = usedSet.has(color);
                        return (_jsx("button", { type: "button", role: "option", "aria-selected": on, className: `tt-rp-scope-picker__swatch${on ? ' tt-rp-scope-picker__swatch--on' : ''}${used ? ' tt-rp-scope-picker__swatch--used' : ''}`, style: { background: color }, title: used ? `${color} · уже в отчёте` : color, onClick: () => pick(color) }, color));
                    }) }), extraUsed.length > 0 ? (_jsxs("div", { className: "tt-rp-scope-picker__used", children: [_jsx("div", { className: "tt-rp-scope-picker__used-label", children: "\u0423\u0436\u0435 \u0432 \u043E\u0442\u0447\u0451\u0442\u0435" }), _jsx("div", { className: "tt-rp-scope-picker__grid tt-rp-scope-picker__grid--used", role: "group", "aria-label": "\u0423\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0446\u0432\u0435\u0442\u0430", children: extraUsed.map((color) => (_jsx("button", { type: "button", className: `tt-rp-scope-picker__swatch${current === color ? ' tt-rp-scope-picker__swatch--on' : ''} tt-rp-scope-picker__swatch--used`, style: { background: color }, title: `${color} · уже в отчёте`, onClick: () => pick(color) }, color))) })] })) : null, !current ? (_jsx("p", { className: "tt-rp-scope-picker__hint", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0446\u0432\u0435\u0442 \u0438\u0437 \u043F\u0430\u043B\u0438\u0442\u0440\u044B" })) : (_jsx("p", { className: "tt-rp-scope-picker__hint", children: current }))] }), document.body)
        : null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "tt-rp-scope-picker", ref: wrapRef, children: _jsx("button", { type: "button", className: `tt-rp-mtable__row-act tt-rp-mtable__row-act--scope${current ? ' tt-rp-mtable__row-act--scope-on' : ''}${open ? ' tt-rp-mtable__row-act--scope-open' : ''}`, title: title, "aria-label": ariaLabel, "aria-expanded": open, "aria-haspopup": "dialog", disabled: disabled, onClick: () => setOpen((o) => !o), children: _jsx("span", { className: "tt-rp-mtable__row-act-ico tt-rp-mtable__row-scope-swatch", "aria-hidden": true, style: current ? { background: current } : { background: REPORT_PREVIEW_SCOPE_DEFAULT, opacity: 0.35 } }) }) }), panel] }));
}
