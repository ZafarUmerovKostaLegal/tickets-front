import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    getVacationLeaveKinds,
    invalidateVacationLeaveRequests,
    listVacationLeaveRequests,
    type VacationLeaveKindApi,
    type VacationLeaveRequestApi,
    type VacationLeaveRequestStatus,
} from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import {
    canDecideLeaveRequest,
    leaveApprovalWaitingFor,
} from '../lib/leaveApprovalStage';
import {
    formatRuRange,
    formatTimestampShort,
    leaveKindLabel,
    leaveStatusLabel,
    leaveStatusTone,
    ruDaysWord,
} from '../lib/leaveRequestDisplay';
import {
    VacationCancelRequestModal,
    type VacationRequestAuthorAction,
} from './VacationCancelRequestModal';
import { VacationDecisionModal } from './VacationDecisionModal';
import { VacationLeavePdfPreview } from './VacationLeavePdfPreview';
import { VacationLeaveYearCalendarModal } from './VacationLeaveYearCalendarModal';
import './VacationLeaveRequestsPanel.css';

function employeeTitleFromReq(req: VacationLeaveRequestApi): string {
    return req.employee_full_name || req.employee_email || `Сотрудник #${req.employee_user_id}`;
}

type Mode = 'mine' | 'to_decide';

type Props = {
    mode: Mode;

    refreshToken?: number;

    onScheduleMayHaveChanged?: () => void;
};

const FILTERS: ReadonlyArray<{ value: VacationLeaveRequestStatus | 'any'; label: string }> = [
    { value: 'any', label: 'Все' },
    { value: 'pending', label: 'У курирующего' },
    { value: 'pending_final', label: 'У управляющего' },
    { value: 'approved', label: 'Утверждённые' },
    { value: 'declined', label: 'Отклонённые' },
    { value: 'cancelled', label: 'Отменённые' },
];

export function VacationLeaveRequestsPanel({ mode, refreshToken = 0, onScheduleMayHaveChanged }: Props) {
    const { user } = useCurrentUser();
    // В «на согласование» показываем обе ступени сразу: у курирующего и у управляющего
    // партнёра ждут решения заявки в разных статусах.
    const [status, setStatus] = useState<VacationLeaveRequestStatus | 'any'>('any');
    const [items, setItems] = useState<VacationLeaveRequestApi[]>([]);
    const [kinds, setKinds] = useState<VacationLeaveKindApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadTick, setReloadTick] = useState(0);
    const [decisionState, setDecisionState] = useState<{
        request: VacationLeaveRequestApi;
        decision: 'approve' | 'decline';
    } | null>(null);
    const [calendarRequest, setCalendarRequest] = useState<VacationLeaveRequestApi | null>(null);
    const [pdfRequest, setPdfRequest] = useState<VacationLeaveRequestApi | null>(null);
    const [authorAction, setAuthorAction] = useState<{
        request: VacationLeaveRequestApi;
        action: VacationRequestAuthorAction;
    } | null>(null);

    useEffect(() => {
        setStatus('any');
    }, [mode]);

    useEffect(() => {
        let cancelled = false;
        void getVacationLeaveKinds()
            .then((list) => {
                if (!cancelled && list.length > 0)
                    setKinds(list);
            })
            .catch(() => {
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void listVacationLeaveRequests({ scope: mode, status })
            .then((list) => {
                if (cancelled)
                    return;
                setItems(list);
            })
            .catch((e: unknown) => {
                if (cancelled)
                    return;
                setItems([]);
                setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки.');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [mode, status, reloadTick, refreshToken]);

    useEffect(() => {
        const onFocus = () => setReloadTick((t) => t + 1);
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                setReloadTick((t) => t + 1);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    const counts = useMemo(() => {
        const acc: Record<VacationLeaveRequestStatus, number> = {
            pending: 0,
            pending_final: 0,
            approved: 0,
            declined: 0,
            cancelled: 0,
        };
        for (const it of items)
            acc[it.status] += 1;
        return acc;
    }, [items]);

    const handleAuthorActionApplied = useCallback((next: VacationLeaveRequestApi) => {
        setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));
        invalidateVacationLeaveRequests();
        // Дни в графике есть только у одобренной заявки — отзыв pending график не меняет.
        if (authorAction?.action === 'cancel')
            onScheduleMayHaveChanged?.();
        if (status !== 'any' && status !== next.status)
            setReloadTick((t) => t + 1);
    }, [authorAction, onScheduleMayHaveChanged, status]);

    const handleRequestDeleted = useCallback((id: number) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        invalidateVacationLeaveRequests();
    }, []);

    const handleDecisionApplied = useCallback((next: VacationLeaveRequestApi) => {
        setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));
        if (next.status === 'approved')
            onScheduleMayHaveChanged?.();
        invalidateVacationLeaveRequests();
        if (status !== 'any' && next.status !== status)
            setReloadTick((t) => t + 1);
    }, [onScheduleMayHaveChanged, status]);

    const isMine = mode === 'mine';

    return (
        <div className="vac-lr-panel">
            <div className="vac-lr-panel__head">
                <h2 className="vac-lr-panel__title">{isMine ? 'Мои заявки' : 'Заявки на согласование'}</h2>
                <p className="vac-lr-panel__subtitle">
                    {isMine
                        ? 'Заявка идёт курирующему партнёру, затем на финальное подтверждение управляющему партнёру.'
                        : 'Курирующий партнёр согласовывает первым, финальное решение принимает управляющий партнёр — после него дни появляются в графике.'}
                </p>
            </div>

            <div className="vac-lr-panel__filters" role="tablist" aria-label="Фильтр по статусу">
                {FILTERS.map((f) => {
                    const active = status === f.value;
                    return (
                        <button
                            key={f.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`vac-lr-panel__chip${active ? ' vac-lr-panel__chip--on' : ''}`}
                            onClick={() => setStatus(f.value)}
                        >
                            <span>{f.label}</span>
                            {f.value !== 'any' && (
                                <span className="vac-lr-panel__chip-count" aria-hidden>{counts[f.value]}</span>
                            )}
                        </button>
                    );
                })}
                <span className="vac-lr-panel__filters-spacer" aria-hidden />
                <button
                    type="button"
                    className="vac-lr-panel__refresh"
                    onClick={() => setReloadTick((t) => t + 1)}
                    title="Обновить список"
                    aria-label="Обновить"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="23 4 23 10 17 10"/>
                        <polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
                        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
                    </svg>
                </button>
            </div>

            {error && (
                <p className="vac-lr-panel__error" role="alert">{error}</p>
            )}

            {loading ? (
                <p className="vac-lr-panel__status">Загрузка заявок…</p>
            ) : items.length === 0 ? (
                <p className="vac-lr-panel__empty">
                    {isMine
                        ? 'У вас пока нет заявок. Нажмите «+» в шапке, чтобы подать новую.'
                        : 'Заявок, которые ждут вашего решения, нет.'}
                </p>
            ) : (
                <ul className="vac-lr-panel__list">
                    {items.map((req) => {
                        const tone = leaveStatusTone(req.status);
                        const statusLabel = leaveStatusLabel(req.status);
                        const kindLabel = leaveKindLabel(req.kind, kinds);
                        const range = formatRuRange(req.date_from, req.date_to);
                        const personLabel = isMine
                            ? (req.partner_full_name || req.partner_email || `#${req.partner_user_id}`)
                            : (req.employee_full_name || req.employee_email || `#${req.employee_user_id}`);
                        const personRole = isMine ? 'Согласующий' : 'Сотрудник';
                        const personPosition = !isMine ? req.employee_position : null;
                        const canDecide = mode === 'to_decide' && canDecideLeaveRequest(req, {
                            userId: user?.id,
                            userEmail: user?.email,
                        });
                        const waitingFor = leaveApprovalWaitingFor(req);
                        const canWithdraw = isMine && (req.status === 'pending' || req.status === 'pending_final');
                        const canCancelApproved = isMine && req.status === 'approved';
                        const canDelete = isMine && (req.status === 'cancelled' || req.status === 'declined');
                        return (
                            <li key={req.id} className={`vac-lr-card vac-lr-card--${tone} vac-lr-card--clickable`}>
                                <button
                                    type="button"
                                    className="vac-lr-card__open"
                                    onClick={() => setCalendarRequest(req)}
                                    aria-label={`Календарь отметок: ${employeeTitleFromReq(req)}, заявка #${req.id}`}
                                >
                                    <div className="vac-lr-card__top">
                                        <span
                                            className={`vac-lr-card__status vac-lr-card__status--${tone}`}
                                            title={req.decision_reason ? `${statusLabel}: ${req.decision_reason}` : statusLabel}
                                        >
                                            <i className="vac-lr-card__status-dot" aria-hidden />
                                            <span className="vac-lr-card__status-text">{statusLabel}</span>
                                        </span>
                                        <span className="vac-lr-card__kind">{kindLabel}</span>
                                        <span className="vac-lr-card__id">#{req.id}</span>
                                    </div>

                                    <div className="vac-lr-card__hero">
                                        <div className="vac-lr-card__person">
                                            <span className="vac-lr-card__person-role">{personRole}</span>
                                            <strong className="vac-lr-card__person-name">{personLabel}</strong>
                                            {personPosition ? (
                                                <span className="vac-lr-card__person-pos">{personPosition}</span>
                                            ) : null}
                                        </div>
                                        <div className="vac-lr-card__period">
                                            <span className="vac-lr-card__period-dates">{range}</span>
                                            <span className="vac-lr-card__days">
                                                {req.days_count} {ruDaysWord(req.days_count)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="vac-lr-card__meta">
                                        <span>Отправлено {formatTimestampShort(req.created_at)}</span>
                                        {!isMine ? (
                                            <span>Курирующий: {req.partner_full_name || req.partner_email || `#${req.partner_user_id}`}</span>
                                        ) : null}
                                        {waitingFor ? (
                                            <span>Ждёт решения: {waitingFor}</span>
                                        ) : null}
                                        {req.decision_at ? (
                                            <span>Курирующий {formatTimestampShort(req.decision_at)}</span>
                                        ) : null}
                                        {req.final_decision_at ? (
                                            <span>Управляющий {formatTimestampShort(req.final_decision_at)}</span>
                                        ) : null}
                                        <span className="vac-lr-card__calendar-hint">Календарь года →</span>
                                    </div>

                                    {req.reason && (
                                        <p className="vac-lr-card__reason">
                                            <span className="vac-lr-card__reason-tag">Комментарий</span>
                                            {req.reason}
                                        </p>
                                    )}
                                    {req.decision_reason && req.status !== 'pending' && (
                                        <p className="vac-lr-card__reason vac-lr-card__reason--decision">
                                            <span className="vac-lr-card__reason-tag">Курирующий партнёр</span>
                                            {req.decision_reason}
                                        </p>
                                    )}
                                    {req.final_decision_reason && (
                                        <p className="vac-lr-card__reason vac-lr-card__reason--decision">
                                            <span className="vac-lr-card__reason-tag">Управляющий партнёр</span>
                                            {req.final_decision_reason}
                                        </p>
                                    )}
                                </button>

                                <div className="vac-lr-card__actions">
                                    <button
                                        type="button"
                                        className="vac-lr-card__btn vac-lr-card__btn--ghost"
                                        onClick={() => setPdfRequest(req)}
                                    >
                                        PDF
                                    </button>
                                    {canWithdraw && (
                                        <button
                                            type="button"
                                            className="vac-lr-card__btn vac-lr-card__btn--danger"
                                            onClick={() => setAuthorAction({ request: req, action: 'withdraw' })}
                                            title="Отозвать заявку, пока она на согласовании"
                                        >
                                            Отозвать
                                        </button>
                                    )}
                                    {canCancelApproved && (
                                        <button
                                            type="button"
                                            className="vac-lr-card__btn vac-lr-card__btn--danger"
                                            onClick={() => setAuthorAction({ request: req, action: 'cancel' })}
                                            title="Отменить согласованное отсутствие и убрать дни из графика"
                                        >
                                            Отменить
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            className="vac-lr-card__btn vac-lr-card__btn--danger"
                                            onClick={() => setAuthorAction({ request: req, action: 'delete' })}
                                            title="Удалить заявку из истории"
                                        >
                                            Удалить
                                        </button>
                                    )}
                                    {canDecide && (
                                        <>
                                            <button
                                                type="button"
                                                className="vac-lr-card__btn vac-lr-card__btn--decline"
                                                onClick={() => setDecisionState({ request: req, decision: 'decline' })}
                                            >
                                                Отклонить
                                            </button>
                                            <button
                                                type="button"
                                                className="vac-lr-card__btn vac-lr-card__btn--approve"
                                                onClick={() => setDecisionState({ request: req, decision: 'approve' })}
                                            >
                                                Утвердить
                                            </button>
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <VacationDecisionModal
                open={decisionState != null}
                onClose={() => setDecisionState(null)}
                request={decisionState?.request ?? null}
                decision={decisionState?.decision ?? 'approve'}
                onDecided={handleDecisionApplied}
            />
            <VacationCancelRequestModal
                open={authorAction != null}
                onClose={() => setAuthorAction(null)}
                request={authorAction?.request ?? null}
                action={authorAction?.action ?? 'withdraw'}
                onUpdated={handleAuthorActionApplied}
                onDeleted={handleRequestDeleted}
            />
            <VacationLeaveYearCalendarModal
                open={calendarRequest != null}
                request={calendarRequest}
                onClose={() => setCalendarRequest(null)}
            />
            {pdfRequest ? (
                <VacationLeavePdfPreview
                    request={pdfRequest}
                    onClose={() => setPdfRequest(null)}
                />
            ) : null}
        </div>
    );
}
