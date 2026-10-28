import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function KostaDailyChecklistMessage({ checklist, onToggle, onAppend, onRemove, }) {
    const [draft, setDraft] = useState('');
    const [adding, setAdding] = useState(false);
    const total = checklist.tasks.length;
    const done = checklist.done_count;
    const submitTask = async () => {
        const text = draft.trim();
        if (!text || adding)
            return;
        setAdding(true);
        try {
            await onAppend(text);
            setDraft('');
        }
        finally {
            setAdding(false);
        }
    };
    return (_jsxs("div", { className: "kd-tg__checklist", children: [_jsxs("div", { className: "kd-tg__checklist-head", children: [_jsx("span", { className: "kd-tg__poll-badge", children: "\u0427\u0435\u043A\u043B\u0438\u0441\u0442" }), _jsxs("span", { className: "kd-tg__checklist-progress", children: [done, "/", total] })] }), _jsx("p", { className: "kd-tg__poll-question", children: checklist.title }), _jsx("ul", { className: "kd-tg__checklist-tasks", children: checklist.tasks.map((task) => {
                    const doneTask = task.completed_by_user_id != null;
                    return (_jsxs("li", { className: `kd-tg__checklist-task${doneTask ? ' kd-tg__checklist-task--done' : ''}`, children: [_jsx("button", { type: "button", className: "kd-tg__checklist-check", role: "checkbox", "aria-checked": doneTask, "aria-label": doneTask ? 'Снять отметку' : 'Отметить выполненным', disabled: !checklist.can_toggle, onClick: () => onToggle(task.id), children: doneTask ? (_jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": true, children: _jsx("path", { d: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" }) })) : null }), _jsx("span", { className: "kd-tg__checklist-text", children: task.text }), checklist.can_remove ? (_jsx("button", { type: "button", className: "kd-tg__checklist-remove", "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443", disabled: total <= 1, onClick: () => onRemove(task.id), children: "\u00D7" })) : null] }, task.id));
                }) }), checklist.can_append ? (_jsxs("form", { className: "kd-tg__checklist-add", onSubmit: (e) => {
                    e.preventDefault();
                    void submitTask();
                }, children: [_jsx("input", { type: "text", className: "kd-tg__checklist-add-input", value: draft, maxLength: 200, placeholder: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443", "aria-label": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443", disabled: adding || total >= 30, onChange: (e) => setDraft(e.target.value) }), _jsx("button", { type: "submit", className: "kd-tg__checklist-add-btn", disabled: adding || !draft.trim() || total >= 30, children: "+" })] })) : null] }));
}
