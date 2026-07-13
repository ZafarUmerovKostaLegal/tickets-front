import { useCallback } from 'react';
import { IconClose } from './TodoIcons';
import { useI18n } from '@shared/i18n';

type TodoAddCardModalProps = {
    columnTitle: string;
    title: string;
    onTitleChange: (v: string) => void;
    onClose: () => void;
    onSubmit: () => void;
    submitting?: boolean;
};

export function TodoAddCardModal({
    columnTitle,
    title,
    onTitleChange,
    onClose,
    onSubmit,
    submitting = false,
}: TodoAddCardModalProps) {
    const { t } = useI18n();

    const submit = useCallback(() => {
        if (!title.trim() || submitting)
            return;
        onSubmit();
    }, [title, submitting, onSubmit]);

    return (
        <div className="todo-add-card-modal-backdrop">
            <div className="todo-add-card-modal" role="dialog" aria-modal="true" aria-labelledby="todo-add-card-modal-title">
                <div className="todo-add-card-modal__head">
                    <h2 id="todo-add-card-modal-title" className="todo-add-card-modal__title">
                        {columnTitle}
                    </h2>
                    <button type="button" className="todo-add-card-modal__close" aria-label={t('todoPage.close')} onClick={onClose} disabled={submitting}>
                        <IconClose />
                    </button>
                </div>
                <input
                    type="text"
                    className="todo-add-card-modal__input"
                    placeholder={t('todoPage.addCard.placeholder')}
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape')
                            onClose();
                        if (e.key === 'Enter')
                            submit();
                    }}
                    autoFocus
                    disabled={submitting}
                />
                <div className="todo-add-card-modal__footer">
                    <button type="button" className="todo-add-card-modal__submit" onClick={submit} disabled={!title.trim() || submitting}>
                        {t('todoPage.addCard.submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}
