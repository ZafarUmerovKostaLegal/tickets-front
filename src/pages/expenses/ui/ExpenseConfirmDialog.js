import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
function DialogSpinner({ className }) {
    return (_jsxs("svg", { className: className ?? 'exp-panel-btn__spinner', viewBox: "0 0 24 24", "aria-hidden": true, width: 18, height: 18, children: [_jsx("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "2.5", opacity: 0.2 }), _jsx("path", { fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", d: "M12 3a9 9 0 0 1 9 9" })] }));
}
export function ExpenseConfirmDialog({ isOpen, title, message, confirmLabel, cancelLabel = 'Отмена', confirmVariant = 'primary', busy = false, onConfirm, onClose, }) {
    const titleId = useId();
    if (!isOpen)
        return null;
    const confirmClass = confirmVariant === 'danger'
        ? 'exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger'
        : 'exp-panel-btn exp-panel-btn--primary';
    return (_jsx("div", { className: "exp-mod-backdrop", role: "presentation", children: _jsxs("div", { className: "exp-mod-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": titleId, onClick: e => e.stopPropagation(), children: [_jsx("h3", { id: titleId, className: "exp-mod-dialog__title", children: title }), _jsx("div", { className: "exp-mod-dialog__confirm-body", children: message }), _jsxs("div", { className: "exp-mod-dialog__ft", children: [_jsx("button", { type: "button", className: "exp-panel-btn exp-panel-btn--ghost", disabled: busy, onClick: onClose, children: cancelLabel }), _jsx("button", { type: "button", className: confirmClass, disabled: busy, "aria-busy": busy, onClick: () => void onConfirm(), children: busy ? (_jsxs(_Fragment, { children: [_jsx(DialogSpinner, {}), _jsx("span", { className: "exp-mod-dialog__confirm-busy-label", children: "\u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435\u2026" })] })) : (confirmLabel) })] })] }) }));
}
