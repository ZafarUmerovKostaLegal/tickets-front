import { useEffect, useId, useMemo, useState } from 'react';
import { createContactsClientContact } from '@entities/contacts';
import type { TimeManagerClientRow } from '@entities/time-tracking';
import { SearchableSelect } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { clientRowSearchText } from '@pages/time-tracking/lib/clientRowSearchText';
import { portalTimeTrackingModal } from '@pages/time-tracking/ui/timeTrackingModalPortal';
import '@pages/time-tracking/ui/TimeTrackingForms.css';
import './AddContactModal.css';
import type { ContactCard } from '../lib/contactsModel';
import { ContactBusinessCard } from './ContactBusinessCard';

const TM_DD_PORTAL_Z = 12000;

export type AddContactModalProps = {
    clients: TimeManagerClientRow[];
    canManage: boolean;
    onClose: () => void;
    onSaved: () => void;
};

export function AddContactModal({ clients, canManage, onClose, onSaved }: AddContactModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [clientId, setClientId] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const activeClients = useMemo(
        () => clients.filter((c) => !c.is_archived).sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })),
        [clients],
    );

    const pickedClient = useMemo(
        () => activeClients.find((c) => c.id === clientId) ?? null,
        [activeClients, clientId],
    );

    const previewCard: ContactCard = useMemo(() => ({
        id: 'preview',
        kind: 'client',
        name: name.trim() || t('contactsPage.addModal.previewEmptyName'),
        subtitle: pickedClient?.name.trim() || t('contactsPage.addModal.previewCompany'),
        phone: phone.trim() || null,
        email: email.trim() || null,
        picture: null,
    }), [email, name, phone, pickedClient, t]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
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

    return portalTimeTrackingModal(
        <div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
            <div
                className="tt-tm-modal tt-tm-modal--contacts-add"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${uid}-add-title`}
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="tt-tm-modal__head">
                    <div>
                        <h2 id={`${uid}-add-title`} className="tt-tm-modal__title">
                            {t('contactsPage.addModal.title')}
                        </h2>
                        <p className="contacts-add-modal__subtitle">{t('contactsPage.addModal.subtitle')}</p>
                    </div>
                    <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('contactsPage.closeAria')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="tt-tm-modal__body">
                    {!canManage && (
                        <p className="tt-tm-field-error" role="alert">
                            {t('contactsPage.addModal.insufficientRights')}
                        </p>
                    )}

                    <div className="contacts-add-modal__split">
                        <div className="contacts-add-modal__form">
                            <div className="tt-tm-field">
                                <label className="tt-tm-label" id={`${uid}-client-lbl`} htmlFor={`${uid}-client`}>
                                    {t('contactsPage.addModal.client')} <span className="tt-tm-req">*</span>
                                </label>
                                <SearchableSelect<TimeManagerClientRow>
                                    className="tt-tm-dd"
                                    buttonClassName="tt-tm-dd__btn"
                                    buttonId={`${uid}-client`}
                                    value={clientId}
                                    items={activeClients}
                                    getOptionValue={(c) => c.id}
                                    getOptionLabel={(c) => c.name}
                                    getSearchText={clientRowSearchText}
                                    onSelect={(c) => setClientId(c.id)}
                                    placeholder={t('contactsPage.addModal.clientPlaceholder')}
                                    emptyListText={t('contactsPage.addModal.clientEmpty')}
                                    noMatchText={t('contactsPage.addModal.clientNotFound')}
                                    disabled={!canManage || saving}
                                    portalDropdown
                                    portalZIndex={TM_DD_PORTAL_Z}
                                    portalMinWidth={320}
                                    portalDropdownClassName="tsp-srch__dropdown--tall"
                                    aria-labelledby={`${uid}-client-lbl`}
                                />
                            </div>

                            <div className="tt-tm-field">
                                <label className="tt-tm-label" htmlFor={`${uid}-name`}>
                                    {t('contactsPage.addModal.name')} <span className="tt-tm-req">*</span>
                                </label>
                                <input
                                    id={`${uid}-name`}
                                    className="tt-tm-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('contactsPage.addModal.namePlaceholder')}
                                    disabled={!canManage || saving}
                                />
                            </div>

                            <div className="contacts-add-modal__field-row">
                                <div className="tt-tm-field tt-tm-field--cell">
                                    <label className="tt-tm-label" htmlFor={`${uid}-phone`}>
                                        {t('contactsPage.addModal.phone')}
                                    </label>
                                    <input
                                        id={`${uid}-phone`}
                                        className="tt-tm-input"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        autoComplete="tel"
                                        disabled={!canManage || saving}
                                    />
                                </div>
                                <div className="tt-tm-field tt-tm-field--cell">
                                    <label className="tt-tm-label" htmlFor={`${uid}-email`}>
                                        {t('contactsPage.addModal.email')}
                                    </label>
                                    <input
                                        id={`${uid}-email`}
                                        type="email"
                                        className="tt-tm-input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="email"
                                        disabled={!canManage || saving}
                                    />
                                </div>
                            </div>

                            <p className="tt-tm-hint">{t('contactsPage.addModal.hint')}</p>
                            {error ? <p className="tt-tm-field-error" role="alert">{error}</p> : null}
                        </div>

                        <div className="contacts-add-modal__preview" aria-live="polite">
                            <ContactBusinessCard card={previewCard} preview />
                        </div>
                    </div>
                </div>

                <div className="tt-tm-modal__foot">
                    <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
                        {t('contactsPage.cancel')}
                    </button>
                    <button
                        type="button"
                        className="tt-settings__btn tt-settings__btn--primary"
                        disabled={saving || !canManage}
                        onClick={() => void submit()}
                    >
                        {saving ? t('contactsPage.saving') : t('contactsPage.save')}
                    </button>
                </div>
            </div>
        </div>,
    );
}
