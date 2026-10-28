import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from 'react';
import { IconClose } from './TodoIcons';
import { useI18n } from '@shared/i18n';
export function TodoAddCardModal({ columnTitle, title, onTitleChange, onClose, onSubmit, submitting = false, }) {
    const { t } = useI18n();
    const submit = useCallback(() => {
        if (!title.trim() || submitting)
            return;
        onSubmit();
    }, [title, submitting, onSubmit]);
    return (_jsx("div", { className: "todo-add-card-modal-backdrop", children: _jsxs("div", { className: "todo-add-card-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "todo-add-card-modal-title", children: [_jsxs("div", { className: "todo-add-card-modal__head", children: [_jsx("h2", { id: "todo-add-card-modal-title", className: "todo-add-card-modal__title", children: columnTitle }), _jsx("button", { type: "button", className: "todo-add-card-modal__close", "aria-label": t('todoPage.close'), onClick: onClose, disabled: submitting, children: _jsx(IconClose, {}) })] }), _jsx("input", { type: "text", className: "todo-add-card-modal__input", placeholder: t('todoPage.addCard.placeholder'), value: title, onChange: (e) => onTitleChange(e.target.value), onKeyDown: (e) => {
                        if (e.key === 'Escape')
                            onClose();
                        if (e.key === 'Enter')
                            submit();
                    }, autoFocus: true, disabled: submitting }), _jsx("div", { className: "todo-add-card-modal__footer", children: _jsx("button", { type: "button", className: "todo-add-card-modal__submit", onClick: submit, disabled: !title.trim() || submitting, children: t('todoPage.addCard.submit') }) })] }) }));
}
