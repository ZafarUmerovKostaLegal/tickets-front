import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconClose } from './TodoIcons';
import { useI18n } from '@shared/i18n';
export function TodoAddColumnModal({ title, onTitleChange, onClose, onSubmit }) {
    const { t } = useI18n();
    return (_jsx("div", { className: "todo-add-card-modal-backdrop", children: _jsxs("div", { className: "todo-add-card-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "todo-add-column-modal-title", children: [_jsxs("div", { className: "todo-add-card-modal__head", children: [_jsx("h2", { id: "todo-add-column-modal-title", className: "todo-add-card-modal__title", children: t('todoPage.addColumn.title') }), _jsx("button", { type: "button", className: "todo-add-card-modal__close", "aria-label": t('todoPage.close'), onClick: onClose, children: _jsx(IconClose, {}) })] }), _jsx("input", { type: "text", className: "todo-add-card-modal__input", placeholder: t('todoPage.addColumn.placeholder'), value: title, onChange: (e) => onTitleChange(e.target.value), onKeyDown: (e) => {
                        if (e.key === 'Escape')
                            onClose();
                        if (e.key === 'Enter')
                            onSubmit();
                    }, autoFocus: true }), _jsx("div", { className: "todo-add-card-modal__footer", children: _jsx("button", { type: "button", className: "todo-add-card-modal__submit", onClick: onSubmit, children: t('todoPage.addColumn.submit') }) })] }) }));
}
