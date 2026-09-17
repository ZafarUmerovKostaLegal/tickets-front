import { useState, useEffect, useId } from 'react';
import {
    createClientContact,
    patchClientContact,
    patchTimeManagerClient,
    type TimeManagerClientContactRow,
} from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

export type AddClientContactEditTarget = {
    kind: 'primary' | 'extra';
    /** Extra contact id; ignored for primary. */
    id?: string;
    name: string;
    phone: string | null;
    email: string | null;
};

export type AddClientContactForClientModalProps = {
    clientId: string;
    clientName: string;
    clientArchived: boolean;
    canManage: boolean;
    onClose: () => void;
    onCreated?: (row: TimeManagerClientContactRow) => void;
    /** When set, modal edits an existing primary or extra contact instead of creating. */
    editContact?: AddClientContactEditTarget | null;
    onSaved?: (payload: { key: string; email: string | null }) => void;
};

export function AddClientContactForClientModal({
    clientId,
    clientName,
    clientArchived,
    canManage,
    onClose,
    onCreated,
    editContact = null,
    onSaved,
}: AddClientContactForClientModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const isEdit = Boolean(editContact);
    const isPrimaryEdit = editContact?.kind === 'primary';
    const [name, setName] = useState(editContact?.name ?? '');
    const [phone, setPhone] = useState(editContact?.phone ?? '');
    const [email, setEmail] = useState(editContact?.email ?? '');
    const [error, setError] = useState<string | null>(null);
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
        const onKey = (e: KeyboardEvent) => {
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
            const nextEmail = email.trim() || null;
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
            setError(
                e instanceof Error
                    ? e.message
                    : isEdit
                        ? t('timeTrackingPage.clients.errors.contactSaveFailed')
                        : t('timeTrackingPage.clients.errors.contactAddFailed'),
            );
        }
        finally {
            setSaving(false);
        }
    };

    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--add-contact" role="dialog" aria-modal="true" aria-labelledby={`${uid}-add-contact-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-add-contact-title`} className="tt-tm-modal__title">
            {isEdit
                ? t('timeTrackingPage.clients.addContactModal.editTitle')
                : t('timeTrackingPage.clients.addContactModal.title')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {!canManage && (<p className="tt-tm-field-error" role="alert">
              {t('timeTrackingPage.clients.addContactModal.insufficientRights')}
            </p>)}
          {clientArchived && !isPrimaryEdit && (<p className="tt-tm-hint" role="status">
              {t('timeTrackingPage.clients.addContactModal.clientArchivedHint')}
            </p>)}
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-client-readonly`}>
              {t('timeTrackingPage.common.client')}
            </label>
            <input id={`${uid}-client-readonly`} className="tt-tm-input" value={clientName} readOnly tabIndex={-1}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              {t('timeTrackingPage.clients.addContactModal.contactName')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-cname`} className="tt-tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('timeTrackingPage.clients.addContactModal.contactNamePlaceholder')} disabled={formLocked}/>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                {t('timeTrackingPage.common.phone')}
              </label>
              <input id={`${uid}-cphone`} className="tt-tm-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={formLocked}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
              <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                {t('timeTrackingPage.clients.modal.email')}
              </label>
              <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={formLocked}/>
            </div>
          </div>
          <p className="tt-tm-hint">
            {isPrimaryEdit
                ? t('timeTrackingPage.clients.addContactModal.editPrimaryHint')
                : isEdit
                    ? t('timeTrackingPage.clients.addContactModal.editHint')
                    : t('timeTrackingPage.clients.addContactModal.hint')}
          </p>
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            {t('timeTrackingPage.cancel')}
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || formLocked} onClick={() => void submit()}>
            {saving
                ? t('timeTrackingPage.saving')
                : isEdit
                    ? t('timeTrackingPage.save')
                    : t('timeTrackingPage.add')}
          </button>
        </div>
      </div>
    </div>);
}
