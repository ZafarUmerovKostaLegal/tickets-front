import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    approveVacationLeaveRequest,
    declineVacationLeaveRequest,
    type VacationLeaveRequestApi,
} from '@entities/vacation';
import { useAppToast } from '@shared/ui';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
import './VacationDecisionModal.css';

type Props = {
    open: boolean;
    onClose: () => void;
    request: VacationLeaveRequestApi | null;
    decision: 'approve' | 'decline';

    onDecided: (next: VacationLeaveRequestApi) => void;
};

const TITLES = {
    approve: 'Утвердить заявку',
    decline: 'Отклонить заявку',
} as const;

const SUBMIT_LABELS = {
    approve: 'Утвердить',
    decline: 'Отклонить',
} as const;

export function VacationDecisionModal({ open, onClose, request, decision, onDecided }: Props) {
    const uid = useId();
    const { pushToast } = useAppToast();
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        const onKey = (e: KeyboardEvent) => {
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

    const handleSubmit = useCallback(async (e: FormEvent) => {
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
                message:
                    decision === 'approve'
                        ? `Заявка #${request.id} утверждена.`
                        : `Заявка #${request.id} отклонена.`,
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

    return createPortal(
        <div className="vac-imp-modal vac-dec-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
            <form className="vac-imp-modal__dialog vac-dec-modal__dialog" onSubmit={handleSubmit}>
                <div className="vac-imp-modal__head">
                    <h2 id={`${uid}-title`} className="vac-imp-modal__title">
                        {TITLES[decision]}
                    </h2>
                    <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <div className="vac-imp-modal__body vac-dec-modal__body">
                    <p className="vac-dec-modal__lead">
                        <strong>{request.employee_full_name || request.employee_email || `#${request.id}`}</strong>
                        {request.employee_position ? <span className="vac-dec-modal__muted"> · {request.employee_position}</span> : null}
                    </p>
                    <p className="vac-dec-modal__meta">
                        Период: <strong>{request.date_from} — {request.date_to}</strong> ({request.days_count} дн.)
                    </p>
                    {request.reason && (
                        <p className="vac-dec-modal__reason-given">
                            Комментарий сотрудника: «{request.reason}»
                        </p>
                    )}
                    <label className="vac-dec-modal__field">
                        <span>
                            Комментарий к решению
                            {declineReasonRequired ? '' : ' (необязательно)'}
                        </span>
                        <textarea
                            className="vac-req-modal__reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder={
                                decision === 'approve'
                                    ? 'Можно оставить пустым.'
                                    : 'Например: пересечение с критическим дедлайном.'
                            }
                            disabled={submitting}
                        />
                    </label>

                    {error && (
                        <p className="vac-req-modal__error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="vac-imp-modal__actions">
                        <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className={`vac-req-modal__submit vac-dec-modal__submit vac-dec-modal__submit--${decision}`}
                            disabled={submitting}
                        >
                            {submitting ? 'Сохранение…' : SUBMIT_LABELS[decision]}
                        </button>
                    </div>
                </div>
            </form>
        </div>,
        document.body,
    );
}
