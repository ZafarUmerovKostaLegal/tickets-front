import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';
const EMPTY_OPTIONS = ['', ''];
export function KostaDailyPollComposerModal({ open, onClose, onSubmit, }) {
    const [kind, setKind] = useState('poll');
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(EMPTY_OPTIONS);
    const [allowsMultiple, setAllowsMultiple] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [explanation, setExplanation] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const updateOption = (index, value) => {
        setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
    };
    const addOption = () => {
        if (options.length >= 10)
            return;
        setOptions((prev) => [...prev, '']);
    };
    const removeOption = (index) => {
        if (options.length <= 2)
            return;
        setOptions((prev) => prev.filter((_, i) => i !== index));
        if (correctIndex >= index)
            setCorrectIndex(Math.max(0, correctIndex - 1));
    };
    const reset = () => {
        setKind('poll');
        setQuestion('');
        setOptions(EMPTY_OPTIONS);
        setAllowsMultiple(false);
        setIsAnonymous(false);
        setCorrectIndex(0);
        setExplanation('');
        setError(null);
    };
    const handleSubmit = async () => {
        const q = question.trim();
        const cleaned = options.map((o) => o.trim()).filter(Boolean);
        if (!q) {
            setError('Введите вопрос');
            return;
        }
        if (cleaned.length < 2) {
            setError('Нужно минимум 2 варианта ответа');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSubmit({
                kind,
                question: q,
                options: cleaned,
                allowsMultiple: kind === 'poll' ? allowsMultiple : false,
                isAnonymous,
                correctOptionIndex: kind === 'quiz' ? correctIndex : undefined,
                explanation: kind === 'quiz' ? explanation.trim() || undefined : undefined,
            });
            reset();
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось создать');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs(KostaDailyChatModalShell, { open: open, title: "\u041E\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u0432\u0438\u043A\u0442\u043E\u0440\u0438\u043D\u0430", onClose: onClose, className: "kd-tg__modal--poll", footer: (_jsxs("div", { className: "kd-tg__modal-actions", children: [_jsx("button", { type: "button", className: "kd-tg__modal-btn", onClick: onClose, disabled: saving, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "kd-tg__modal-btn kd-tg__modal-btn--primary", onClick: () => void handleSubmit(), disabled: saving, children: saving ? 'Отправка…' : 'Опубликовать' })] })), children: [_jsxs("div", { className: "kd-tg__modal-tabs", role: "tablist", "aria-label": "\u0422\u0438\u043F", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": kind === 'poll', className: `kd-tg__modal-tab${kind === 'poll' ? ' kd-tg__modal-tab--on' : ''}`, onClick: () => setKind('poll'), children: "\u041E\u043F\u0440\u043E\u0441" }), _jsx("button", { type: "button", role: "tab", "aria-selected": kind === 'quiz', className: `kd-tg__modal-tab${kind === 'quiz' ? ' kd-tg__modal-tab--on' : ''}`, onClick: () => setKind('quiz'), children: "\u0412\u0438\u043A\u0442\u043E\u0440\u0438\u043D\u0430" })] }), _jsxs("label", { className: "kd-tg__modal-field", children: [_jsx("span", { className: "kd-tg__modal-label", children: "\u0412\u043E\u043F\u0440\u043E\u0441" }), _jsx("input", { type: "text", className: "kd-tg__modal-input", value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u043E\u043F\u0440\u043E\u0441", maxLength: 500, autoFocus: true })] }), _jsxs("div", { className: "kd-tg__modal-field", children: [_jsx("span", { className: "kd-tg__modal-label", children: kind === 'quiz' ? 'Варианты · отметьте правильный' : 'Варианты ответа' }), _jsx("div", { className: "kd-tg__modal-options", children: options.map((opt, index) => (_jsxs("div", { className: "kd-tg__poll-compose-row", children: [kind === 'quiz' ? (_jsxs("label", { className: "kd-tg__poll-compose-radio", title: "\u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442", children: [_jsx("input", { type: "radio", name: "correct", checked: correctIndex === index, onChange: () => setCorrectIndex(index) }), _jsx("span", { className: "kd-tg__poll-compose-radio-mark", "aria-hidden": true })] })) : (_jsx("span", { className: "kd-tg__poll-compose-num", "aria-hidden": true, children: index + 1 })), _jsx("input", { type: "text", className: "kd-tg__modal-input kd-tg__modal-input--plain", value: opt, onChange: (e) => updateOption(index, e.target.value), placeholder: `Вариант ${index + 1}` }), _jsx("button", { type: "button", className: "kd-tg__modal-option-remove", onClick: () => removeOption(index), disabled: options.length <= 2, "aria-label": `Удалить вариант ${index + 1}`, children: "\u00D7" })] }, index))) }), _jsx("button", { type: "button", className: "kd-tg__modal-link", onClick: addOption, disabled: options.length >= 10, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0430\u0440\u0438\u0430\u043D\u0442" })] }), kind === 'poll' ? (_jsx("div", { className: "kd-tg__modal-settings", children: _jsxs("label", { className: "kd-tg__modal-check", children: [_jsx("input", { type: "checkbox", checked: allowsMultiple, onChange: (e) => setAllowsMultiple(e.target.checked) }), _jsx("span", { className: "kd-tg__modal-check-box", "aria-hidden": true }), _jsx("span", { children: "\u041D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u0432\u0435\u0442\u043E\u0432" })] }) })) : (_jsxs("label", { className: "kd-tg__modal-field", children: [_jsx("span", { className: "kd-tg__modal-label", children: "\u041F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0435 (\u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u0432\u0435\u0442\u0430)" }), _jsx("input", { type: "text", className: "kd-tg__modal-input", value: explanation, onChange: (e) => setExplanation(e.target.value), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E" })] })), _jsx("div", { className: "kd-tg__modal-settings", children: _jsxs("label", { className: "kd-tg__modal-check", children: [_jsx("input", { type: "checkbox", checked: isAnonymous, onChange: (e) => setIsAnonymous(e.target.checked) }), _jsx("span", { className: "kd-tg__modal-check-box", "aria-hidden": true }), _jsx("span", { children: "\u0410\u043D\u043E\u043D\u0438\u043C\u043D\u043E\u0435 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043D\u0438\u0435" })] }) }), error ? _jsx("p", { className: "kd-tg__modal-error", role: "alert", children: error }) : null] }));
}
