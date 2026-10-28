import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getVacationLeaveKinds, invalidateVacationLeaveRequests, listVacationLeaveRequests, } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { leaveApprovalWaitingFor, leaveRequestAvailableActions, leaveRequestMatchesInboxFilter, } from '../lib/leaveApprovalStage';
import { canDecideVacationLeaveRequests } from '../model/vacationScheduleAccess';
import { formatRuRange, formatTimestampShort, leaveKindLabel, leaveStatusLabel, leaveStatusTone, ruDaysWord, } from '../lib/leaveRequestDisplay';
import { VacationCancelRequestModal, } from './VacationCancelRequestModal';
import { VacationDecisionModal } from './VacationDecisionModal';
import { VacationLeavePdfPreview } from './VacationLeavePdfPreview';
import { VacationLeaveYearCalendarModal } from './VacationLeaveYearCalendarModal';
import './VacationLeaveRequestsPanel.css';
function employeeTitleFromReq(req) {
    return req.employee_full_name || req.employee_email || `Сотрудник #${req.employee_user_id}`;
}
const FILTERS = [
    { value: 'pending', label: 'У курирующего' },
    { value: 'pending_final', label: 'У управляющего' },
    { value: 'approved', label: 'Утверждённые' },
    { value: 'declined', label: 'Отклонённые' },
    { value: 'cancelled', label: 'Отменённые' },
];
export function VacationLeaveRequestsPanel({ mode, refreshToken = 0, onScheduleMayHaveChanged }) {
    const { user } = useCurrentUser();
    // В «на согласование» показываем обе ступени сразу: у курирующего и у управляющего
    // партнёра ждут решения заявки в разных статусах.
    const [status, setStatus] = useState('any');
    const [items, setItems] = useState([]);
    const [kinds, setKinds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadTick, setReloadTick] = useState(0);
    const [decisionState, setDecisionState] = useState(null);
    const [calendarRequest, setCalendarRequest] = useState(null);
    const [pdfRequest, setPdfRequest] = useState(null);
    const [authorAction, setAuthorAction] = useState(null);
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
        void listVacationLeaveRequests({ scope: mode, status: 'any' })
            .then((list) => {
            if (cancelled)
                return;
            setItems(list);
        })
            .catch((e) => {
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
    }, [mode, reloadTick, refreshToken]);
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
        const acc = {
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
    const visibleItems = useMemo(() => items.filter((it) => leaveRequestMatchesInboxFilter(it, status, mode)), [items, mode, status]);
    const handleAuthorActionApplied = useCallback((next) => {
        setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));
        setCalendarRequest((prev) => (prev?.id === next.id ? next : prev));
        invalidateVacationLeaveRequests();
        // Дни в графике есть только у одобренной заявки — отзыв pending график не меняет.
        if (authorAction?.action === 'cancel')
            onScheduleMayHaveChanged?.();
    }, [authorAction, onScheduleMayHaveChanged]);
    const handleRequestDeleted = useCallback((id) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        setCalendarRequest((prev) => (prev?.id === id ? null : prev));
        invalidateVacationLeaveRequests();
        onScheduleMayHaveChanged?.();
    }, [onScheduleMayHaveChanged]);
    const handleDecisionApplied = useCallback((next) => {
        setItems((prev) => prev.map((it) => (it.id === next.id ? next : it)));
        setCalendarRequest((prev) => (prev?.id === next.id ? next : prev));
        if (next.status === 'approved')
            onScheduleMayHaveChanged?.();
        invalidateVacationLeaveRequests();
    }, [onScheduleMayHaveChanged]);
    const isMine = mode === 'mine';
    const isAll = mode === 'all';
    const isPartner = canDecideVacationLeaveRequests(user);
    const canActAsDecider = mode === 'to_decide' || mode === 'all';
    const calendarActions = useMemo(() => {
        if (!calendarRequest)
            return undefined;
        return leaveRequestAvailableActions(calendarRequest, {
            userId: user?.id,
            userEmail: user?.email,
            isAuthor: calendarRequest.employee_user_id === user?.id,
            canActAsDecider,
            isPartner,
        });
    }, [calendarRequest, canActAsDecider, isPartner, user?.email, user?.id]);
    return (_jsxs("div", { className: "vac-lr-panel", children: [_jsxs("div", { className: "vac-lr-panel__head", children: [_jsx("h2", { className: "vac-lr-panel__title", children: isMine ? 'Мои заявки' : isAll ? 'Все заявки' : 'Заявки на согласование' }), _jsx("p", { className: "vac-lr-panel__subtitle", children: isMine
                            ? 'Заявка идёт курирующему партнёру, затем на финальное подтверждение управляющему партнёру. Если курирующим выбран управляющий партнёр — достаточно одного решения.'
                            : isAll
                                ? 'Все заявки сотрудников. Партнёр может утвердить, отклонить или удалить заявку на своей ступени.'
                                : 'Курирующий партнёр согласовывает первым, финальное решение принимает управляющий партнёр — после него дни появляются в графике. Если курирующим выбран сам управляющий партнёр, промежуточной ступени нет.' })] }), _jsxs("div", { className: "vac-lr-panel__filters", role: "tablist", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u0443", children: [FILTERS.map((f) => {
                        const active = status === f.value;
                        return (_jsxs("button", { type: "button", role: "tab", "aria-selected": active, className: `vac-lr-panel__chip${active ? ' vac-lr-panel__chip--on' : ''}`, onClick: () => setStatus((prev) => (prev === f.value ? 'any' : f.value)), children: [_jsx("span", { children: f.label }), _jsx("span", { className: "vac-lr-panel__chip-count", "aria-hidden": true, children: counts[f.value] })] }, f.value));
                    }), _jsx("span", { className: "vac-lr-panel__filters-spacer", "aria-hidden": true }), _jsx("button", { type: "button", className: "vac-lr-panel__refresh", onClick: () => setReloadTick((t) => t + 1), title: "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A", "aria-label": "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C", children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("polyline", { points: "23 4 23 10 17 10" }), _jsx("polyline", { points: "1 20 1 14 7 14" }), _jsx("path", { d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10" }), _jsx("path", { d: "M20.49 15a9 9 0 0 1-14.85 3.36L1 14" })] }) })] }), error && (_jsx("p", { className: "vac-lr-panel__error", role: "alert", children: error })), loading ? (_jsx("p", { className: "vac-lr-panel__status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0437\u0430\u044F\u0432\u043E\u043A\u2026" })) : visibleItems.length === 0 ? (_jsx("p", { className: "vac-lr-panel__empty", children: status !== 'any'
                    ? 'Нет заявок в этом статусе.'
                    : isMine
                        ? 'У вас пока нет заявок. Нажмите «+» в шапке, чтобы подать новую.'
                        : isAll
                            ? 'Заявок пока нет.'
                            : 'Заявок, которые ждут вашего решения, нет.' })) : (_jsx("ul", { className: "vac-lr-panel__list", children: visibleItems.map((req) => {
                    const tone = leaveStatusTone(req.status);
                    const statusLabel = leaveStatusLabel(req.status, req);
                    const kindLabel = leaveKindLabel(req.kind, kinds);
                    const range = formatRuRange(req.date_from, req.date_to);
                    const personLabel = isMine
                        ? (req.partner_full_name || req.partner_email || `#${req.partner_user_id}`)
                        : (req.employee_full_name || req.employee_email || `#${req.employee_user_id}`);
                    const personRole = isMine ? 'Согласующий' : 'Сотрудник';
                    const personPosition = !isMine ? req.employee_position : null;
                    const waitingFor = leaveApprovalWaitingFor(req);
                    const cardActions = leaveRequestAvailableActions(req, {
                        userId: user?.id,
                        userEmail: user?.email,
                        isAuthor: req.employee_user_id === user?.id,
                        canActAsDecider,
                        isPartner,
                    });
                    const { canDecide, canWithdraw, canCancelApproved, canDelete } = cardActions;
                    return (_jsxs("li", { className: `vac-lr-card vac-lr-card--${tone} vac-lr-card--clickable`, children: [_jsxs("button", { type: "button", className: "vac-lr-card__open", onClick: () => setCalendarRequest(req), "aria-label": `Календарь отметок: ${employeeTitleFromReq(req)}, заявка #${req.id}`, children: [_jsxs("div", { className: "vac-lr-card__top", children: [_jsxs("span", { className: `vac-lr-card__status vac-lr-card__status--${tone}`, title: req.decision_reason ? `${statusLabel}: ${req.decision_reason}` : statusLabel, children: [_jsx("i", { className: "vac-lr-card__status-dot", "aria-hidden": true }), _jsx("span", { className: "vac-lr-card__status-text", children: statusLabel })] }), _jsx("span", { className: "vac-lr-card__kind", children: kindLabel }), _jsxs("span", { className: "vac-lr-card__id", children: ["#", req.id] })] }), _jsxs("div", { className: "vac-lr-card__hero", children: [_jsxs("div", { className: "vac-lr-card__person", children: [_jsx("span", { className: "vac-lr-card__person-role", children: personRole }), _jsx("strong", { className: "vac-lr-card__person-name", children: personLabel }), personPosition ? (_jsx("span", { className: "vac-lr-card__person-pos", children: personPosition })) : null] }), _jsxs("div", { className: "vac-lr-card__period", children: [_jsx("span", { className: "vac-lr-card__period-dates", children: range }), _jsxs("span", { className: "vac-lr-card__days", children: [req.days_count, " ", ruDaysWord(req.days_count)] })] })] }), _jsxs("div", { className: "vac-lr-card__meta", children: [_jsxs("span", { children: ["\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E ", formatTimestampShort(req.created_at)] }), !isMine ? (_jsxs("span", { children: ["\u041A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0439: ", req.partner_full_name || req.partner_email || `#${req.partner_user_id}`] })) : null, waitingFor ? (_jsxs("span", { children: ["\u0416\u0434\u0451\u0442 \u0440\u0435\u0448\u0435\u043D\u0438\u044F: ", waitingFor] })) : null, req.decision_at ? (_jsxs("span", { children: ["\u041A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0439 ", formatTimestampShort(req.decision_at)] })) : null, req.final_decision_at ? (_jsxs("span", { children: ["\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0438\u0439 ", formatTimestampShort(req.final_decision_at)] })) : null, _jsx("span", { className: "vac-lr-card__calendar-hint", children: "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u0433\u043E\u0434\u0430 \u2192" })] }), req.reason && (_jsxs("p", { className: "vac-lr-card__reason", children: [_jsx("span", { className: "vac-lr-card__reason-tag", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), req.reason] })), req.decision_reason && req.status !== 'pending' && (_jsxs("p", { className: "vac-lr-card__reason vac-lr-card__reason--decision", children: [_jsx("span", { className: "vac-lr-card__reason-tag", children: "\u041A\u0443\u0440\u0438\u0440\u0443\u044E\u0449\u0438\u0439 \u043F\u0430\u0440\u0442\u043D\u0451\u0440" }), req.decision_reason] })), req.final_decision_reason && (_jsxs("p", { className: "vac-lr-card__reason vac-lr-card__reason--decision", children: [_jsx("span", { className: "vac-lr-card__reason-tag", children: "\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0449\u0438\u0439 \u043F\u0430\u0440\u0442\u043D\u0451\u0440" }), req.final_decision_reason] }))] }), _jsxs("div", { className: "vac-lr-card__actions", children: [_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--ghost", onClick: () => setPdfRequest(req), children: "PDF" }), canWithdraw && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--danger", onClick: () => setAuthorAction({ request: req, action: 'withdraw' }), title: "\u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443, \u043F\u043E\u043A\u0430 \u043E\u043D\u0430 \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0438", children: "\u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C" })), canCancelApproved && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--danger", onClick: () => setAuthorAction({ request: req, action: 'cancel' }), title: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u0434\u043D\u0438 \u0438\u0437 \u0433\u0440\u0430\u0444\u0438\u043A\u0430", children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C" })), canDelete && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--danger", onClick: () => setAuthorAction({ request: req, action: 'delete' }), title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0431\u0435\u0437\u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043D\u043E", children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })), canDecide && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--decline", onClick: () => setDecisionState({ request: req, decision: 'decline' }), children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--approve", onClick: () => setDecisionState({ request: req, decision: 'approve' }), children: "\u0423\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C" })] }))] })] }, req.id));
                }) })), _jsx(VacationLeaveYearCalendarModal, { open: calendarRequest != null, request: calendarRequest, onClose: () => setCalendarRequest(null), actions: calendarActions, closeLocked: decisionState != null || authorAction != null, onOpenPdf: (req) => setPdfRequest(req), onWithdraw: (req) => setAuthorAction({ request: req, action: 'withdraw' }), onCancelApproved: (req) => setAuthorAction({ request: req, action: 'cancel' }), onDelete: (req) => setAuthorAction({ request: req, action: 'delete' }), onApprove: (req) => setDecisionState({ request: req, decision: 'approve' }), onDecline: (req) => setDecisionState({ request: req, decision: 'decline' }) }), _jsx(VacationDecisionModal, { open: decisionState != null, onClose: () => setDecisionState(null), request: decisionState?.request ?? null, decision: decisionState?.decision ?? 'approve', onDecided: handleDecisionApplied }), _jsx(VacationCancelRequestModal, { open: authorAction != null, onClose: () => setAuthorAction(null), request: authorAction?.request ?? null, action: authorAction?.action ?? 'withdraw', onUpdated: handleAuthorActionApplied, onDeleted: handleRequestDeleted }), pdfRequest ? (_jsx(VacationLeavePdfPreview, { request: pdfRequest, onClose: () => setPdfRequest(null) })) : null] }));
}
