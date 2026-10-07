import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
export function AdminSelect({ value, options, onChange, placeholder = 'Выберите', disabled = false, }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const [direction, setDirection] = useState('down');
    useEffect(() => {
        if (!open)
            return;
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);
    const selected = options.find((o) => o.value === value);
    const label = selected?.label ?? placeholder;
    useEffect(() => {
        if (!open || !ref.current)
            return;
        const rect = ref.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const preferUp = spaceBelow < 220 && rect.top > spaceBelow;
        setDirection(preferUp ? 'up' : 'down');
    }, [open]);
    return (_jsxs("div", { className: "ap-sel", ref: ref, children: [_jsxs("button", { type: "button", className: `ap-sel__trigger${open ? ' ap-sel__trigger--open' : ''}${disabled ? ' ap-sel__trigger--disabled' : ''}`, onClick: () => !disabled && setOpen((v) => !v), disabled: disabled, "aria-haspopup": "listbox", "aria-expanded": open, children: [_jsx("span", { className: "ap-sel__value", children: label }), _jsx("svg", { className: "ap-sel__chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), _jsx("div", { className: `ap-sel__drop${open ? ' ap-sel__drop--open' : ''}${direction === 'up' ? ' ap-sel__drop--up' : ''}`, role: "listbox", children: options.map((o) => (_jsx("button", { type: "button", className: `ap-sel__opt${value === o.value ? ' ap-sel__opt--active' : ''}`, onClick: () => { onChange(o.value); setOpen(false); }, children: o.label }, o.value))) })] }));
}
