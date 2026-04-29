import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import './LogoutConfirmDialog.css';

type LogoutConfirmDialogProps = {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export function LogoutConfirmDialog({ open, onCancel, onConfirm }: LogoutConfirmDialogProps) {
    const titleId = useId();
    const descId = useId();
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);
    if (!open || typeof document === 'undefined')
        return null;
    return createPortal(<div className="logout-confirm" role="presentation">
      <div className="logout-confirm__panel" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} onClick={(e) => e.stopPropagation()}>
        <h2 className="logout-confirm__title" id={titleId}>
          Выйти из аккаунта?
        </h2>
        <p className="logout-confirm__text" id={descId}>
          Сессия будет завершена. Потом нужно будет снова войти в систему.
        </p>
        <div className="logout-confirm__actions">
          <button type="button" className="logout-confirm__btn" onClick={onCancel} autoFocus>
            Отмена
          </button>
          <button type="button" className="logout-confirm__btn logout-confirm__btn--primary" onClick={onConfirm}>
            Выйти
          </button>
        </div>
      </div>
    </div>, document.body);
}
