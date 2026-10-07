import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import './LogoutConfirmDialog.css';
export function LogoutConfirmDialog({ open, onCancel, onConfirm }) {
    const { t } = useI18n();
    const titleId = useId();
    const descId = useId();
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);
    if (!open || typeof document === 'undefined')
        return null;
    return createPortal(_jsx("div", { className: "logout-confirm", role: "presentation", children: _jsxs("div", { className: "logout-confirm__panel", role: "alertdialog", "aria-modal": "true", "aria-labelledby": titleId, "aria-describedby": descId, onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "logout-confirm__title", id: titleId, children: t('header.logoutTitle') }), _jsx("p", { className: "logout-confirm__text", id: descId, children: t('header.logoutText') }), _jsxs("div", { className: "logout-confirm__actions", children: [_jsx("button", { type: "button", className: "logout-confirm__btn", onClick: onCancel, autoFocus: true, children: t('common.cancel') }), _jsx("button", { type: "button", className: "logout-confirm__btn logout-confirm__btn--primary", onClick: onConfirm, children: t('header.logoutConfirm') })] })] }) }), document.body);
}
