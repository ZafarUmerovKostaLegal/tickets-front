import { memo } from 'react';
import { createPortal } from 'react-dom';
type CreateNotificationModalProps = {
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    title: string;
    description: string;
    onTitleChange: (v: string) => void;
    onDescriptionChange: (v: string) => void;
    loading: boolean;
    error: string | null;
};
export const CreateNotificationModal = memo(function CreateNotificationModal(props: CreateNotificationModalProps) {
    const { onClose, onSubmit, title, description, onTitleChange, onDescriptionChange, loading, error, } = props;
    const modal = (<div className="tm" role="dialog" aria-modal="true">
      <div className="tm__backdrop" aria-hidden/>
      <div className="tm__box" onClick={(e) => e.stopPropagation()}>
        <div className="tm__head">
          <div className="tm__head-left">
            <span className="tm__head-icon tm__head-icon--bell">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <h2 className="tm__title">Новое объявление</h2>
          </div>
          <button type="button" className="tm__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form className="tm__form" onSubmit={onSubmit}>
          <label className="tm__field">
            <span className="tm__label">Заголовок <span className="tm__req">*</span></span>
            <input className="tm__input" type="text" placeholder="Например: Обновление регламента" value={title} maxLength={120} onChange={(e) => onTitleChange(e.target.value)}/>
          </label>
          <label className="tm__field">
            <span className="tm__label">Текст объявления <span className="tm__req">*</span></span>
            <textarea className="tm__input tm__input--area" placeholder="Кратко опишите суть объявления..." rows={4} value={description} onChange={(e) => onDescriptionChange(e.target.value)}/>
          </label>
          {error && <p className="tm__error">{error}</p>}
          <div className="tm__foot">
            <button type="button" className="tm__btn tm__btn--ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="tm__btn tm__btn--primary" disabled={loading || !title.trim() || !description.trim()}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>);
    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
});
