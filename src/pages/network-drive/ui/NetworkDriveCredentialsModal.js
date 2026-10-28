import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId } from 'react';
import { NetworkDriveCredentialsForm } from './NetworkDriveCredentialsForm';
export function NetworkDriveCredentialsModal(p) {
    const titleId = useId();
    const onKeyDown = useCallback((e) => {
        if (e.key === 'Escape' && p.open) {
            e.preventDefault();
            p.onClose();
        }
    }, [p]);
    useEffect(() => {
        if (!p.open) {
            return;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [p.open, onKeyDown]);
    if (!p.open) {
        return null;
    }
    return (_jsx("div", { className: "ndrive-credmodal", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, children: _jsxs("div", { className: "ndrive-credmodal__panel", children: [_jsxs("div", { className: "ndrive-credmodal__head", children: [_jsx("h2", { className: "ndrive-credmodal__title", id: titleId, children: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0441\u0435\u0442\u0438" }), _jsx("button", { type: "button", className: "ndrive-credmodal__x", onClick: p.onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsx(NetworkDriveCredentialsForm, { variant: "modal", onRequestClose: p.onClose, unc: p.unc, onUncChange: p.onUncChange, username: p.username, onUsernameChange: p.onUsernameChange, password: p.password, onPasswordChange: p.onPasswordChange, rememberSessionPassword: p.rememberSessionPassword, onRememberSessionPasswordChange: p.onRememberSessionPasswordChange, onSave: p.onSave, onClear: p.onClear, hasSaved: p.hasSaved, lastSavedAt: p.lastSavedAt })] }) }));
}
