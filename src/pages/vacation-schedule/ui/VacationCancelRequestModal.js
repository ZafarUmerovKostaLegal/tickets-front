import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { cancelVacationLeaveRequest, deleteVacationLeaveRequest, withdrawVacationLeaveRequest, } from '@entities/vacation';
import { useAppToast } from '@shared/ui';
import { formatRuRange, ruDaysWord } from '../lib/leaveRequestDisplay';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
import './VacationDecisionModal.css';
import './VacationCancelRequestModal.css';
const TITLES = {
    withdraw: 'Отозвать заявку',
    cancel: 'Отменить отсутствие',
    delete: 'Удалить заявку',
};
const SUBMIT_LABELS = {
    withdraw: 'Отозвать',
    cancel: 'Отменить отсутствие',
    delete: 'Удалить',
};
const WARNINGS = {
    withdraw: 'Согласующие получат уведомление, что заявка отозвана до финального решения. Подать новую заявку на этот период можно будет сразу.',
    cancel: 'Дни этого отсутствия будут удалены из графика, а партнёр получит уведомление об отмене.',
    delete: 'Заявка и её PDF будут удалены безвозвратно. Если отсутствие уже стоит в графике, эти дни тоже уберутся.',
};
export function VacationCancelRequestModal({ open, onClose, request, action, onUpdated, onDeleted }) {
    const uid = useId();
    const { pushToast } = useAppToast();
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        setReason('');
        setError(null);
        setSubmitting(false);
    }, [open, request?.id, action]);
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
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!request)
            return;
        setError(null);
        setSubmitting(true);
        try {
            if (action === 'delete') {
                await deleteVacationLeaveRequest(request.id);
                pushToast({ variant: 'info', message: `Заявка #${request.id} удалена.` });
                onDeleted(request.id);
            }
            else {
                const trimmed = reason.trim();
                const next = action === 'withdraw'
                    ? await withdrawVacationLeaveRequest(request.id, trimmed || null)
                    : await cancelVacationLeaveRequest(request.id, trimmed || null);
                pushToast({
                    variant: 'info',
                    message: action === 'withdraw'
                        ? `Заявка #${request.id} отозвана.`
                        : `Отсутствие по заявке #${request.id} отменено.`,
                });
                onUpdated(next);
            }
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось выполнить действие.');
        }
        finally {
            setSubmitting(false);
        }
    }, [action, onClose, onDeleted, onUpdated, pushToast, reason, request]);
    if (!open || !request)
        return null;
    return createPortal(_jsx("div", { className: "vac-imp-modal vac-dec-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, children: _jsxs("form", { className: "vac-imp-modal__dialog vac-dec-modal__dialog", onSubmit: handleSubmit, children: [_jsxs("div", { className: "vac-imp-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "vac-imp-modal__title", children: TITLES[action] }), _jsx("button", { type: "button", className: "vac-imp-modal__x", onClick: onClose, disabled: submitting, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-imp-modal__body vac-dec-modal__body", children: [_jsxs("p", { className: "vac-dec-modal__lead", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 #", request.id, _jsxs("span", { className: "vac-dec-modal__muted", children: [' · ', "\u043A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0439 \u043F\u0430\u0440\u0442\u043D\u0451\u0440 ", request.partner_full_name || request.partner_email || `#${request.partner_user_id}`] })] }), _jsxs("p", { className: "vac-dec-modal__meta", children: ["\u041F\u0435\u0440\u0438\u043E\u0434: ", _jsx("strong", { children: formatRuRange(request.date_from, request.date_to) }), ' ', "(", request.days_count, " ", ruDaysWord(request.days_count), ")"] }), _jsx("p", { className: "vac-cancel-modal__warn", children: WARNINGS[action] }), action !== 'delete' && (_jsxs("label", { className: "vac-dec-modal__field", children: [_jsx("span", { children: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" }), _jsx("textarea", { className: "vac-req-modal__reason", value: reason, onChange: (e) => setReason(e.target.value), rows: 3, maxLength: 500, placeholder: action === 'withdraw'
                                        ? 'Например: перенесу отпуск на сентябрь.'
                                        : 'Например: выхожу на работу раньше.', disabled: submitting })] })), error && (_jsx("p", { className: "vac-req-modal__error", role: "alert", children: error })), _jsxs("div", { className: "vac-imp-modal__actions", children: [_jsx("button", { type: "button", className: "vac-imp-modal__btn-secondary", onClick: onClose, disabled: submitting, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }), _jsx("button", { type: "submit", className: "vac-req-modal__submit vac-dec-modal__submit vac-dec-modal__submit--decline", disabled: submitting, children: submitting ? 'Выполняем…' : SUBMIT_LABELS[action] })] })] })] }) }), document.body);
}
