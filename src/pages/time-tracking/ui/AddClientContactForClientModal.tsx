import { useState, useEffect, useId } from 'react';
import { createClientContact } from '@entities/time-tracking';
import { portalTimeTrackingModal } from './timeTrackingModalPortal';

export type AddClientContactForClientModalProps = {
    clientId: string;
    clientName: string;
    clientArchived: boolean;
    canManage: boolean;
    onClose: () => void;
};

export function AddClientContactForClientModal({ clientId, clientName, clientArchived, canManage, onClose, }: AddClientContactForClientModalProps) {
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
            setError('Укажите имя контакта');
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
            setError(e instanceof Error ? e.message : 'Не удалось добавить контакт');
        }
        finally {
            setSaving(false);
        }
    };
    return portalTimeTrackingModal(<div className="tt-tm-modal-overlay" role="presentation">
      <div className="tt-tm-modal tt-tm-modal--add-contact" role="dialog" aria-modal="true" aria-labelledby={`${uid}-add-contact-title`} onClick={(ev) => ev.stopPropagation()}>
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-add-contact-title`} className="tt-tm-modal__title">
            Добавить контакт к клиенту
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {!canManage && (<p className="tt-tm-field-error" role="alert">
              Недостаточно прав для добавления контактов.
            </p>)}
          {clientArchived && (<p className="tt-tm-hint" role="status">
              Этот клиент в архиве. Разархивируйте клиента в карточке редактирования, затем добавьте контакт.
            </p>)}
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-client-readonly`}>
              Клиент
            </label>
            <input id={`${uid}-client-readonly`} className="tt-tm-input" value={clientName} readOnly tabIndex={-1}/>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              Имя контакта <span className="tt-tm-req">*</span>
            </label>
            <input id={`${uid}-cname`} className="tt-tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО или должность" disabled={!canManage || clientArchived}/>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cphone`}>
                Телефон
              </label>
              <input id={`${uid}-cphone`} className="tt-tm-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={!canManage || clientArchived}/>
            </div>
            <div className="tt-tm-field tt-tm-field--cell" style={{ gridColumn: 'span 2' }}>
              <label className="tt-tm-label" htmlFor={`${uid}-cemail`}>
                Email
              </label>
              <input id={`${uid}-cemail`} type="email" className="tt-tm-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={!canManage || clientArchived}/>
            </div>
          </div>
          <p className="tt-tm-hint">
            Контакт сохраняется в списке дополнительных контактов клиента. Основной контакт и реквизиты организации настраиваются в «Редактировать клиента».
          </p>
          {error && (<p className="tt-tm-field-error" role="alert">
              {error}
            </p>)}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving || !canManage || clientArchived} onClick={() => void submit()}>
            {saving ? 'Сохранение…' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>);
}
