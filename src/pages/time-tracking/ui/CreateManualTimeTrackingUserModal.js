import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useId, useEffect } from 'react';
import { createManualTimeTrackingUser, isForbiddenError } from '@entities/time-tracking';
import { TIME_TRACKING_ROLES } from '@entities/time-tracking/model/constants';
import { getPositions } from '@entities/user';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
function mergePositionOptions(api) {
    const seen = new Set();
    const out = [];
    for (const p of [...api, ...TIME_TRACKING_ROLES]) {
        const v = String(p ?? '').trim();
        const k = v.toLowerCase();
        if (!v || seen.has(k))
            continue;
        seen.add(k);
        out.push(v);
    }
    return out;
}
export function CreateManualTimeTrackingUserModal({ canManage, onClose, onCreated }) {
    const { t } = useI18n();
    const uid = useId();
    const [displayName, setDisplayName] = useState('');
    const [position, setPosition] = useState('');
    const [email, setEmail] = useState('');
    const [isArchived, setIsArchived] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [positionOptions, setPositionOptions] = useState(() => mergePositionOptions([]));
    useEffect(() => {
        let cancelled = false;
        getPositions()
            .then((list) => {
            if (!cancelled)
                setPositionOptions(mergePositionOptions(list));
        })
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const submit = async () => {
        const trimmed = displayName.trim();
        if (!trimmed) {
            setError(t('timeTrackingPage.users.manualCreate.nameRequired'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const row = await createManualTimeTrackingUser({
                displayName: trimmed,
                position: position.trim() || undefined,
                email: email.trim() || undefined,
                isArchived,
            });
            onCreated(row);
            onClose();
        }
        catch (e) {
            if (isForbiddenError(e)) {
                setError(t('timeTrackingPage.users.manualCreate.forbidden'));
            }
            else {
                setError(e instanceof Error ? e.message : t('timeTrackingPage.users.manualCreate.createFailed'));
            }
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--manual-user", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "tt-tm-modal__title", children: t('timeTrackingPage.users.manualCreate.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [_jsx("p", { className: "tt-tm-hint tt-tm-hint--inline", style: { marginTop: 0 }, children: t('timeTrackingPage.users.manualCreate.hint') }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-name`, children: [t('timeTrackingPage.users.manualCreate.displayName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-name`, className: "tt-tm-input", value: displayName, onChange: (e) => setDisplayName(e.target.value), autoFocus: true, disabled: !canManage || saving, onKeyDown: (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void submit();
                                        }
                                    } })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-position`, children: t('timeTrackingPage.users.manualCreate.position') }), _jsx("input", { id: `${uid}-position`, className: "tt-tm-input", list: `${uid}-position-options`, value: position, onChange: (e) => setPosition(e.target.value), disabled: !canManage || saving }), positionOptions.length > 0 ? (_jsx("datalist", { id: `${uid}-position-options`, children: positionOptions.map((p) => (_jsx("option", { value: p }, p))) })) : null] }), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-email`, children: t('timeTrackingPage.users.manualCreate.email') }), _jsx("input", { id: `${uid}-email`, type: "email", className: "tt-tm-input", value: email, onChange: (e) => setEmail(e.target.value), disabled: !canManage || saving, placeholder: t('timeTrackingPage.users.manualCreate.emailPlaceholder') })] }), _jsxs("label", { className: "tt-tm-check-row", children: [_jsx("input", { type: "checkbox", checked: isArchived, disabled: !canManage || saving, onChange: (e) => setIsArchived(e.target.checked) }), _jsx("span", { children: t('timeTrackingPage.users.manualCreate.isArchived') })] }), error ? (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error })) : null] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", onClick: onClose, disabled: saving, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: !canManage || saving, onClick: () => void submit(), children: saving ? t('timeTrackingPage.users.manualCreate.creating') : t('timeTrackingPage.common.create') })] })] }) }));
}
