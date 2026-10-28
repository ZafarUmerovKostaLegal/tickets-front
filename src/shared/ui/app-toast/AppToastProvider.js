import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerAppToastHandlers } from './appToastGate';
import './AppToast.css';
const AppToastContext = createContext(null);
export function useAppToast() {
    const v = useContext(AppToastContext);
    if (!v)
        throw new Error('useAppToast must be used within AppToastProvider');
    return v;
}
function ToastIcon({ variant }) {
    if (variant === 'success') {
        return (_jsx("svg", { className: "app-toast__ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M20 6L9 17l-5-5" }) }));
    }
    if (variant === 'error') {
        return (_jsxs("svg", { className: "app-toast__ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("path", { d: "M15 9l-6 6M9 9l6 6" })] }));
    }
    if (variant === 'warning') {
        return (_jsxs("svg", { className: "app-toast__ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), _jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), _jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })] }));
    }
    return (_jsxs("svg", { className: "app-toast__ico", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "16", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })] }));
}
export function AppToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const lastPushRef = useRef(null);
    const remove = useCallback((id) => {
        setItems((q) => q.filter((x) => x.id !== id));
    }, []);
    const pushToast = useCallback((opts) => {
        const variant = opts.variant ?? 'info';
        const durationMs = opts.durationMs ?? 6500;
        const message = String(opts.message ?? '').trim();
        if (!message)
            return;
        const now = Date.now();
        const prev = lastPushRef.current;
        if (prev && prev.message === message && now - prev.at < 450)
            return;
        lastPushRef.current = { message, at: now };
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        let scheduled = false;
        setItems((q) => {
            if (q.some((x) => x.message === message))
                return q;
            scheduled = true;
            return [...q, { id, message, variant }];
        });
        if (scheduled) {
            window.setTimeout(() => {
                remove(id);
            }, durationMs);
        }
    }, [remove]);
    useEffect(() => {
        registerAppToastHandlers({ pushToast });
        return () => registerAppToastHandlers(null);
    }, [pushToast]);
    const ctx = useMemo(() => ({ pushToast }), [pushToast]);
    const stack = (_jsx("div", { className: "app-toast-host", "aria-live": "polite", "aria-relevant": "additions text", children: items.map((t) => (_jsxs("div", { className: `app-toast app-toast--${t.variant}`, role: "status", children: [_jsx("span", { className: "app-toast__glyph", "aria-hidden": true, children: _jsx(ToastIcon, { variant: t.variant }) }), _jsx("p", { className: "app-toast__msg", children: t.message }), _jsx("button", { type: "button", className: "app-toast__close", onClick: () => remove(t.id), "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", "aria-hidden": true, children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }, t.id))) }));
    return (_jsxs(AppToastContext.Provider, { value: ctx, children: [children, typeof document !== 'undefined' ? createPortal(stack, document.body) : null] }));
}
