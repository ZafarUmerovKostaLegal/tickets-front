import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { getAzureLoginUrl, AUTH_ERROR_AUTH_FAILED } from '@shared/config';
import { rememberDesktopAppOrigin } from '@shared/lib/desktopAuth';
import './LoginPage.css';
export function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const { state } = useLocation();
    const error = searchParams.get('error');
    const blockedMsg = state?.blocked ? 'Ваш аккаунт заблокирован. Обратитесь к администратору.' : null;
    const archivedMsg = state?.archived ? 'Ваш аккаунт в архиве. Обратитесь к администратору.' : null;
    const statusMsg = blockedMsg ?? archivedMsg;
    function handleLogin() {
        if (isLoading)
            return;
        setIsLoading(true);
        rememberDesktopAppOrigin();
        window.location.href = getAzureLoginUrl();
    }
    return (_jsxs("div", { className: "lp", children: [_jsx("div", { className: "lp__bg", "aria-hidden": true, children: _jsx("div", { className: "lp__mesh" }) }), _jsx("div", { className: "lp__form-panel", children: _jsxs("div", { className: "lp__card", children: [_jsx("div", { className: "lp__card-glow" }), _jsx("div", { className: "lp__badge", children: "Kosta Legal" }), _jsxs("div", { className: "lp__card-header", children: [_jsx("img", { src: "/logo.svg", alt: "", className: "lp__brand-logo", width: 48, height: 64, draggable: false }), _jsx("h2", { className: "lp__card-title", children: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C" }), _jsxs("p", { className: "lp__card-sub", children: ["\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u043A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 ", _jsx("strong", { children: "Microsoft 365" })] })] }), (error || statusMsg) && (_jsxs("div", { className: "lp__error", role: "alert", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }), _jsx("span", { children: statusMsg ?? (error === AUTH_ERROR_AUTH_FAILED
                                        ? 'Ошибка входа. Сервис авторизации недоступен. Попробуйте позже.'
                                        : 'Ошибка входа. Попробуйте снова.') })] })), _jsxs("button", { type: "button", className: `lp__btn${isLoading ? ' lp__btn--loading' : ''}`, onClick: handleLogin, disabled: isLoading, "aria-label": "\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Microsoft", "aria-busy": isLoading, children: [_jsx("span", { className: "lp__btn-shine" }), isLoading ? (_jsx("span", { className: "lp__btn-spinner", "aria-hidden": true })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "lp__btn-ms-icon", children: _jsxs("svg", { viewBox: "0 0 21 21", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("rect", { width: "10", height: "10", fill: "#F25022" }), _jsx("rect", { x: "11", width: "10", height: "10", fill: "#7FBA00" }), _jsx("rect", { y: "11", width: "10", height: "10", fill: "#00A4EF" }), _jsx("rect", { x: "11", y: "11", width: "10", height: "10", fill: "#FFB900" })] }) }), _jsx("span", { children: "\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Microsoft" })] }))] }), _jsxs("p", { className: "lp__card-note", children: ["\u041F\u0440\u043E\u0431\u043B\u0435\u043C\u044B \u0441\u043E \u0432\u0445\u043E\u0434\u043E\u043C? ", _jsx("a", { className: "lp__card-link", href: "mailto:it@kostalegal.com", children: "\u041E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u0432 IT-\u0441\u043B\u0443\u0436\u0431\u0443" })] })] }) })] }));
}
