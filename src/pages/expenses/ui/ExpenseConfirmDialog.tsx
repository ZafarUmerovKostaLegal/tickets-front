import { useId, type ReactNode } from 'react';
function DialogSpinner({ className }: {
    className?: string;
}) {
    return (<svg className={className ?? 'exp-panel-btn__spinner'} viewBox="0 0 24 24" aria-hidden width={18} height={18}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.2}/>
      <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M12 3a9 9 0 0 1 9 9"/>
    </svg>);
}
export type ExpenseConfirmDialogProps = {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    confirmVariant?: 'primary' | 'danger';
    busy?: boolean;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
};
export function ExpenseConfirmDialog({ isOpen, title, message, confirmLabel, cancelLabel = 'Отмена', confirmVariant = 'primary', busy = false, onConfirm, onClose, }: ExpenseConfirmDialogProps) {
    const titleId = useId();
    if (!isOpen)
        return null;
    const confirmClass = confirmVariant === 'danger'
        ? 'exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger'
        : 'exp-panel-btn exp-panel-btn--primary';
    return (<div className="exp-mod-backdrop" role="presentation" onClick={() => {
            if (!busy)
                onClose();
        }}>
      <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <h3 id={titleId} className="exp-mod-dialog__title">
          {title}
        </h3>
        <div className="exp-mod-dialog__confirm-body">{message}</div>
        <div className="exp-mod-dialog__ft">
          <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} disabled={busy} aria-busy={busy} onClick={() => void onConfirm()}>
            {busy ? (<>
                <DialogSpinner />
                <span className="exp-mod-dialog__confirm-busy-label">Подождите…</span>
              </>) : (confirmLabel)}
          </button>
        </div>
      </div>
    </div>);
}
