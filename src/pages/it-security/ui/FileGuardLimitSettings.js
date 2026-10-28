import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
export function FileGuardLimitSettings({ open, onClose, sharedInput, userInput, onSharedInput, onUserInput, sharedLimit, personalLimit, personalName, userSelected, busy, error, onSaveShared, onSaveUser, }) {
    useEffect(() => {
        if (!open)
            return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open)
        return null;
    const sharedNote = sharedLimit == null
        ? 'Пустое поле блокирует всех, у кого нет своего лимита.'
        : `Сейчас для всех: ${sharedLimit} МБ в день.`;
    const userNote = !userSelected
        ? 'Выберите пользователя слева, чтобы задать ему отдельный размер.'
        : personalLimit != null
            ? `Свой лимит: ${personalLimit} МБ в день. Пустое поле возвращает общий.`
            : sharedLimit != null
                ? `Своего лимита нет, действует общий: ${sharedLimit} МБ в день.`
                : 'Своего лимита нет, отправка блокируется.';
    return createPortal(_jsx("div", { className: "its-limit", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "its-limit__dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "its-limit-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "its-limit__head", children: [_jsxs("div", { children: [_jsx("h2", { id: "its-limit-title", className: "its-limit__title", children: "\u041B\u0438\u043C\u0438\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438" }), _jsx("p", { className: "its-limit__lead", children: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0435\u0433\u0430\u0431\u0430\u0439\u0442 \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430 \u0434\u0435\u043D\u044C. \u0424\u0430\u0439\u043B \u0431\u043E\u043B\u044C\u0448\u0435 \u043E\u0441\u0442\u0430\u0442\u043A\u0430 \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442\u0441\u044F." })] }), _jsx("button", { type: "button", className: "its-limit__close", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", onClick: onClose, children: "\u00D7" })] }), _jsxs("div", { className: "its-limit__body", children: [_jsxs("section", { className: "its-limit__card", children: [_jsx("div", { className: "its-limit__card-title", children: "\u0414\u043B\u044F \u0432\u0441\u0435\u0445" }), _jsx("p", { className: "its-limit__card-note", children: sharedNote }), _jsxs("div", { className: "its-limit__row", children: [_jsxs("label", { className: "its-limit__field", children: [_jsx("input", { type: "number", min: 0, max: 100000, inputMode: "numeric", value: sharedInput, placeholder: "\u0431\u043B\u043E\u043A", "aria-label": "\u041E\u0431\u0449\u0438\u0439 \u043B\u0438\u043C\u0438\u0442 \u0432 \u043C\u0435\u0433\u0430\u0431\u0430\u0439\u0442\u0430\u0445 \u0437\u0430 \u0434\u0435\u043D\u044C", onChange: (event) => onSharedInput(event.target.value) }), _jsx("span", { className: "its-limit__unit", children: "\u041C\u0411" })] }), _jsx("button", { type: "button", className: "its-limit__save", disabled: busy !== '', onClick: onSaveShared, children: busy === 'shared' ? 'Сохраняем…' : 'Сохранить' })] })] }), _jsxs("section", { className: "its-limit__card", children: [_jsx("div", { className: "its-limit__card-title", children: userSelected ? personalName : 'Для пользователя' }), _jsx("p", { className: "its-limit__card-note", children: userNote }), _jsxs("div", { className: "its-limit__row", children: [_jsxs("label", { className: "its-limit__field", children: [_jsx("input", { type: "number", min: 0, max: 100000, inputMode: "numeric", value: userSelected ? userInput : '', placeholder: userSelected ? 'общий' : 'выберите', disabled: !userSelected, "aria-label": "\u041B\u0438\u0447\u043D\u044B\u0439 \u043B\u0438\u043C\u0438\u0442 \u0432 \u043C\u0435\u0433\u0430\u0431\u0430\u0439\u0442\u0430\u0445 \u0437\u0430 \u0434\u0435\u043D\u044C", onChange: (event) => onUserInput(event.target.value) }), _jsx("span", { className: "its-limit__unit", children: "\u041C\u0411" })] }), _jsx("button", { type: "button", className: "its-limit__save", disabled: !userSelected || busy !== '', onClick: onSaveUser, children: busy === 'user' ? 'Сохраняем…' : 'Сохранить' })] })] }), error ? _jsx("p", { className: "its-j__bad", children: error }) : null] })] }) }), document.body);
}
