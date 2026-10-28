import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { postVacationScheduleEmployee } from '@entities/vacation';
import { listColleaguesAsUsers } from '@entities/contacts';
import { isHiddenSystemUser } from '@shared/lib';
import { SearchableSelect } from '@shared/ui';
import './VacationScheduleImportModal.css';
function userLabel(u) {
    return (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim();
}
export function VacationAddEmployeeModal({ open, onClose, year, onSuccess }) {
    const uid = useId();
    const prevOpenRef = useRef(false);
    const [employeeId, setEmployeeId] = useState('');
    const [note, setNote] = useState('');
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            setEmployeeId('');
            setNote('');
            setError(null);
        }
        prevOpenRef.current = open;
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setUsersLoading(true);
        void listColleaguesAsUsers()
            .then((list) => {
            if (cancelled)
                return;
            const opts = list
                .filter((u) => !u.is_archived && !u.is_blocked && !isHiddenSystemUser(u))
                .map((u) => {
                const label = userLabel(u);
                return {
                    id: String(u.id),
                    userId: u.id,
                    label,
                    email: u.email,
                    search: `${label} ${u.email}`.toLowerCase(),
                };
            })
                .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
            setUsers(opts);
        })
            .catch((e) => {
            if (!cancelled) {
                setUsers([]);
                setError(e instanceof Error ? e.message : 'Не удалось загрузить список сотрудников.');
            }
        })
            .finally(() => {
            if (!cancelled)
                setUsersLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitting)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose, submitting]);
    const selectedUser = useMemo(() => users.find((u) => u.id === employeeId) ?? null, [users, employeeId]);
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError(null);
        if (!selectedUser) {
            setError('Выберите сотрудника из каталога.');
            return;
        }
        setSubmitting(true);
        try {
            const body = {
                year,
                full_name: selectedUser.label,
                auth_user_id: selectedUser.userId,
                email: selectedUser.email,
            };
            const nt = note.trim();
            if (nt)
                body.planned_period_note = nt;
            await postVacationScheduleEmployee(body);
            onSuccess();
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось добавить строку');
        }
        finally {
            setSubmitting(false);
        }
    }, [selectedUser, note, onClose, onSuccess, year]);
    if (!open)
        return null;
    return createPortal(_jsx("div", { className: "vac-imp-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, children: _jsxs("div", { className: "vac-imp-modal__dialog", children: [_jsxs("div", { className: "vac-imp-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "vac-imp-modal__title", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u0432 \u0433\u0440\u0430\u0444\u0438\u043A" }), _jsx("button", { type: "button", className: "vac-imp-modal__x", onClick: onClose, disabled: submitting, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-imp-modal__body", children: [_jsxs("p", { className: "vac-imp__hint", children: ["\u0413\u043E\u0434: ", year, ". \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0433\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u2014 \u0441\u0442\u0440\u043E\u043A\u0430 \u0431\u0443\u0434\u0435\u0442 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u0430 \u043A \u0435\u0433\u043E \u043F\u0440\u043E\u0444\u0438\u043B\u044E. \u041E\u0431\u044B\u0447\u043D\u043E \u0441\u0442\u0440\u043E\u043A\u0438 \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u0430\u044F\u0432\u043A\u0438; \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u2014 \u0434\u043B\u044F \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0439."] }), _jsxs("form", { className: "vac-imp__form", onSubmit: (ev) => void handleSubmit(ev), children: [_jsxs("div", { className: "vac-imp__row", children: [_jsx("label", { className: "vac-imp__lbl", htmlFor: `${uid}-emp`, children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), _jsx(SearchableSelect, { portalDropdown: true, "aria-label": "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A", placeholder: usersLoading ? 'Загрузка…' : users.length === 0 ? 'Сотрудники не найдены' : 'Выберите сотрудника…', emptyListText: "\u041D\u0435\u0442 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: employeeId, items: users, getOptionValue: (o) => o.id, getOptionLabel: (o) => `${o.label} (${o.email})`, getSearchText: (o) => o.search, disabled: usersLoading || users.length === 0, onSelect: (o) => setEmployeeId(o.id) })] }), _jsxs("div", { className: "vac-imp__row", children: [_jsx("label", { className: "vac-imp__lbl", htmlFor: `${uid}-note`, children: "\u041F\u0435\u0440\u0438\u043E\u0434 / \u043F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435" }), _jsx("input", { id: `${uid}-note`, className: "vac-imp__inp", value: note, onChange: (ev) => setNote(ev.target.value), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E", autoComplete: "off" })] }), error && (_jsx("p", { className: "vac-imp__err", role: "alert", children: error })), _jsxs("div", { className: "vac-imp-modal__actions", children: [_jsx("button", { type: "button", className: "vac-imp-modal__btn-secondary", onClick: onClose, disabled: submitting, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: "vac-imp__btn", disabled: submitting || !selectedUser, children: submitting ? 'Сохранение…' : 'Добавить' })] })] })] })] }) }), document.body);
}
