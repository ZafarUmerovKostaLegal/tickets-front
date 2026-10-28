import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export function CorrespondenceRejectModal({ open, onClose, onConfirm, submitPending = false, }) {
    const titleId = useId();
    const fieldId = useId();
    const textareaRef = useRef(null);
    const [comment, setComment] = useState('');
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        setComment('');
        setError(null);
        const t = window.setTimeout(() => textareaRef.current?.focus(), 40);
        return () => window.clearTimeout(t);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitPending) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, submitPending]);
    if (!open)
        return null;
    const handleSubmit = () => {
        const next = comment.trim();
        if (!next) {
            setError('Укажите причину отказа');
            textareaRef.current?.focus();
            return;
        }
        onConfirm(next);
    };
    return createPortal(_jsx("div", { className: "corr-modal corr-modal--enter corr-modal--nested", role: "presentation", onMouseDown: (e) => {
            if (e.target === e.currentTarget && !submitPending)
                onClose();
        }, children: _jsxs("div", { className: "corr-modal__panel", role: "dialog", "aria-modal": true, "aria-labelledby": titleId, onMouseDown: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "corr-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { id: titleId, className: "corr-modal__title", children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C \u043F\u0438\u0441\u044C\u043C\u043E" }), _jsx("p", { className: "corr-modal__lead", children: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F \u2014 \u0430\u0432\u0442\u043E\u0440 \u043F\u043E\u043B\u0443\u0447\u0438\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u0438 \u0441\u043C\u043E\u0436\u0435\u0442 \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442." })] }), _jsx("button", { type: "button", className: "corr-modal__close", onClick: onClose, disabled: submitPending, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: `corr-modal__field${error ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", htmlFor: fieldId, children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043F\u0440\u0438 \u043E\u0442\u043A\u0430\u0437\u0435", ' ', _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx("textarea", { id: fieldId, ref: textareaRef, className: "corr-modal__textarea", rows: 5, placeholder: "\u041E\u043F\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C\u2026", value: comment, disabled: submitPending, "aria-invalid": Boolean(error), onChange: (e) => {
                                setComment(e.target.value);
                                if (error)
                                    setError(null);
                            }, onKeyDown: (e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            } }), error ? _jsx("p", { className: "corr-modal__err", children: error }) : null] }), _jsxs("div", { className: "corr-modal__actions", children: [_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", onClick: onClose, disabled: submitPending, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--danger", onClick: handleSubmit, disabled: submitPending || !comment.trim(), children: submitPending ? 'Отклонение…' : 'Отклонить' })] })] }) }), document.body);
}
