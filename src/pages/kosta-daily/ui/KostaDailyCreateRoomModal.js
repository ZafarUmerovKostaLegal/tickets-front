import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { KostaDailyChatModalShell } from './KostaDailyChatModalShell';
function employeeLabel(emp) {
    return emp.display_name?.trim() || emp.email?.trim() || `Пользователь ${emp.id}`;
}
function employeeInitials(emp) {
    const name = employeeLabel(emp);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
}
export function KostaDailyCreateRoomModal({ open, kind, employees, currentUserId, onClose, onSubmit, }) {
    const [title, setTitle] = useState('');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = employees.filter((e) => {
            if (currentUserId != null && e.id === currentUserId)
                return false;
            if (!q)
                return true;
            const name = employeeLabel(e).toLowerCase();
            return name.includes(q) || (e.email?.toLowerCase().includes(q) ?? false);
        });
        return sortByRuLabel(rows, employeeLabel);
    }, [employees, query, currentUserId]);
    const toggle = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const handleSubmit = async () => {
        const t = title.trim();
        if (!t) {
            setError('Введите название');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await onSubmit(t, [...selected]);
            setTitle('');
            setQuery('');
            setSelected(new Set());
            onClose();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось создать');
        }
        finally {
            setSaving(false);
        }
    };
    const label = kind === 'channel' ? 'канал' : 'группу';
    const selectedCount = selected.size;
    return (_jsxs(KostaDailyChatModalShell, { open: open, title: kind === 'channel' ? 'Новый канал' : 'Новая группа', ariaLabel: `Создать ${label}`, onClose: onClose, className: "kd-tg__modal--room", footer: (_jsxs("div", { className: "kd-tg__modal-actions", children: [_jsx("button", { type: "button", className: "kd-tg__modal-btn", onClick: onClose, disabled: saving, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "kd-tg__modal-btn kd-tg__modal-btn--primary", onClick: () => void handleSubmit(), disabled: saving, children: saving ? 'Создание…' : 'Создать' })] })), children: [_jsx("p", { className: "kd-tg__modal-hint", children: kind === 'channel'
                    ? 'В канале писать могут только администраторы. Подписчики читают сообщения.'
                    : 'Все участники группы могут отправлять сообщения.' }), _jsxs("label", { className: "kd-tg__modal-field", children: [_jsx("span", { className: "kd-tg__modal-label", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435" }), _jsx("input", { type: "text", className: "kd-tg__modal-input", value: title, onChange: (e) => setTitle(e.target.value), placeholder: kind === 'channel' ? 'Например: Новости офиса' : 'Например: Команда проекта', maxLength: 200, autoFocus: true })] }), _jsxs("label", { className: "kd-tg__modal-field", children: [_jsxs("span", { className: "kd-tg__modal-label", children: ["\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438", selectedCount > 0 ? (_jsx("span", { className: "kd-tg__modal-label-badge", children: selectedCount })) : null] }), _jsx("input", { type: "search", className: "kd-tg__modal-input", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432" })] }), _jsx("ul", { className: "kd-tg__modal-members", role: "list", children: filtered.length === 0 ? (_jsx("li", { className: "kd-tg__modal-members-empty", role: "listitem", children: "\u041D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" })) : filtered.map((emp) => (_jsx("li", { role: "listitem", children: _jsxs("label", { className: `kd-tg__modal-member${selected.has(emp.id) ? ' kd-tg__modal-member--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: selected.has(emp.id), onChange: () => toggle(emp.id) }), _jsx("span", { className: "kd-tg__modal-check-box", "aria-hidden": true }), _jsx("span", { className: "kd-tg__modal-member-avatar", "aria-hidden": true, children: employeeInitials(emp) }), _jsx("span", { className: "kd-tg__modal-member-name", children: employeeLabel(emp) })] }) }, emp.id))) }), error ? _jsx("p", { className: "kd-tg__modal-error", role: "alert", children: error }) : null] }));
}
