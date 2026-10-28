import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { logout } from '@shared/lib/auth';
import './AppErrorPage.css';
export function AppErrorPage({ message, onRetry }) {
    const [retrying, setRetrying] = useState(false);
    const handleRetry = () => {
        setRetrying(true);
        onRetry();
    };
    const handleLogout = () => {
        logout();
    };
    return (_jsxs("div", { className: "app-error", children: [_jsx("div", { className: "app-error__bg", "aria-hidden": true, children: _jsx("div", { className: "app-error__mesh" }) }), _jsxs("div", { className: "app-error__card", children: [_jsx("div", { className: "app-error__glow" }), _jsx("div", { className: "app-error__icon", "aria-hidden": true, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }), _jsx("path", { d: "M12 16h.01" })] }) }), _jsx("h1", { className: "app-error__title", children: "\u0427\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A" }), _jsx("p", { className: "app-error__text", children: message ?? 'Не удалось загрузить данные. Проверьте подключение к интернету или повторите попытку.' }), _jsxs("div", { className: "app-error__actions", children: [_jsx("button", { type: "button", className: `app-error__btn app-error__btn--primary${retrying ? ' app-error__btn--loading' : ''}`, onClick: handleRetry, disabled: retrying, children: retrying ? (_jsx("span", { className: "app-error__spinner", "aria-hidden": true })) : (_jsxs(_Fragment, { children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M21 2v6h-6" }), _jsx("path", { d: "M3 12a9 9 0 0 1 15-6.7L21 8" }), _jsx("path", { d: "M3 22v-6h6" }), _jsx("path", { d: "M21 12a9 9 0 0 1-15 6.7L3 16" })] }), "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C"] })) }), _jsxs("button", { type: "button", className: "app-error__btn app-error__btn--secondary", onClick: handleLogout, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("polyline", { points: "16 17 21 12 16 7" }), _jsx("line", { x1: "21", y1: "12", x2: "9", y2: "12" })] }), "\u0412\u044B\u0439\u0442\u0438"] })] })] })] }));
}
