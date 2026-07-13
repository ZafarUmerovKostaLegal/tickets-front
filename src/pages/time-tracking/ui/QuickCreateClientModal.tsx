import { useState, useId, useEffect } from 'react';
import { createTimeManagerClient, type TimeManagerClientRow } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

export type QuickCreateClientModalProps = {
    canManage: boolean;
    onClose: () => void;
    onCreated: (row: TimeManagerClientRow) => void;
    onOpenFullForm?: () => void;
};

export function QuickCreateClientModal({ canManage, onClose, onCreated, onOpenFullForm }: QuickCreateClientModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [name, setName] = useState('');
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
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--client tt-tm-modal--client-quick" role="dialog" aria-modal="true" aria-labelledby={`${uid}-qcc-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-qcc-title`} className="tt-tm-modal__title">
            {t('timeTrackingPage.clients.quickCreate.title')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <p className="tt-tm-hint tt-tm-hint--inline" style={{ marginTop: 0 }}>
            {t('timeTrackingPage.clients.quickCreate.hint')}
          </p>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-qcc-name`}>
              {t('timeTrackingPage.clients.modal.clientName')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-qcc-name`} className="tt-tm-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="organization" disabled={!canManage || saving} onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    void submit();
                }
            }}/>
          </div>
          {error ? (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>) : null}
        </div>
        <div className="tt-tm-modal__foot tt-tm-modal__foot--quick-client">
          {onOpenFullForm ? (<button type="button" className="tt-settings__btn tt-settings__btn--ghost tt-tm-modal__foot-link" disabled={saving} onClick={() => {
                onClose();
                onOpenFullForm();
            }}>
              {t('timeTrackingPage.clients.quickCreate.fullFormLink')}
            </button>) : null}
          <div className="tt-tm-modal__foot-actions">
            <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={onClose} disabled={saving}>
              {t('timeTrackingPage.cancel')}
            </button>
            <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={!canManage || saving} onClick={() => void submit()}>
              {saving ? t('timeTrackingPage.clients.quickCreate.creating') : t('timeTrackingPage.common.create')}
            </button>
          </div>
        </div>
      </div>
    </div>);
}
