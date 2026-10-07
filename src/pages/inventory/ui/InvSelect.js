import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
export function InvSelect({ value, placeholder = 'Выберите', options, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const fn = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [open]);
    const selected = options.find((o) => o.value === value);
    return (_jsxs("div", { className: "inv-sel", ref: ref, children: [_jsxs("button", { type: "button", className: `inv-sel__trigger${open ? ' inv-sel__trigger--open' : ''}`, onClick: () => setOpen((v) => !v), "aria-haspopup": "listbox", "aria-expanded": open, children: [_jsx("span", { className: "inv-sel__value", children: selected?.label ?? placeholder }), _jsx("svg", { className: "inv-sel__chevron", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) })] }), _jsxs("div", { className: `inv-sel__drop${open ? ' inv-sel__drop--open' : ''}`, role: "listbox", children: [_jsx("button", { type: "button", className: `inv-sel__opt${value === '' ? ' inv-sel__opt--active' : ''}`, onClick: () => {
                            onChange('');
                            setOpen(false);
                        }, children: placeholder }), options.map((o) => (_jsx("button", { type: "button", className: `inv-sel__opt${value === o.value ? ' inv-sel__opt--active' : ''}`, onClick: () => {
                            onChange(o.value);
                            setOpen(false);
                        }, children: o.label }, String(o.value))))] })] }));
}
