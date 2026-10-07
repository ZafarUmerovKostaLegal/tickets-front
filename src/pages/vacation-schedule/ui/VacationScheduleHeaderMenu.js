import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
export function VacationScheduleHeaderMenu({ canManage, onAddEmployee, payrollShowColumns, onPayrollToggle, onPayrollParams, }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const onDown = (e) => {
            const el = wrapRef.current;
            if (el && e.target instanceof Node && !el.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);
    const run = useCallback((fn) => {
        setOpen(false);
        fn();
    }, []);
    return (_jsxs("div", { className: "vac-page-menu", ref: wrapRef, children: [_jsxs("button", { type: "button", className: `vac-page-menu__trigger${open ? ' vac-page-menu__trigger--open' : ''}`, onClick: () => setOpen((v) => !v), "aria-expanded": open, "aria-haspopup": "menu", children: ["\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F", _jsx("svg", { className: "vac-page-menu__chev", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "m6 9 6 6 6-6" }) })] }), open && (_jsxs("div", { className: "vac-page-menu__dropdown", role: "menu", children: [canManage && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "vac-page-menu__item", role: "menuitem", onClick: () => run(onAddEmployee), children: [_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("path", { d: "M19 8v6M22 11h-6" })] }), "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430"] }), _jsx("div", { className: "vac-page-menu__sep", role: "separator" })] })), _jsxs("button", { type: "button", className: `vac-page-menu__item vac-page-menu__item--check${payrollShowColumns ? ' vac-page-menu__item--checked' : ''}`, role: "menuitemcheckbox", "aria-checked": payrollShowColumns, onClick: () => run(onPayrollToggle), children: [_jsx("span", { className: "vac-page-menu__check", "aria-hidden": true, children: payrollShowColumns ? '✓' : '' }), "\u041E\u0446\u0435\u043D\u043A\u0430 \u043E\u0442\u043F\u0443\u0441\u043A\u043D\u044B\u0445 \u0438 \u0431\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u044B\u0445"] }), payrollShowColumns && (_jsx("button", { type: "button", className: "vac-page-menu__item", role: "menuitem", onClick: () => run(onPayrollParams), children: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0440\u0430\u0441\u0447\u0451\u0442\u0430\u2026" }))] }))] }));
}
