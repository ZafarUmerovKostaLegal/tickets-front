import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    cancelVacationLeaveRequest,
    deleteVacationLeaveRequest,
    withdrawVacationLeaveRequest,
    type VacationLeaveRequestApi,
} from '@entities/vacation';
import { useAppToast } from '@shared/ui';
import { formatRuRange, ruDaysWord } from '../lib/leaveRequestDisplay';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
import './VacationDecisionModal.css';
import './VacationCancelRequestModal.css';

export type VacationRequestAuthorAction = 'withdraw' | 'cancel' | 'delete';

type Props = {
    open: boolean;
    onClose: () => void;
    request: VacationLeaveRequestApi | null;
    action: VacationRequestAuthorAction;

    onUpdated: (next: VacationLeaveRequestApi) => void;

    onDeleted: (id: number) => void;
};

const TITLES: Record<VacationRequestAuthorAction, string> = {
    withdraw: 'Отозвать заявку',
    cancel: 'Отменить отсутствие',
    delete: 'Удалить заявку',
};

const SUBMIT_LABELS: Record<VacationRequestAuthorAction, string> = {
    withdraw: 'Отозвать',
    cancel: 'Отменить отсутствие',
    delete: 'Удалить',
};

const WARNINGS: Record<VacationRequestAuthorAction, string> = {
    withdraw: 'Согласующие получат уведомление, что заявка отозвана до финального решения. Подать новую заявку на этот период можно будет сразу.',
    cancel: 'Дни этого отсутствия будут удалены из графика, а партнёр получит уведомление об отмене.',
    delete: 'Заявка и её PDF будут удалены безвозвратно — восстановить историю согласования не получится.',
};

export function VacationCancelRequestModal({ open, onClose, request, action, onUpdated, onDeleted }: Props) {
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
    }, [open, request?.id, action]);

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

    return createPortal(
        <div className="vac-imp-modal vac-dec-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
            <form className="vac-imp-modal__dialog vac-dec-modal__dialog" onSubmit={handleSubmit}>
                <div className="vac-imp-modal__head">
                    <h2 id={`${uid}-title`} className="vac-imp-modal__title">
                        {TITLES[action]}
                    </h2>
                    <button type="button" className="vac-imp-modal__x" onClick={onClose} disabled={submitting} aria-label="Закрыть">
                        ×
                    </button>
                </div>
                <div className="vac-imp-modal__body vac-dec-modal__body">
                    <p className="vac-dec-modal__lead">
                        Заявка #{request.id}
                        <span className="vac-dec-modal__muted">
                            {' · '}
                            курирующий партнёр {request.partner_full_name || request.partner_email || `#${request.partner_user_id}`}
                        </span>
                    </p>
                    <p className="vac-dec-modal__meta">
                        Период: <strong>{formatRuRange(request.date_from, request.date_to)}</strong>
                        {' '}({request.days_count} {ruDaysWord(request.days_count)})
                    </p>
                    <p className="vac-cancel-modal__warn">{WARNINGS[action]}</p>

                    {action !== 'delete' && (
                        <label className="vac-dec-modal__field">
                            <span>Причина (необязательно)</span>
                            <textarea
                                className="vac-req-modal__reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                maxLength={500}
                                placeholder={action === 'withdraw'
                                    ? 'Например: перенесу отпуск на сентябрь.'
                                    : 'Например: выхожу на работу раньше.'}
                                disabled={submitting}
                            />
                        </label>
                    )}

                    {error && (
                        <p className="vac-req-modal__error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="vac-imp-modal__actions">
                        <button type="button" className="vac-imp-modal__btn-secondary" onClick={onClose} disabled={submitting}>
                            Закрыть
                        </button>
                        <button
                            type="submit"
                            className="vac-req-modal__submit vac-dec-modal__submit vac-dec-modal__submit--decline"
                            disabled={submitting}
                        >
                            {submitting ? 'Выполняем…' : SUBMIT_LABELS[action]}
                        </button>
                    </div>
                </div>
            </form>
        </div>,
        document.body,
    );
}
