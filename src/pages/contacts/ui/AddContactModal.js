import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useState } from 'react';
import { createContactsClientContact } from '@entities/contacts';
import { SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { portalTimeTrackingModal } from '@pages/time-tracking/ui/timeTrackingModalPortal';
import '@pages/time-tracking/ui/TimeTrackingForms.css';
import './AddContactModal.css';
import { ContactBusinessCard } from './ContactBusinessCard';
const TM_DD_PORTAL_Z = 12000;
export function AddContactModal({ clients, canManage, onClose, onSaved }) {
    const { t } = useI18n();
    const uid = useId();
    const [clientId, setClientId] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const activeClients = useMemo(() => clients.filter((c) => !c.is_archived).sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })), [clients]);
    const pickedClient = useMemo(() => activeClients.find((c) => c.id === clientId) ?? null, [activeClients, clientId]);
    const previewCard = useMemo(() => ({
        id: 'preview',
        kind: 'client',
        name: name.trim() || t('contactsPage.addModal.previewEmptyName'),
        subtitle: pickedClient?.name.trim() || t('contactsPage.addModal.previewCompany'),
        phone: phone.trim() || null,
        email: email.trim() || null,
        picture: null,
    }), [email, name, phone, pickedClient, t]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const submit = async () => {
        if (!canManage) {
            setError(t('contactsPage.addModal.insufficientRights'));
            return;
        }
        if (!clientId) {
            setError(t('contactsPage.addModal.clientRequired'));
            return;
        }
        const n = name.trim();
        if (!n) {
            setError(t('contactsPage.addModal.nameRequired'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await createContactsClientContact(clientId, {
                name: n,
                phone: phone.trim() || null,
                email: email.trim() || null,
            });
            onSaved();
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('contactsPage.addModal.saveFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(_jsx("div", { className: "tt-tm-modal-overlay", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "tt-tm-modal tt-tm-modal--contacts-add", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-add-title`, onClick: (ev) => ev.stopPropagation(), children: [_jsxs("div", { className: "tt-tm-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { id: `${uid}-add-title`, className: "tt-tm-modal__title", children: t('contactsPage.addModal.title') }), _jsx("p", { className: "contacts-add-modal__subtitle", children: t('contactsPage.addModal.subtitle') })] }), _jsx("button", { type: "button", className: "tt-tm-modal__close", onClick: onClose, "aria-label": t('contactsPage.closeAria'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tt-tm-modal__body", children: [!canManage && (_jsx("p", { className: "tt-tm-field-error", role: "alert", children: t('contactsPage.addModal.insufficientRights') })), _jsxs("div", { className: "contacts-add-modal__split", children: [_jsxs("div", { className: "contacts-add-modal__form", children: [_jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", id: `${uid}-client-lbl`, htmlFor: `${uid}-client`, children: [t('contactsPage.addModal.client'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx(SearchableSelect, { className: "tt-tm-dd", buttonClassName: "tt-tm-dd__btn", buttonId: `${uid}-client`, value: clientId, items: activeClients, getOptionValue: (c) => c.id, getOptionLabel: (c) => c.name, getSearchText: clientRowSearchText, onSelect: (c) => setClientId(c.id), placeholder: t('contactsPage.addModal.clientPlaceholder'), emptyListText: t('contactsPage.addModal.clientEmpty'), noMatchText: t('contactsPage.addModal.clientNotFound'), disabled: !canManage || saving, portalDropdown: true, portalZIndex: TM_DD_PORTAL_Z, portalMinWidth: 320, portalDropdownClassName: "tsp-srch__dropdown--tall", "aria-labelledby": `${uid}-client-lbl` })] }), _jsxs("div", { className: "tt-tm-field", children: [_jsxs("label", { className: "tt-tm-label", htmlFor: `${uid}-name`, children: [t('contactsPage.addModal.name'), " ", _jsx("span", { className: "tt-tm-req", children: "*" })] }), _jsx("input", { id: `${uid}-name`, className: "tt-tm-input", value: name, onChange: (e) => setName(e.target.value), placeholder: t('contactsPage.addModal.namePlaceholder'), disabled: !canManage || saving })] }), _jsxs("div", { className: "contacts-add-modal__field-row", children: [_jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-phone`, children: t('contactsPage.addModal.phone') }), _jsx("input", { id: `${uid}-phone`, className: "tt-tm-input", value: phone, onChange: (e) => setPhone(e.target.value), autoComplete: "tel", disabled: !canManage || saving })] }), _jsxs("div", { className: "tt-tm-field tt-tm-field--cell", children: [_jsx("label", { className: "tt-tm-label", htmlFor: `${uid}-email`, children: t('contactsPage.addModal.email') }), _jsx("input", { id: `${uid}-email`, type: "email", className: "tt-tm-input", value: email, onChange: (e) => setEmail(e.target.value), autoComplete: "email", disabled: !canManage || saving })] })] }), _jsx("p", { className: "tt-tm-hint", children: t('contactsPage.addModal.hint') }), error ? _jsx("p", { className: "tt-tm-field-error", role: "alert", children: error }) : null] }), _jsx("div", { className: "contacts-add-modal__preview", "aria-live": "polite", children: _jsx(ContactBusinessCard, { card: previewCard, preview: true }) })] })] }), _jsxs("div", { className: "tt-tm-modal__foot", children: [_jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--ghost", disabled: saving, onClick: onClose, children: t('contactsPage.cancel') }), _jsx("button", { type: "button", className: "tt-settings__btn tt-settings__btn--primary", disabled: saving || !canManage, onClick: () => void submit(), children: saving ? t('contactsPage.saving') : t('contactsPage.save') })] })] }) }));
}
