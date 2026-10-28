import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function IconClose() {
    return (_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": true, children: _jsx("path", { d: "M18 6 6 18M6 6l12 12" }) }));
}
export function KostaDailyChatModalShell({ open, title, onClose, children, footer, className, ariaLabel, }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "kd-tg__modal-backdrop", role: "presentation", onClick: onClose, children: _jsxs("div", { className: `kd-tg__modal${className ? ` ${className}` : ''}`, role: "dialog", "aria-modal": "true", "aria-label": ariaLabel ?? title, onClick: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "kd-tg__modal-head", children: [_jsx("h2", { className: "kd-tg__modal-title", children: title }), _jsx("button", { type: "button", className: "kd-tg__modal-close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx(IconClose, {}) })] }), _jsx("div", { className: "kd-tg__modal-body", children: children }), footer ? (_jsx("footer", { className: "kd-tg__modal-foot", children: footer })) : null] }) }));
}
