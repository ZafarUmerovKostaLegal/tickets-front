import { useState, useEffect, useId } from 'react';
import { createClientContact } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

export type AddClientContactForClientModalProps = {
    clientId: string;
    clientName: string;
    clientArchived: boolean;
    canManage: boolean;
    onClose: () => void;
};

export function AddClientContactForClientModal({ clientId, clientName, clientArchived, canManage, onClose, }: AddClientContactForClientModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const submit = async () => {
        const n = name.trim();
        if (!n) {
            setError(t('timeTrackingPage.clients.errors.contactNameRequired'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await createClientContact(clientId, {
                name: n,
                phone: phone.trim() || null,
                email: email.trim() || null,
            });
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t('timeTrackingPage.clients.errors.contactAddFailed'));
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--add-contact" role="dialog" aria-modal="true" aria-labelledby={`${uid}-add-contact-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-add-contact-title`} className="tt-tm-modal__title">
            {t('timeTrackingPage.clients.addContactModal.title')}
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
          {clientArchived && (<p className="tt-tm-hint" role="status">
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
            <input id={`${uid}-cname`} className="tt-tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('timeTrackingPage.clients.addContactModal.contactNamePlaceholder')} disabled={!canManage || clientArchived}/>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                {t('timeTrackingPage.common.phone')}
              </label>
              <input id={`${uid}-cphone`} className="tt-tm-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={!canManage || clientArchived}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
              <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                {t('timeTrackingPage.clients.modal.email')}
              </label>
              <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={!canManage || clientArchived}/>
            </div>
          </div>
          <p className="tt-tm-hint">
            {t('timeTrackingPage.clients.addContactModal.hint')}
          </p>
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            {t('timeTrackingPage.cancel')}
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || !canManage || clientArchived} onClick={() => void submit()}>
            {saving ? t('timeTrackingPage.saving') : t('timeTrackingPage.add')}
          </button>
        </div>
      </div>
    </div>);
}
