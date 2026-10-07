import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';
const MAX_TASKS = 30;
export function KostaDailyChecklistComposerModal({ open, onClose, onSubmit, }) {
    const [title, setTitle] = useState('');
    const [tasks, setTasks] = useState(['']);
    const [othersCanComplete, setOthersCanComplete] = useState(false);
    const [othersCanAppend, setOthersCanAppend] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        setTitle('');
        setTasks(['']);
        setOthersCanComplete(false);
        setOthersCanAppend(false);
        setSaving(false);
        setError(null);
    }, [open]);
    const updateTask = (index, value) => {
        setTasks((prev) => prev.map((task, i) => (i === index ? value : task)));
    };
    const addTask = () => {
        if (tasks.length >= MAX_TASKS)
            return;
        setTasks((prev) => [...prev, '']);
    };
    const removeTask = (index) => {
        setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    };
    const handleSubmit = async () => {
        const cleanedTitle = title.trim();
        const cleanedTasks = tasks.map((task) => task.trim()).filter(Boolean);
        if (!cleanedTitle) {
            setError('Введите название');
            return;
        }
        if (cleanedTasks.length === 0) {
            setError('Добавьте хотя бы одну задачу');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSubmit({
                title: cleanedTitle,
                tasks: cleanedTasks,
                othersCanComplete,
                othersCanAppend,
            });
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось создать чеклист');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs(KostaDailyChatModalShell, { open: open, title: "\u041D\u043E\u0432\u044B\u0439 \u0447\u0435\u043A\u043B\u0438\u0441\u0442", ariaLabel: "\u041D\u043E\u0432\u044B\u0439 \u0447\u0435\u043A\u043B\u0438\u0441\u0442", onClose: onClose, className: "kd-tg__modal--checklist", footer: (_jsxs("div", { className: "kd-tg__modal-actions", children: [_jsx("button", { type: "button", className: "kd-tg__modal-btn", onClick: onClose, disabled: saving, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "kd-tg__modal-btn kd-tg__modal-btn--primary", onClick: () => void handleSubmit(), disabled: saving, children: saving ? 'Создание…' : 'Создать' })] })), children: [_jsxs("label", { className: "kd-tg__modal-field", children: [_jsx("span", { className: "kd-tg__modal-label", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435" }), _jsx("input", { type: "text", className: "kd-tg__modal-input", value: title, maxLength: 255, autoFocus: true, placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043A \u0432\u0441\u0442\u0440\u0435\u0447\u0435", onChange: (e) => setTitle(e.target.value) })] }), _jsxs("div", { className: "kd-tg__modal-field", children: [_jsxs("span", { className: "kd-tg__modal-label", children: ["\u0417\u0430\u0434\u0430\u0447\u0438", _jsxs("span", { className: "kd-cl__count", children: [tasks.length, "/", MAX_TASKS] })] }), _jsx("div", { className: "kd-cl__tasks", children: tasks.map((task, index) => (_jsxs("div", { className: "kd-cl__task", children: [_jsx("span", { className: "kd-cl__box", "aria-hidden": true }), _jsx("input", { type: "text", className: "kd-cl__task-input", value: task, maxLength: 200, placeholder: "\u0417\u0430\u0434\u0430\u0447\u0430", "aria-label": `Задача ${index + 1}`, onChange: (e) => updateTask(index, e.target.value), onKeyDown: (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addTask();
                                        }
                                    } }), _jsx("button", { type: "button", className: "kd-cl__remove", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443", disabled: tasks.length <= 1, onClick: () => removeTask(index), children: "\u00D7" })] }, index))) }), _jsx("button", { type: "button", className: "kd-cl__add", onClick: addTask, disabled: tasks.length >= MAX_TASKS, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" })] }), _jsxs("div", { className: "kd-cl__options", children: [_jsx("p", { className: "kd-tg__modal-label", children: "\u041A\u0442\u043E \u0435\u0449\u0451 \u043C\u043E\u0436\u0435\u0442 \u043C\u0435\u043D\u044F\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A" }), _jsxs("label", { className: "kd-cl__switch", children: [_jsxs("span", { className: "kd-cl__switch-copy", children: [_jsx("span", { className: "kd-cl__switch-title", children: "\u041E\u0442\u043C\u0435\u0447\u0430\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u043C" }), _jsx("span", { className: "kd-cl__switch-hint", children: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438 \u0447\u0430\u0442\u0430 \u0441\u043C\u043E\u0433\u0443\u0442 \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0438 \u0441\u043D\u0438\u043C\u0430\u0442\u044C \u0433\u0430\u043B\u043E\u0447\u043A\u0438" })] }), _jsx("input", { type: "checkbox", className: "kd-cl__switch-input", checked: othersCanComplete, onChange: (e) => setOthersCanComplete(e.target.checked) }), _jsx("span", { className: "kd-cl__switch-track", "aria-hidden": true })] }), _jsxs("label", { className: "kd-cl__switch", children: [_jsxs("span", { className: "kd-cl__switch-copy", children: [_jsx("span", { className: "kd-cl__switch-title", children: "\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0438" }), _jsx("span", { className: "kd-cl__switch-hint", children: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438 \u0441\u043C\u043E\u0433\u0443\u0442 \u0434\u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u043F\u0443\u043D\u043A\u0442\u044B" })] }), _jsx("input", { type: "checkbox", className: "kd-cl__switch-input", checked: othersCanAppend, onChange: (e) => setOthersCanAppend(e.target.checked) }), _jsx("span", { className: "kd-cl__switch-track", "aria-hidden": true })] })] }), error ? _jsx("p", { className: "kd-tg__modal-error", role: "alert", children: error }) : null] }));
}
