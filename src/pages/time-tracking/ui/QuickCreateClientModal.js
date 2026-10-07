import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useId, useEffect } from 'react';
import { createTimeManagerClient } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
export function QuickCreateClientModal({ canManage, onClose, onCreated, onOpenFullForm }) {
    const { t } = useI18n();
    const uid = useId();
    const [name, setName] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError(t('timeTrackingPage.clients.quickCreate.nameRequired'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const row = await createTimeManagerClient({ name: trimmed });
            onCreated(row);
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('timeTrackingPage.clients.quickCreate.createFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--client tt-tm-modal--client-quick", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-qcc-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-qcc-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.clients.quickCreate.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsx("p", { className: "tt-tm-hint tt-tm-hint--inline", style: { marginTop: 0 }, children: t('timeTrackingPage.clients.quickCreate.hint') }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-qcc-name`, children: [t('timeTrackingPage.clients.modal.clientName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-qcc-name`, className: "tt-tm-input", value: name, onChange: (e) => setName(e.target.value), autoFocus: true, autoComplete: "organization", disabled: !canManage || saving, onKeyDown: (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void submit();
                                        }
                                    } })] }), error ? (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error })) : null] }), _jsxs("div", { className: "tt-tm-modal__foot tt-tm-modal__foot--quick-client", children: [onOpenFullForm ? (_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost tt-tm-modal__foot-link", disabled: saving, onClick: () => {
                                onClose();
                                onOpenFullForm();
                            }, children: t('timeTrackingPage.clients.quickCreate.fullFormLink') })) : null, _jsxs("div", { className: "tt-tm-modal__foot-actions", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", onClick: onClose, disabled: saving, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: !canManage || saving, onClick: () => void submit(), children: saving ? t('timeTrackingPage.clients.quickCreate.creating') : t('timeTrackingPage.common.create') })] })] })] }) }));
}
