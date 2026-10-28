import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
export function ReportPreviewScopeLegend({ definitions, loading = false, disabled = false, onEdit, }) {
    if (!loading && definitions.length === 0)
        return null;
    return (_jsxs("div", { className: "tt-rp-scope-legend", "aria-label": "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0446\u0432\u0435\u0442\u043E\u0432 Scope", children: [_jsx("span", { className: "tt-rp-scope-legend__label", children: "Scope:" }), _jsxs("div", { className: "tt-rp-scope-legend__colors", children: [definitions.map((definition) => (_jsx("button", { type: "button", className: "tt-rp-scope-legend__color", style: { backgroundColor: definition.color }, title: `${definition.description}\nНажмите, чтобы изменить`, "aria-label": `${definition.color}: ${definition.description}. Нажмите, чтобы изменить.`, disabled: disabled, onClick: () => onEdit(definition) }, definition.color))), loading ? _jsx("span", { className: "tt-rp-scope-legend__loading", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439 Scope" }) : null] })] }));
}
export function ReportPreviewScopeDescriptionModal({ open, color, initialDescription, firstUse, saving, onCancel, onSave, }) {
    const [description, setDescription] = useState(initialDescription);
    useEffect(() => {
        if (open)
            setDescription(initialDescription);
    }, [color, initialDescription, open]);
    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && !saving)
                onCancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onCancel, open, saving]);
    if (!open)
        return null;
    const trimmedDescription = description.trim();
    return createPortal(_jsx("div", { className: "tt-rp-scope-modal", role: "presentation", onMouseDown: (event) => {
            if (event.target === event.currentTarget && !saving)
                onCancel();
        }, children: _jsxs("form", { className: "tt-rp-scope-modal__dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "tt-rp-scope-modal-title", onSubmit: (event) => {
                event.preventDefault();
                if (trimmedDescription)
                    void onSave(trimmedDescription);
            }, children: [_jsxs("div", { className: "tt-rp-scope-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { id: "tt-rp-scope-modal-title", className: "tt-rp-scope-modal__title", children: firstUse ? 'Описание нового Scope' : 'Редактировать Scope' }), _jsx("p", { className: "tt-rp-scope-modal__hint", children: firstUse
                                        ? 'Этот цвет выбран в проекте впервые. Добавьте описание, чтобы сохранить и применить его.'
                                        : 'Описание отображается при наведении на цвет в панели над таблицей.' })] }), _jsx("button", { type: "button", className: "tt-rp-scope-modal__close", onClick: onCancel, disabled: saving, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "tt-rp-scope-modal__color-row", children: [_jsx("span", { className: "tt-rp-scope-modal__swatch", style: { backgroundColor: color }, "aria-hidden": true }), _jsx("span", { className: "tt-rp-scope-modal__hex", children: color })] }), _jsxs("label", { className: "tt-rp-scope-modal__field", children: [_jsx("span", { children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), _jsx("textarea", { autoFocus: true, rows: 4, maxLength: 1000, value: description, onChange: (event) => setDescription(event.target.value), placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430", disabled: saving }), _jsxs("small", { children: [description.length, "/1000"] })] }), _jsxs("div", { className: "tt-rp-scope-modal__actions", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: onCancel, disabled: saving, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: "tt-reports__btn tt-rp-scope-modal__save", disabled: !trimmedDescription || saving, children: saving ? 'Сохранение…' : firstUse ? 'Сохранить и применить' : 'Сохранить' })] })] }) }), document.body);
}
