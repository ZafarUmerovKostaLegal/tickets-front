import { useState, useId, useEffect } from 'react';
import { createManualTimeTrackingUser, isForbiddenError, type TimeTrackingUserRow } from '@entities/time-tracking';
import { TIME_TRACKING_ROLES } from '@entities/time-tracking/model/constants';
import { getPositions } from '@entities/user';
import { useI18n } from '@shared/i18n';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

export type CreateManualTimeTrackingUserModalProps = {
    canManage: boolean;
    onClose: () => void;
    onCreated: (row: TimeTrackingUserRow) => void;
};

function mergePositionOptions(api: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
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

export function CreateManualTimeTrackingUserModal({ canManage, onClose, onCreated }: CreateManualTimeTrackingUserModalProps) {
    const { t } = useI18n();
    const uid = useId();
    const [displayName, setDisplayName] = useState('');
    const [position, setPosition] = useState('');
    const [email, setEmail] = useState('');
    const [isArchived, setIsArchived] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [positionOptions, setPositionOptions] = useState<string[]>(() => mergePositionOptions([]));

    useEffect(() => {
        let cancelled = false;
        getPositions()
            .then((list) => {
                if (!cancelled)
                    setPositionOptions(mergePositionOptions(list));
            })
            .catch(() => { /* подсказки необязательны */ });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
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

    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--manual-user" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-title`} className="tt-tm-modal__title">
            {t('timeTrackingPage.users.manualCreate.title')}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <p className="tt-tm-hint tt-tm-hint--inline" style={{ marginTop: 0 }}>
            {t('timeTrackingPage.users.manualCreate.hint')}
          </p>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-name`}>
              {t('timeTrackingPage.users.manualCreate.displayName')} <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-name`} className="tt-tm-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus disabled={!canManage || saving} onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    void submit();
                }
            }}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-position`}>
              {t('timeTrackingPage.users.manualCreate.position')}
            </label>
            <input id={`${uid}-position`} className="tt-tm-input" list={`${uid}-position-options`} value={position} onChange={(e) => setPosition(e.target.value)} disabled={!canManage || saving}/>
            {positionOptions.length > 0 ? (
              <datalist id={`${uid}-position-options`}>
                {positionOptions.map((p) => (<option key={p} value={p} />))}
              </datalist>
            ) : null}
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-email`}>
              {t('timeTrackingPage.users.manualCreate.email')}
            </label>
            <input id={`${uid}-email`} type="email" className="tt-tm-input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canManage || saving} placeholder={t('timeTrackingPage.users.manualCreate.emailPlaceholder')}/>
          </div>
          <label className="tt-tm-check-row">
            <input type="checkbox" checked={isArchived} disabled={!canManage || saving} onChange={(e) => setIsArchived(e.target.checked)}/>
            <span>{t('timeTrackingPage.users.manualCreate.isArchived')}</span>
          </label>
          {error ? (<p className="tt-tm-field-error" role="alert">{error}</p>) : null}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" onClick={onClose} disabled={saving}>
            {t('timeTrackingPage.cancel')}
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={!canManage || saving} onClick={() => void submit()}>
            {saving ? t('timeTrackingPage.users.manualCreate.creating') : t('timeTrackingPage.common.create')}
          </button>
        </div>
      </div>
    </div>);
}
