import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { approveVacationLeaveRequest, declineVacationLeaveRequest, } from '@entities/vacation';
import { isDirectManagingPartnerRequest } from '../lib/leaveApprovalStage';
import { useAppToast } from '@shared/ui';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
import './VacationDecisionModal.css';
const TITLES = {
    approve: 'Утвердить заявку',
    decline: 'Отклонить заявку',
};
const FINAL_TITLES = {
    approve: 'Финальное утверждение заявки',
    decline: 'Отклонить заявку окончательно',
};
const SUBMIT_LABELS = {
    approve: 'Утвердить',
    decline: 'Отклонить',
};
export function VacationDecisionModal({ open, onClose, request, decision, onDecided }) {
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
    }, [open, request?.id, decision]);
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
            const trimmed = reason.trim();
            const next = decision === 'approve'
                ? await approveVacationLeaveRequest(request.id, trimmed || null)
                : await declineVacationLeaveRequest(request.id, trimmed || null);
            pushToast({
                variant: decision === 'approve' ? 'success' : 'info',
                message: decision !== 'approve'
                    ? `Заявка #${request.id} отклонена.`
                    : next.status === 'pending_final'
                        ? `Заявка #${request.id} согласована и ушла на финальное подтверждение управляющему партнёру.`
                        : `Заявка #${request.id} утверждена.`,
            });
            onDecided(next);
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось применить решение.');
        }
        finally {
            setSubmitting(false);
        }
    }, [decision, onClose, onDecided, pushToast, reason, request]);
    if (!open || !request)
        return null;
    const declineReasonRequired = decision === 'decline';
    const directManaging = isDirectManagingPartnerRequest(request);
    const finalStage = request.status === 'pending_final' || (request.status === 'pending' && directManaging);
    const stageHint = request.status === 'pending_final'
        ? `${request.partner_full_name || 'Курирующий партнёр'} уже согласовал заявку. Ваше решение финальное: после утверждения дни появятся в графике.`
        : directManaging
            ? 'Вас выбрали курирующим партнёром. Вы же управляющий партнёр — решение сразу финальное, после утверждения дни появятся в графике.'
            : 'Это согласование курирующего партнёра. После него заявку подтверждает управляющий партнёр'
                + `${request.managing_partner_full_name ? ` (${request.managing_partner_full_name})` : ''}.`;
    return createPortal(_jsx("div", { className: "vac-imp-modal vac-dec-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, children: _jsxs("form", { className: "vac-imp-modal__dialog vac-dec-modal__dialog", onSubmit: handleSubmit, children: [_jsxs("div", { className: "vac-imp-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "vac-imp-modal__title", children: finalStage ? FINAL_TITLES[decision] : TITLES[decision] }), _jsx("button", { type: "button", className: "vac-imp-modal__x", onClick: onClose, disabled: submitting, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-imp-modal__body vac-dec-modal__body", children: [_jsxs("p", { className: "vac-dec-modal__lead", children: [_jsx("strong", { children: request.employee_full_name || request.employee_email || `#${request.id}` }), request.employee_position ? _jsxs("span", { className: "vac-dec-modal__muted", children: [" \u00B7 ", request.employee_position] }) : null] }), _jsxs("p", { className: "vac-dec-modal__meta", children: ["\u041F\u0435\u0440\u0438\u043E\u0434: ", _jsxs("strong", { children: [request.date_from, " \u2014 ", request.date_to] }), " (", request.days_count, " \u0434\u043D.)"] }), request.reason && (_jsxs("p", { className: "vac-dec-modal__reason-given", children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430: \u00AB", request.reason, "\u00BB"] })), _jsx("p", { className: "vac-dec-modal__stage", children: stageHint }), finalStage && request.decision_reason ? (_jsxs("p", { className: "vac-dec-modal__reason-given", children: ["\u0420\u0435\u0437\u043E\u043B\u044E\u0446\u0438\u044F \u043A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0435\u0433\u043E \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430: \u00AB", request.decision_reason, "\u00BB"] })) : null, _jsxs("label", { className: "vac-dec-modal__field", children: [_jsxs("span", { children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0440\u0435\u0448\u0435\u043D\u0438\u044E", declineReasonRequired ? '' : ' (необязательно)'] }), _jsx("textarea", { className: "vac-req-modal__reason", value: reason, onChange: (e) => setReason(e.target.value), rows: 3, maxLength: 500, placeholder: decision === 'approve'
                                        ? 'Можно оставить пустым.'
                                        : 'Например: пересечение с критическим дедлайном.', disabled: submitting })] }), error && (_jsx("p", { className: "vac-req-modal__error", role: "alert", children: error })), _jsxs("div", { className: "vac-imp-modal__actions", children: [_jsx("button", { type: "button", className: "vac-imp-modal__btn-secondary", onClick: onClose, disabled: submitting, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: `vac-req-modal__submit vac-dec-modal__submit vac-dec-modal__submit--${decision}`, disabled: submitting, children: submitting ? 'Сохранение…' : SUBMIT_LABELS[decision] })] })] })] }) }), document.body);
}
