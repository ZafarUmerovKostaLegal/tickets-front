import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getApiBaseUrl } from '@shared/config';
import { isTauriDesktopClient } from '@shared/config/desktopClient';
export function DesktopApiConfigGate({ children }) {
    if (!isTauriDesktopClient() || getApiBaseUrl()) {
        return _jsx(_Fragment, { children: children });
    }
    return (_jsx("div", { role: "alert", style: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            fontFamily: "'Montserrat', system-ui, sans-serif",
            background: '#f8fafc',
            color: '#0f172a',
        }, children: _jsxs("div", { style: { maxWidth: '24rem', textAlign: 'center' }, children: [_jsx("h1", { style: { fontSize: '1.15rem', margin: '0 0 0.75rem' }, children: "\u041D\u0443\u0436\u0435\u043D \u0430\u0434\u0440\u0435\u0441 API" }), _jsxs("p", { style: { margin: '0 0 1rem', lineHeight: 1.5, color: '#475569' }, children: ["\u0421\u043E\u0431\u0435\u0440\u0438\u0442\u0435 desktop-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439", ' ', _jsx("code", { style: { fontSize: '0.85em' }, children: "VITE_API_BASE_URL" }), " \u2014 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0439 URL gateway (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, ", _jsx("code", { children: "https://ticketsback.kostalegal.com" }), ")."] }), _jsxs("p", { style: { margin: 0, fontSize: '0.85rem', color: '#64748b' }, children: ["\u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u0444\u0430\u0439\u043B ", _jsx("code", { children: ".env" }), " \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u043F\u0435\u0440\u0435\u0434 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439", ' ', _jsx("code", { children: "npm run desktop:build" }), "."] })] }) }));
}
