import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type CorrespondenceRejectModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: (comment: string) => void;
    submitPending?: boolean;
};

export function CorrespondenceRejectModal({
    open,
    onClose,
    onConfirm,
    submitPending = false,
}: CorrespondenceRejectModalProps) {
    const titleId = useId();
    const fieldId = useId();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [comment, setComment] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open)
            return;
        setComment('');
        setError(null);
        const t = window.setTimeout(() => textareaRef.current?.focus(), 40);
        return () => window.clearTimeout(t);
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitPending) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, submitPending]);

    if (!open)
        return null;

    const handleSubmit = () => {
        const next = comment.trim();
        if (!next) {
            setError('Укажите причину отказа');
            textareaRef.current?.focus();
            return;
        }
        onConfirm(next);
    };

    return createPortal(
        <div
            className="corr-modal corr-modal--enter corr-modal--nested"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !submitPending)
                    onClose();
            }}
        >
            <div
                className="corr-modal__panel"
                role="dialog"
                aria-modal
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="corr-modal__head">
                    <div>
                        <h2 id={titleId} className="corr-modal__title">Отклонить письмо</h2>
                        <p className="corr-modal__lead">
                            Укажите замечания — автор получит уведомление и сможет исправить документ.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="corr-modal__close"
                        onClick={onClose}
                        disabled={submitPending}
                        aria-label="Закрыть"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </header>

                <div className={`corr-modal__field${error ? ' corr-modal__field--err' : ''}`}>
                    <label className="corr-modal__label" htmlFor={fieldId}>
                        Комментарий при отказе
                        {' '}
                        <span className="corr-modal__req" aria-hidden>*</span>
                    </label>
                    <textarea
                        id={fieldId}
                        ref={textareaRef}
                        className="corr-modal__textarea"
                        rows={5}
                        placeholder="Опишите, что нужно исправить…"
                        value={comment}
                        disabled={submitPending}
                        aria-invalid={Boolean(error)}
                        onChange={(e) => {
                            setComment(e.target.value);
                            if (error)
                                setError(null);
                        }}
                        onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />
                    {error ? <p className="corr-modal__err">{error}</p> : null}
                </div>

                <div className="corr-modal__actions">
                    <button
                        type="button"
                        className="corr-modal__btn corr-modal__btn--ghost"
                        onClick={onClose}
                        disabled={submitPending}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="corr-modal__btn corr-modal__btn--danger"
                        onClick={handleSubmit}
                        disabled={submitPending || !comment.trim()}
                    >
                        {submitPending ? 'Отклонение…' : 'Отклонить'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
