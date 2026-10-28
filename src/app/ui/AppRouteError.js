import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { routes } from '@shared/config';
import { isLikelyStaleBundleErrorMessage, STALE_BUNDLE_USER_MESSAGE, } from '@app/lib/staleBundleError';
function routeErrorToText(err) {
    if (isRouteErrorResponse(err))
        return err.statusText || `HTTP ${err.status}`;
    if (err instanceof Error)
        return err.message;
    return String(err ?? '');
}
export function AppRouteError() {
    const err = useRouteError();
    const message = routeErrorToText(err);
    const likelyStale = isLikelyStaleBundleErrorMessage(message);
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: "'Montserrat', system-ui, sans-serif",
            fontSize: '16px',
            lineHeight: 1.5,
        }, children: _jsxs("div", { style: { maxWidth: '32rem', textAlign: 'center' }, children: [_jsx("h1", { style: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.75rem' }, children: likelyStale ? 'Нужно обновить страницу' : 'Сбой при загрузке интерфейса' }), _jsx("p", { style: { margin: '0 0 1rem', opacity: 0.92 }, children: likelyStale
                        ? STALE_BUNDLE_USER_MESSAGE
                        : 'Попробуйте обновить страницу. Если ошибка повторяется — проверьте сеть и зайдите снова.' }), message && !likelyStale
                    ? (_jsxs("details", { style: { margin: '0 0 1rem', textAlign: 'left', opacity: 0.8, fontSize: '0.875rem' }, children: [_jsx("summary", { style: { cursor: 'pointer' }, children: "\u0422\u0435\u043A\u0441\u0442 \u043E\u0448\u0438\u0431\u043A\u0438" }), _jsx("pre", { style: {
                                    margin: '0.5rem 0 0',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    fontFamily: "'Montserrat', system-ui, sans-serif",
                                }, children: message })] }))
                    : null, _jsxs("div", { style: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }, children: [_jsx("button", { type: "button", onClick: () => window.location.reload(), style: {
                                padding: '0.6rem 1.1rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                background: '#4f46e5',
                                color: '#fff',
                                font: 'inherit',
                                cursor: 'pointer',
                            }, children: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443" }), _jsx("a", { href: routes.home, style: { alignSelf: 'center', color: '#93c5fd', textDecoration: 'underline' }, children: "\u041D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E" })] })] }) }));
}
