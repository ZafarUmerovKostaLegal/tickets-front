import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getVacationScheduleEmployee, listVacationScheduleEmployees, } from '@entities/vacation';
import { apiAbsenceKindToUi, VACATION_ABSENCE_LEGEND, VACATION_KIND_COLORS, VACATION_KIND_SEALS, VACATION_MONTH_NAMES, vacationDayIsWeekendRu, vacationKindHumanLabel, vacationKindSealUsesDarkInk, } from '../lib/vacationScheduleModel';
import { formatRuDate, formatRuRange, leaveKindLabel, leaveStatusLabel, leaveStatusTone, ruDaysWord } from '../lib/leaveRequestDisplay';
import { leaveApprovalWaitingFor } from '../lib/leaveApprovalStage';
import './VacationLeaveYearCalendarModal.css';
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const LEAVE_KIND_TO_UI = {
    annual_vacation: 'annual',
    sick_leave: 'sick',
    day_off: 'dayoff',
    remote_work: 'remote',
};
function yearFromIso(iso) {
    const y = Number(iso.slice(0, 4));
    return Number.isFinite(y) ? y : new Date().getFullYear();
}
function isoDay(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function todayIso() {
    const d = new Date();
    return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}
function firstWeekdayMon0(year, monthIndex) {
    return (new Date(year, monthIndex, 1).getDay() + 6) % 7;
}
function inInclusiveRange(iso, from, to) {
    const d = iso.slice(0, 10);
    return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}
function addDaysIso(iso, delta) {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    d.setDate(d.getDate() + delta);
    return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}
function buildMonthCells(year, monthIndex) {
    const total = daysInMonth(year, monthIndex);
    const offset = firstWeekdayMon0(year, monthIndex);
    const cells = [];
    for (let i = 0; i < offset; i += 1)
        cells.push({ day: null, iso: null });
    for (let d = 1; d <= total; d += 1)
        cells.push({ day: d, iso: isoDay(year, monthIndex, d) });
    while (cells.length < 42)
        cells.push({ day: null, iso: null });
    return cells;
}
function collectRuns(marks) {
    const dates = Object.keys(marks).sort();
    if (dates.length === 0)
        return [];
    const runs = [];
    let start = dates[0];
    let prev = dates[0];
    let kind = marks[dates[0]].kind;
    let inRequest = marks[dates[0]].inRequest;
    let days = 1;
    const flush = () => {
        runs.push({ from: start, to: prev, kind, days, inRequest });
    };
    for (let i = 1; i < dates.length; i += 1) {
        const iso = dates[i];
        const mark = marks[iso];
        const contiguous = addDaysIso(prev, 1) === iso && mark.kind === kind && mark.inRequest === inRequest;
        if (contiguous) {
            prev = iso;
            days += 1;
            continue;
        }
        flush();
        start = iso;
        prev = iso;
        kind = mark.kind;
        inRequest = mark.inRequest;
        days = 1;
    }
    flush();
    return runs;
}
function runEdge(iso, marks) {
    const mark = marks[iso];
    if (!mark)
        return null;
    const prev = marks[addDaysIso(iso, -1)];
    const next = marks[addDaysIso(iso, 1)];
    const samePrev = prev && prev.kind === mark.kind && prev.inRequest === mark.inRequest;
    const sameNext = next && next.kind === mark.kind && next.inRequest === mark.inRequest;
    if (!samePrev && !sameNext)
        return 'single';
    if (!samePrev && sameNext)
        return 'start';
    if (samePrev && !sameNext)
        return 'end';
    return 'mid';
}
export function VacationLeaveYearCalendarModal({ open, request, onClose, actions, closeLocked = false, onOpenPdf, onWithdraw, onCancelApproved, onDelete, onApprove, onDecline, }) {
    const requestYear = request ? yearFromIso(request.date_from) : new Date().getFullYear();
    const requestMonth = request ? Math.max(0, Number(request.date_from.slice(5, 7)) - 1) : 0;
    const [year, setYear] = useState(requestYear);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [scheduleFound, setScheduleFound] = useState(true);
    const [marksByIso, setMarksByIso] = useState({});
    const [hiddenKinds, setHiddenKinds] = useState(() => new Set());
    const [selectedIso, setSelectedIso] = useState(null);
    const [focusMonth, setFocusMonth] = useState(null);
    const monthRefs = useRef([]);
    useEffect(() => {
        if (!open || !request)
            return;
        setYear(yearFromIso(request.date_from));
        setFocusMonth(Math.max(0, Number(request.date_from.slice(5, 7)) - 1));
        setSelectedIso(request.date_from.slice(0, 10));
        setHiddenKinds(new Set());
    }, [open, request]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (closeLocked)
                    return;
                onClose();
            }
            if (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setYear((y) => y - 1);
            }
            if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setYear((y) => y + 1);
            }
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose, closeLocked]);
    useEffect(() => {
        if (!open || !request)
            return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setScheduleFound(true);
        const requestKind = LEAVE_KIND_TO_UI[request.kind] ?? 'annual';
        void (async () => {
            try {
                const employees = await listVacationScheduleEmployees(year);
                if (cancelled)
                    return;
                const row = employees.find((e) => e.auth_user_id === request.employee_user_id);
                const map = {};
                if (row) {
                    const detail = await getVacationScheduleEmployee(row.id, year);
                    if (cancelled)
                        return;
                    for (const day of detail.absence_days ?? []) {
                        const iso = day.absence_on?.slice(0, 10);
                        if (!iso || yearFromIso(iso) !== year)
                            continue;
                        const ui = apiAbsenceKindToUi(day.kind);
                        if (!ui)
                            continue;
                        map[iso] = {
                            kind: ui,
                            inRequest: inInclusiveRange(iso, request.date_from, request.date_to),
                            fromSchedule: true,
                        };
                    }
                }
                else {
                    setScheduleFound(false);
                }
                if (year === yearFromIso(request.date_from) || year === yearFromIso(request.date_to)) {
                    const cursor = new Date(Number(request.date_from.slice(0, 4)), Number(request.date_from.slice(5, 7)) - 1, Number(request.date_from.slice(8, 10)));
                    const end = new Date(Number(request.date_to.slice(0, 4)), Number(request.date_to.slice(5, 7)) - 1, Number(request.date_to.slice(8, 10)));
                    while (cursor <= end) {
                        if (cursor.getFullYear() === year) {
                            const iso = isoDay(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
                            const existing = map[iso];
                            map[iso] = {
                                kind: existing?.kind ?? requestKind,
                                inRequest: true,
                                fromSchedule: existing?.fromSchedule ?? false,
                            };
                        }
                        cursor.setDate(cursor.getDate() + 1);
                    }
                }
                if (!cancelled)
                    setMarksByIso(map);
            }
            catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить календарь');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, request, year]);
    const visibleMarks = useMemo(() => {
        const out = {};
        for (const [iso, mark] of Object.entries(marksByIso)) {
            if (hiddenKinds.has(mark.kind) && !mark.inRequest)
                continue;
            out[iso] = mark;
        }
        return out;
    }, [marksByIso, hiddenKinds]);
    const runs = useMemo(() => collectRuns(visibleMarks), [visibleMarks]);
    const stats = useMemo(() => {
        const byKind = {};
        const monthCounts = Array.from({ length: 12 }, () => 0);
        for (const [iso, mark] of Object.entries(visibleMarks)) {
            byKind[mark.kind] = (byKind[mark.kind] ?? 0) + 1;
            const mo = Number(iso.slice(5, 7)) - 1;
            if (mo >= 0 && mo < 12)
                monthCounts[mo] += 1;
        }
        return { byKind, monthCounts };
    }, [visibleMarks]);
    const usedKinds = useMemo(() => {
        const set = new Set();
        for (const m of Object.values(marksByIso))
            set.add(m.kind);
        return VACATION_ABSENCE_LEGEND.filter((x) => set.has(x.kind));
    }, [marksByIso]);
    const selectedMark = selectedIso ? visibleMarks[selectedIso] ?? marksByIso[selectedIso] : undefined;
    const selectedRun = selectedIso
        ? runs.find((r) => selectedIso >= r.from && selectedIso <= r.to)
        : undefined;
    const today = todayIso();
    const scrollToMonth = (monthIndex) => {
        setFocusMonth(monthIndex);
        monthRefs.current[monthIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const toggleKind = (kind) => {
        setHiddenKinds((prev) => {
            const next = new Set(prev);
            if (next.has(kind))
                next.delete(kind);
            else
                next.add(kind);
            return next;
        });
    };
    if (!open || !request)
        return null;
    const titleName = request.employee_full_name || request.employee_email || `Сотрудник #${request.employee_user_id}`;
    const period = formatRuRange(request.date_from, request.date_to);
    const isRequestYear = year === requestYear;
    const statusTone = leaveStatusTone(request.status);
    const statusLabel = leaveStatusLabel(request.status, request);
    const waitingFor = leaveApprovalWaitingFor(request);
    const showActions = Boolean(onOpenPdf
        || actions?.canDecide
        || actions?.canWithdraw
        || actions?.canCancelApproved
        || actions?.canDelete);
    return createPortal(_jsx("div", { className: "vac-yr-cal-ov", role: "presentation", onClick: closeLocked ? undefined : onClose, children: _jsxs("div", { className: "vac-yr-cal vac-yr-cal--advanced", role: "dialog", "aria-modal": "true", "aria-labelledby": "vac-yr-cal-title", onClick: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "vac-yr-cal__head", children: [_jsxs("div", { className: "vac-yr-cal__head-copy", children: [_jsxs("div", { className: "vac-yr-cal__title-row", children: [_jsx("h2", { id: "vac-yr-cal-title", className: "vac-yr-cal__title", children: titleName }), request.employee_position ? (_jsx("span", { className: "vac-yr-cal__badge", children: request.employee_position })) : null, _jsx("span", { className: `vac-yr-cal__req-status vac-yr-cal__req-status--${statusTone}`, children: statusLabel })] }), _jsxs("p", { className: "vac-yr-cal__request", children: ["\u0417\u0430\u044F\u0432\u043A\u0430 #", request.id, ": ", leaveKindLabel(request.kind), " \u00B7 ", period, _jsxs("span", { className: "vac-yr-cal__days-pill", children: [request.days_count, " ", ruDaysWord(request.days_count)] })] }), waitingFor ? (_jsxs("p", { className: "vac-yr-cal__waiting", children: ["\u0416\u0434\u0451\u0442 \u0440\u0435\u0448\u0435\u043D\u0438\u044F: ", waitingFor] })) : null] }), _jsxs("div", { className: "vac-yr-cal__year-nav", role: "group", "aria-label": "\u0413\u043E\u0434 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044F", children: [_jsx("button", { type: "button", className: "vac-yr-cal__year-btn", onClick: () => setYear((y) => y - 1), "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u0433\u043E\u0434", children: "\u2039" }), _jsx("strong", { className: "vac-yr-cal__year", children: year }), _jsx("button", { type: "button", className: "vac-yr-cal__year-btn", onClick: () => setYear((y) => y + 1), "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0433\u043E\u0434", children: "\u203A" }), !isRequestYear && (_jsx("button", { type: "button", className: "vac-yr-cal__year-reset", onClick: () => setYear(requestYear), children: "\u041A \u0437\u0430\u044F\u0432\u043A\u0435" }))] }), _jsx("button", { type: "button", className: "vac-yr-cal__x", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-yr-cal__layout", children: [_jsxs("div", { className: "vac-yr-cal__main", children: [loading && _jsx("p", { className: "vac-yr-cal__status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044F\u2026" }), error && _jsx("p", { className: "vac-yr-cal__err", role: "alert", children: error }), !loading && !error && !scheduleFound && (_jsxs("p", { className: "vac-yr-cal__hint", children: ["\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u0435\u0449\u0451 \u043D\u0435 \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u043D\u0430 ", year, ". \u041F\u043E\u043A\u0430\u0437\u0430\u043D \u043F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u044F\u0432\u043A\u0438; \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u043F\u0430\u0434\u0430\u043D\u0438\u044F \u0432 \u0433\u0440\u0430\u0444\u0438\u043A."] })), !loading && !error && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "vac-yr-cal__legend", "aria-label": "\u041B\u0435\u0433\u0435\u043D\u0434\u0430 \u0438 \u0444\u0438\u043B\u044C\u0442\u0440", children: [_jsxs("span", { className: "vac-yr-cal__legend-item vac-yr-cal__legend-item--request", children: [_jsx("i", {}), "\u041F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u044F\u0432\u043A\u0438"] }), usedKinds.map((k) => {
                                                    const hidden = hiddenKinds.has(k.kind);
                                                    return (_jsxs("button", { type: "button", className: `vac-yr-cal__legend-item vac-yr-cal__legend-btn${hidden ? ' vac-yr-cal__legend-item--off' : ''}`, onClick: () => toggleKind(k.kind), "aria-pressed": !hidden, title: hidden ? 'Показать' : 'Скрыть', children: [_jsx("i", { style: { background: k.color }, children: VACATION_KIND_SEALS[k.kind] }), k.label, _jsx("b", { children: stats.byKind[k.kind] ?? 0 })] }, k.kind));
                                                })] }), _jsx("div", { className: "vac-yr-cal__months", children: Array.from({ length: 12 }, (_, monthIndex) => {
                                                const cells = buildMonthCells(year, monthIndex);
                                                const monthCount = stats.monthCounts[monthIndex];
                                                const isFocus = focusMonth === monthIndex;
                                                const hasRequest = isRequestYear && monthIndex === requestMonth;
                                                return (_jsxs("section", { ref: (el) => {
                                                        monthRefs.current[monthIndex] = el;
                                                    }, className: [
                                                        'vac-yr-cal__month',
                                                        isFocus ? ' vac-yr-cal__month--focus' : '',
                                                        hasRequest ? ' vac-yr-cal__month--request' : '',
                                                    ].join(''), children: [_jsxs("div", { className: "vac-yr-cal__month-head", children: [_jsx("h3", { className: "vac-yr-cal__month-title", children: VACATION_MONTH_NAMES[monthIndex] }), _jsx("span", { className: `vac-yr-cal__month-count${monthCount > 0 ? '' : ' vac-yr-cal__month-count--empty'}`, children: monthCount > 0 ? monthCount : '' })] }), _jsx("div", { className: "vac-yr-cal__weekdays", children: WEEKDAYS.map((w) => (_jsx("span", { children: w }, w))) }), _jsx("div", { className: "vac-yr-cal__grid", children: cells.map((cell, idx) => {
                                                                if (cell.day == null || cell.iso == null) {
                                                                    return _jsx("span", { className: "vac-yr-cal__cell vac-yr-cal__cell--empty" }, `e-${idx}`);
                                                                }
                                                                const mark = visibleMarks[cell.iso];
                                                                const weekend = vacationDayIsWeekendRu(year, monthIndex, cell.day);
                                                                const edge = mark ? runEdge(cell.iso, visibleMarks) : null;
                                                                const isToday = cell.iso === today;
                                                                const selected = cell.iso === selectedIso;
                                                                const classes = [
                                                                    'vac-yr-cal__cell',
                                                                    weekend ? ' vac-yr-cal__cell--weekend' : '',
                                                                    mark ? ' vac-yr-cal__cell--mark' : '',
                                                                    mark?.inRequest ? ' vac-yr-cal__cell--request' : '',
                                                                    edge ? ` vac-yr-cal__cell--${edge}` : '',
                                                                    isToday ? ' vac-yr-cal__cell--today' : '',
                                                                    selected ? ' vac-yr-cal__cell--selected' : '',
                                                                ].join('');
                                                                return (_jsx("button", { type: "button", className: classes, onClick: () => {
                                                                        setSelectedIso(cell.iso);
                                                                        setFocusMonth(monthIndex);
                                                                    }, style: mark ? {
                                                                        background: VACATION_KIND_COLORS[mark.kind],
                                                                        color: vacationKindSealUsesDarkInk(mark.kind) ? '#1e293b' : '#fff',
                                                                    } : undefined, title: mark
                                                                        ? `${formatRuDate(cell.iso)} · ${vacationKindHumanLabel(mark.kind)}${mark.inRequest ? ' · заявка' : ''}`
                                                                        : formatRuDate(cell.iso), children: cell.day }, cell.iso));
                                                            }) })] }, monthIndex));
                                            }) })] }))] }), _jsxs("aside", { className: "vac-yr-cal__side", "aria-label": "\u0414\u0435\u0442\u0430\u043B\u0438", children: [showActions && (_jsxs("section", { className: "vac-yr-cal__side-card vac-yr-cal__side-card--actions", children: [_jsx("h3", { className: "vac-yr-cal__side-title", children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043F\u043E \u0437\u0430\u044F\u0432\u043A\u0435" }), _jsxs("div", { className: "vac-yr-cal__actions", children: [onOpenPdf && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--ghost", onClick: () => onOpenPdf(request), children: "PDF" })), actions?.canWithdraw && onWithdraw && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--danger", onClick: () => onWithdraw(request), title: "\u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443, \u043F\u043E\u043A\u0430 \u043E\u043D\u0430 \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0438", children: "\u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C" })), actions?.canCancelApproved && onCancelApproved && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--danger", onClick: () => onCancelApproved(request), title: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u0434\u043D\u0438 \u0438\u0437 \u0433\u0440\u0430\u0444\u0438\u043A\u0430", children: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C" })), actions?.canDelete && onDelete && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--danger", onClick: () => onDelete(request), title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u0431\u0435\u0437\u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043D\u043E", children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })), actions?.canDecide && onDecline && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--decline", onClick: () => onDecline(request), children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" })), actions?.canDecide && onApprove && (_jsx("button", { type: "button", className: "vac-lr-card__btn vac-lr-card__btn--approve", onClick: () => onApprove(request), children: "\u0423\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C" }))] })] })), _jsxs("section", { className: "vac-yr-cal__side-card", children: [_jsx("h3", { className: "vac-yr-cal__side-title", children: "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0434\u0435\u043D\u044C" }), selectedIso ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "vac-yr-cal__side-date", children: formatRuDate(selectedIso) }), selectedMark ? (_jsxs("div", { className: "vac-yr-cal__side-mark", children: [_jsx("span", { className: "vac-yr-cal__side-seal", style: {
                                                                background: VACATION_KIND_COLORS[selectedMark.kind],
                                                                color: vacationKindSealUsesDarkInk(selectedMark.kind) ? '#1e293b' : '#fff',
                                                            }, children: VACATION_KIND_SEALS[selectedMark.kind] }), _jsxs("div", { children: [_jsx("strong", { children: vacationKindHumanLabel(selectedMark.kind) }), _jsxs("span", { children: [selectedMark.inRequest ? 'В периоде заявки' : 'Отметка в графике', !selectedMark.fromSchedule && selectedMark.inRequest ? ' · ещё не в графике' : ''] })] })] })) : (_jsx("p", { className: "vac-yr-cal__side-empty", children: "\u041E\u0442\u043C\u0435\u0442\u043E\u043A \u043D\u0435\u0442" })), selectedRun && selectedRun.days > 1 ? (_jsxs("p", { className: "vac-yr-cal__side-run", children: [formatRuRange(selectedRun.from, selectedRun.to), ' · ', selectedRun.days, " ", ruDaysWord(selectedRun.days)] })) : null] })) : (_jsx("p", { className: "vac-yr-cal__side-empty", children: "\u041A\u043B\u0438\u043A\u043D\u0438\u0442\u0435 \u043F\u043E \u0434\u043D\u044E \u0432 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u0435" }))] }), _jsxs("section", { className: "vac-yr-cal__side-card", children: [_jsxs("h3", { className: "vac-yr-cal__side-title", children: ["\u041F\u0435\u0440\u0438\u043E\u0434\u044B \u0437\u0430 ", year] }), runs.length === 0 ? (_jsx("p", { className: "vac-yr-cal__side-empty", children: "\u041D\u0435\u0442 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0445 \u043F\u0435\u0440\u0438\u043E\u0434\u043E\u0432" })) : (_jsx("ul", { className: "vac-yr-cal__runs", children: runs.map((run) => (_jsx("li", { children: _jsxs("button", { type: "button", className: `vac-yr-cal__run${run.inRequest ? ' vac-yr-cal__run--req' : ''}${selectedRun?.from === run.from && selectedRun.to === run.to ? ' vac-yr-cal__run--on' : ''}`, onClick: () => {
                                                        setSelectedIso(run.from);
                                                        scrollToMonth(Number(run.from.slice(5, 7)) - 1);
                                                    }, children: [_jsx("i", { style: { background: VACATION_KIND_COLORS[run.kind] } }), _jsxs("span", { className: "vac-yr-cal__run-body", children: [_jsx("strong", { children: vacationKindHumanLabel(run.kind) }), _jsx("em", { children: formatRuRange(run.from, run.to) })] }), _jsx("b", { children: run.days })] }) }, `${run.from}-${run.to}-${run.kind}`))) }))] })] })] })] }) }), document.body);
}
