import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
export function InternalExtensionModal({ initial, submitting, error, onClose, onSubmit, }) {
    const { t } = useI18n();
    const titleId = useId();
    const [fullName, setFullName] = useState(initial?.fullName ?? '');
    const [extension, setExtension] = useState(initial?.extension ?? '');
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitting)
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, submitting]);
    const handleSubmit = (e) => {
        e.preventDefault();
        const name = fullName.trim();
        const ext = extension.trim();
        if (!name || !ext)
            return;
        onSubmit({ fullName: name, extension: ext });
    };
    const isEdit = initial != null;
    return createPortal(_jsx("div", { className: "icom-modal-backdrop", onClick: () => !submitting && onClose(), children: _jsxs("form", { className: "icom-modal", onClick: (e) => e.stopPropagation(), onSubmit: handleSubmit, "aria-labelledby": titleId, children: [_jsx("h3", { id: titleId, className: "icom-modal__title", children: isEdit ? t('internalCommunicationPage.editContact') : t('internalCommunicationPage.addContact') }), error ? (_jsx("p", { className: "icom-modal__error", role: "alert", children: error })) : null, _jsxs("label", { className: "icom-modal__field", children: [_jsx("span", { children: t('internalCommunicationPage.colName') }), _jsx("input", { value: fullName, onChange: (e) => setFullName(e.target.value), maxLength: 200, autoFocus: true, disabled: submitting, required: true })] }), _jsxs("label", { className: "icom-modal__field", children: [_jsx("span", { children: t('internalCommunicationPage.colExtension') }), _jsx("input", { value: extension, onChange: (e) => setExtension(e.target.value), maxLength: 32, inputMode: "numeric", disabled: submitting, required: true })] }), _jsxs("div", { className: "icom-modal__actions", children: [_jsx("button", { type: "button", className: "icom-modal__btn icom-modal__btn--ghost", onClick: onClose, disabled: submitting, children: t('common.cancel') }), _jsx("button", { type: "submit", className: "icom-modal__btn icom-modal__btn--primary", disabled: submitting || !fullName.trim() || !extension.trim(), children: submitting ? t('internalCommunicationPage.saving') : t('internalCommunicationPage.save') })] })] }) }), document.body);
}
