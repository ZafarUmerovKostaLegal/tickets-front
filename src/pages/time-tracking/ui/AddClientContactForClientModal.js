import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useId } from 'react';
import { createClientContact, patchClientContact, patchTimeManagerClient, } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';
import './TimeTrackingForms.css';
const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** One address, or several separated by `;`. Returns null when empty, false when invalid. */
function normalizeContactEmails(raw) {
    const parts = raw.split(';').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0)
        return null;
    if (parts.some((part) => !CONTACT_EMAIL_RE.test(part)))
        return false;
    return parts.join('; ');
}
export function AddClientContactForClientModal({ clientId, clientName, clientArchived, canManage, onClose, onCreated, editContact = null, onSaved, }) {
    const { t } = useI18n();
    const uid = useId();
    const isEdit = Boolean(editContact);
    const isPrimaryEdit = editContact?.kind === 'primary';
    const [name, setName] = useState(editContact?.name ?? '');
    const [phone, setPhone] = useState(editContact?.phone ?? '');
    const [email, setEmail] = useState(editContact?.email ?? '');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!editContact)
            return;
        setName(editContact.name);
        setPhone(editContact.phone ?? '');
        setEmail(editContact.email ?? '');
        setError(null);
    }, [editContact]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    // Primary contact can be edited while archived (same as client card); extras cannot.
    const formLocked = !canManage || (clientArchived && !isPrimaryEdit);
    const submit = async () => {
        const n = name.trim();
        if (!n) {
            setError(t('timeTrackingPage.clients.errors.contactNameRequired'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const nextPhone = phone.trim() || null;
            const nextEmail = normalizeContactEmails(email);
            if (nextEmail === false) {
                setError(t('timeTrackingPage.clients.addContactModal.emailInvalid'));
                setSaving(false);
                return;
            }
            if (isEdit && editContact) {
                if (editContact.kind === 'primary') {
                    await patchTimeManagerClient(clientId, {
                        contactName: n,
                        contactPhone: nextPhone,
                        contactEmail: nextEmail,
                    });
                    onSaved?.({ key: 'primary', email: nextEmail });
                }
                else {
                    const contactId = String(editContact.id ?? '').trim();
                    if (!contactId)
                        throw new Error(t('timeTrackingPage.clients.errors.contactSaveFailed'));
                    const row = await patchClientContact(clientId, contactId, {
                        name: n,
                        phone: nextPhone,
                        email: nextEmail,
                    });
                    onSaved?.({ key: row.id, email: row.email?.trim() || nextEmail });
                }
                onClose();
                return;
            }
            const row = await createClientContact(clientId, {
                name: n,
                phone: nextPhone,
                email: nextEmail,
            });
            onCreated?.(row);
            onClose();
        }
        catch (e) {
            setError(e instanceof Error
                ? e.message
                : isEdit
                    ? t('timeTrackingPage.clients.errors.contactSaveFailed')
                    : t('timeTrackingPage.clients.errors.contactAddFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--add-contact", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-add-contact-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsx("h2", { id: `${uid}-add-contact-title`, className: "tt-tm-modal__title", children: isEdit
                                ? t('timeTrackingPage.clients.addContactModal.editTitle')
                                : t('timeTrackingPage.clients.addContactModal.title') }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [!canManage && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: t('timeTrackingPage.clients.addContactModal.insufficientRights') })), clientArchived && !isPrimaryEdit && (_jsx("p", { className: "tt-tm-hint", role: "status", children: t('timeTrackingPage.clients.addContactModal.clientArchivedHint') })), _jsxs("div", { className: "tt-tm-field", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-client-readonly`, children: t('timeTrackingPage.common.client') }), _jsx("input", { id: `${uid}-client-readonly`, className: "tt-tm-input", value: clientName, readOnly: true, tabIndex: -1 })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-cname`, children: [t('timeTrackingPage.clients.addContactModal.contactName'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-cname`, className: "tt-tm-input", value: name, onChange: (e) => setName(e.target.value), placeholder: t('timeTrackingPage.clients.addContactModal.contactNamePlaceholder'), disabled: formLocked })] }), _jsxs("div", { className: "tt-tm-field-row tt-tm-field-row--grid-3", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cphone`, children: t('timeTrackingPage.common.phone') }), _jsx("input", { id: `${uid}-cphone`, className: "tt-tm-input", value: phone, onChange: (e) => setPhone(e.target.value), autoComplete: "tel", disabled: formLocked })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", style: { gridColumn: 'span 2' }, children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-cemail`, children: t('timeTrackingPage.clients.modal.email') }), _jsx("input", { id: `${uid}-cemail`, type: "text", className: "tt-tm-input", value: email, onChange: (e) => setEmail(e.target.value), placeholder: t('timeTrackingPage.clients.addContactModal.emailPlaceholder'), autoComplete: "off", inputMode: "email", disabled: formLocked })] })] }), _jsx("p", { className: "tt-tm-hint", children: isPrimaryEdit
                                ? t('timeTrackingPage.clients.addContactModal.editPrimaryHint')
                                : isEdit
                                    ? t('timeTrackingPage.clients.addContactModal.editHint')
                                    : t('timeTrackingPage.clients.addContactModal.hint') }), error && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }))] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving || formLocked, onClick: () => void submit(), children: saving
                                ? t('timeTrackingPage.saving')
                                : isEdit
                                    ? t('timeTrackingPage.save')
                                    : t('timeTrackingPage.add') })] })] }) }));
}
