import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVacationLeavePendingBadge } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import { absenceKindToUi, isVacationSystemRowId, vacationAttendanceMarksFromApi } from '../lib/vacationScheduleModel';
import { canDecideVacationLeaveRequests, canEditVacationSchedule, canViewVacationManualEntryDocs } from '../model/vacationScheduleAccess';
import { VacationAbsenceRequestModal } from './VacationAbsenceRequestModal';
import { VacationAnalyticsPanel } from './VacationAnalyticsPanel';
import { VacationCalendarFilters } from './VacationCalendarFilters';
import { VacationDayDetails } from './VacationDayDetails';
import { VacationMonthPanel } from './VacationMonthPanel';
import { VacationMonthTimeline } from './VacationMonthTimeline';
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal';
import { VacationEmployeeSidebar } from './VacationEmployeeSidebar';
import { VacationLeaveRequestsPanel } from './VacationLeaveRequestsPanel';
import { VacationPeriodDocsModal } from './VacationPeriodDocsModal';
import { VacationYearCalendar } from './VacationYearCalendar';
import { emptyVacationStaffUi, loadVacationCalendarUi, saveVacationCalendarUi, } from '../lib/vacationCalendarUiStorage';
import { absenceRunAround, employeeMatchesStatus, formatAbsenceRange, indexAbsenceDays, lateMarksFromAttendance, marksForRoster, requestsByUser, todayIsoDate, useVacationCalendarFacts, VACATION_LATE_COLOR, } from '../lib/vacationCalendarFacts';
import './VacationSchedulePage.css';
const VIEW_IDS = new Set(['calendar', 'mine', 'to_decide', 'all']);
function ruCountWord(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11)
        return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return few;
    return many;
}
function vacationAttentionText(locale, kind, count) {
    if (locale === 'en') {
        const noun = count === 1 ? 'request' : 'requests';
        return kind === 'decide'
            ? `${count} leave ${noun} awaiting your approval`
            : `${count} leave ${noun} pending partner review`;
    }
    const noun = ruCountWord(count, 'заявка', 'заявки', 'заявок');
    const verb = ruCountWord(count, 'ждёт', 'ждут', 'ждут');
    return kind === 'decide'
        ? `${count} ${noun} ${verb} согласования`
        : `${count} ${noun} на рассмотрении у партнёра`;
}
function appendLateRows(rows, people, lates, fromIso, toIso, hidden) {
    if (hidden)
        return;
    const byId = new Map(people.map((person) => [person.id, person]));
    const grouped = new Map();
    for (const late of lates) {
        if (late.iso < fromIso || late.iso > toIso || !byId.has(late.employeeId))
            continue;
        const list = grouped.get(late.employeeId) ?? [];
        list.push({ iso: late.iso, arrival: late.arrival });
        grouped.set(late.employeeId, list);
    }
    for (const [employeeId, items] of grouped) {
        const person = byId.get(employeeId);
        if (!person)
            continue;
        const first = items[0];
        const last = items[items.length - 1];
        const span = formatAbsenceRange(first.iso, last.iso);
        const word = ruCountWord(items.length, 'опоздание', 'опоздания', 'опозданий');
        const rangeLabel = items.length === 1
            ? (first.arrival ? `${span} · ${first.arrival}` : span)
            : `${items.length} ${word} · ${span}`;
        rows.push({
            employeeId: person.id,
            label: person.label,
            teamName: person.teamName,
            color: VACATION_LATE_COLOR,
            kindLabel: 'Опоздание',
            rangeLabel,
            canOpenCard: !isVacationSystemRowId(person.id),
            allowDocs: false,
        });
    }
}
function padIso(year, part) {
    return `${year}-${String(part.monthIndex + 1).padStart(2, '0')}-${String(part.day).padStart(2, '0')}`;
}
function parseView(raw) {
    if (!raw || raw === 'schedule')
        return raw ? 'calendar' : null;
    return VIEW_IDS.has(raw) ? raw : null;
}
function tabParam(view) {
    return view === 'calendar' ? 'schedule' : view;
}
const EMPTY_KINDS = new Set();
export function VacationSchedulePage() {
    const remembered = useRef(loadVacationCalendarUi()).current;
    const { t, locale } = useI18n();
    const { user, loading } = useCurrentUser();
    const [searchParams, setSearchParams] = useSearchParams();
    const canDecideRequests = useMemo(() => !loading && canDecideVacationLeaveRequests(user), [loading, user]);
    const { counts, toDecideBadge, minePendingBadge } = useVacationLeavePendingBadge(!loading);
    const [view, setView] = useState(() => parseView(searchParams.get('tab')) ?? 'calendar');
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [scheduleYear, setScheduleYear] = useState(() => remembered?.year ?? new Date().getFullYear());
    const [scheduleReload, setScheduleReload] = useState(0);
    const [selectedPeriod, setSelectedPeriod] = useState(() => remembered?.selectedPeriod ?? null);
    const [monthPanelOpen, setMonthPanelOpen] = useState(() => remembered?.monthPanelOpen ?? true);
    const [staffUi, setStaffUi] = useState(() => remembered?.staff ?? emptyVacationStaffUi());
    const [detailEmployeeId, setDetailEmployeeId] = useState(null);
    const [docsTarget, setDocsTarget] = useState(null);
    const [statusFilter, setStatusFilter] = useState(() => remembered?.status ?? 'all');
    const [hiddenKinds, setHiddenKinds] = useState(() => new Set(remembered?.hiddenKinds ?? []));
    const [viewMonth, setViewMonth] = useState(() => remembered?.viewMonth ?? null);
    const [hideLates, setHideLates] = useState(() => remembered?.hideLates ?? false);
    const pendingEmployeeIds = useRef(remembered?.selectedEmployeeIds ?? []);
    const saveReady = useRef(false);
    const restoredEmployeeIds = useRef(null);
    const storedMonthOpened = useRef(false);
    const [openToken, setOpenToken] = useState(0);
    const [directory, setDirectory] = useState([]);
    const [shownPeople, setShownPeople] = useState([]);
    const trackAttendance = !loading && canEditVacationSchedule(user);
    const facts = useVacationCalendarFacts(scheduleYear, canDecideRequests, scheduleReload, trackAttendance);
    const selectedIds = new Set(selectedEmployees.map((row) => row.id));
    useEffect(() => {
        const fromUrl = parseView(searchParams.get('tab'));
        if (fromUrl)
            setView(fromUrl);
    }, [searchParams]);
    useEffect(() => {
        if (!canDecideRequests && (view === 'to_decide' || view === 'all'))
            setView('calendar');
    }, [canDecideRequests, view]);
    useEffect(() => {
        if (loading)
            return;
        const urlTab = searchParams.get('tab');
        const next = tabParam(view);
        if (urlTab === next)
            return;
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set('tab', next);
            return params;
        }, { replace: true });
    }, [view, loading, searchParams, setSearchParams]);
    const requestsBadge = counts.toDecideCount > 0 ? toDecideBadge : minePendingBadge;
    const today = useMemo(() => new Date(), []);
    const todayIso = todayIsoDate(today);
    const requestMap = useMemo(() => requestsByUser(facts.requests), [facts.requests]);
    const marks = useMemo(() => marksForRoster(scheduleYear, facts.days.filter((day) => day != null), directory), [directory, facts.days, scheduleYear]);
    const daysByEmployee = useMemo(() => indexAbsenceDays(scheduleYear, marks), [marks, scheduleYear]);
    const allowedIds = useMemo(() => {
        if (statusFilter === 'all')
            return null;
        const ids = new Set();
        for (const person of directory) {
            if (employeeMatchesStatus(person, statusFilter, scheduleYear, todayIso, daysByEmployee, requestMap, EMPTY_KINDS))
                ids.add(person.id);
        }
        return ids;
    }, [daysByEmployee, directory, requestMap, scheduleYear, statusFilter, todayIso]);
    const lateMarks = useMemo(() => {
        if (!trackAttendance || directory.length === 0)
            return [];
        return lateMarksFromAttendance(scheduleYear, vacationAttendanceMarksFromApi(scheduleYear, facts.attendance, directory));
    }, [directory, facts.attendance, scheduleYear, trackAttendance]);
    const focusPeople = useMemo(() => {
        const base = selectedIds.size === 0
            ? shownPeople
            : shownPeople.filter((person) => selectedIds.has(person.id));
        return base;
    }, [selectedIds, shownPeople]);
    const kindCounts = useMemo(() => {
        const countsByKind = new Map();
        for (const person of focusPeople) {
            const kinds = new Set((daysByEmployee.get(person.id) ?? []).map((day) => day.kind));
            for (const kind of kinds)
                countsByKind.set(kind, (countsByKind.get(kind) ?? 0) + 1);
        }
        return countsByKind;
    }, [daysByEmployee, focusPeople]);
    const marksByDay = useMemo(() => {
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const map = new Map();
        for (const person of focusPeople) {
            for (const day of daysByEmployee.get(person.id) ?? []) {
                if (hiddenKinds.has(day.kind))
                    continue;
                const legendItem = legendByKind.get(day.kind);
                const key = `${day.monthIndex}-${day.day}`;
                const list = map.get(key) ?? [];
                list.push({
                    employeeId: person.id,
                    label: person.label,
                    color: legendItem?.color ?? '#64748b',
                    kindLabel: legendItem?.label ?? day.kind,
                });
                map.set(key, list);
            }
        }
        if (!hideLates) {
            const visible = new Set(focusPeople.map((person) => person.id));
            for (const late of lateMarks) {
                if (!visible.has(late.employeeId))
                    continue;
                const person = focusPeople.find((item) => item.id === late.employeeId);
                if (!person)
                    continue;
                const key = `${late.monthIndex}-${late.day}`;
                const list = map.get(key) ?? [];
                list.push({
                    employeeId: person.id,
                    label: person.label,
                    color: VACATION_LATE_COLOR,
                    kindLabel: late.arrival ? `Опоздание ${late.arrival}` : 'Опоздание',
                });
                map.set(key, list);
            }
        }
        return map;
    }, [daysByEmployee, facts.legend, focusPeople, hiddenKinds, hideLates, lateMarks]);
    const occupancy = useMemo(() => {
        const map = new Map();
        for (const [key, marks] of marksByDay) {
            const people = new Set(marks.filter((mark) => !mark.kindLabel.startsWith('Опоздание')).map((mark) => mark.employeeId));
            if (people.size > 0)
                map.set(key, people.size);
        }
        return map;
    }, [marksByDay]);
    const [sideMonth, setSideMonth] = useState(() => new Date().getMonth());
    const detailMonth = viewMonth ?? sideMonth;
    const monthRows = useMemo(() => {
        const fromIso = padIso(scheduleYear, { monthIndex: detailMonth, day: 1 });
        const toIso = padIso(scheduleYear, { monthIndex: detailMonth, day: 31 });
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const rows = [];
        for (const person of focusPeople) {
            const days = daysByEmployee.get(person.id) ?? [];
            const inside = days.filter((day) => day.iso >= fromIso && day.iso <= toIso && !hiddenKinds.has(day.kind));
            const kinds = [...new Set(inside.map((day) => day.kind))];
            for (const kind of kinds) {
                const sample = inside.find((day) => day.kind === kind);
                if (!sample)
                    continue;
                const run = absenceRunAround(days, sample.iso, kind);
                if (!run)
                    continue;
                const legendItem = legendByKind.get(kind);
                rows.push({
                    employeeId: person.id,
                    label: person.label,
                    teamName: person.teamName,
                    color: legendItem?.color ?? '#64748b',
                    kindLabel: legendItem?.label ?? kind,
                    rangeLabel: formatAbsenceRange(run.from, run.to),
                    canOpenCard: !isVacationSystemRowId(person.id),
                });
            }
        }
        appendLateRows(rows, focusPeople, lateMarks, fromIso, toIso, hideLates);
        rows.sort((a, b) => a.rangeLabel.localeCompare(b.rangeLabel, 'ru') || a.label.localeCompare(b.label, 'ru'));
        return rows;
    }, [daysByEmployee, detailMonth, facts.legend, focusPeople, hiddenKinds, hideLates, lateMarks, scheduleYear]);
    const timeline = useMemo(() => {
        const month = viewMonth ?? -1;
        const days = month < 0 ? 0 : new Date(scheduleYear, month + 1, 0).getDate();
        const bars = [];
        const outCounts = Array.from({ length: days + 1 }, () => 0);
        if (month < 0)
            return { bars, outCounts, days, todayDay: null, people: directory };
        const visible = directory
            .slice()
            .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ru') || a.label.localeCompare(b.label, 'ru'));
        const monthStart = padIso(scheduleYear, { monthIndex: month, day: 1 });
        const monthEnd = padIso(scheduleYear, { monthIndex: month, day: days });
        const showMarks = statusFilter === 'all' || statusFilter === 'away';
        const showPending = statusFilter === 'all' || statusFilter === 'planned';
        const labelOf = (kind) => ({
            annual: 'Отпуск',
            dayoff: 'Без оплаты',
            remote: 'Удалёнка',
            sick: 'Больничный',
            business: 'Командировка',
            red_pass: 'Пропуск',
        }[kind]);
        if (showMarks) {
            for (const person of visible) {
                const inMonth = (daysByEmployee.get(person.id) ?? [])
                    .filter((day) => day.monthIndex === month && !hiddenKinds.has(day.kind))
                    .slice()
                    .sort((a, b) => a.day - b.day);
                let run = inMonth.slice(0, 0);
                const flush = () => {
                    const first = run[0];
                    const last = run[run.length - 1];
                    if (!first || !last)
                        return;
                    bars.push({
                        employeeId: person.id,
                        label: labelOf(first.kind),
                        color: facts.legend.find((item) => item.kind === first.kind)?.color ?? '#9C27FF',
                        startDay: first.day,
                        endDay: last.day,
                        pending: false,
                        remote: first.kind === 'remote',
                        unpaid: first.kind === 'dayoff',
                    });
                    run = [];
                };
                for (const day of inMonth) {
                    const prev = run[run.length - 1];
                    if (prev && (prev.kind !== day.kind || day.day !== prev.day + 1))
                        flush();
                    run.push(day);
                }
                flush();
            }
        }
        const byUser = new Map(visible.filter((person) => person.systemUserId != null).map((person) => [person.systemUserId, person]));
        for (const request of facts.requests) {
            const pending = request.status === 'pending' || request.status === 'pending_final';
            const declined = request.status === 'declined';
            if (pending && !showPending)
                continue;
            if (declined && statusFilter !== 'declined')
                continue;
            if (!pending && !declined)
                continue;
            if (request.date_to < monthStart || request.date_from > monthEnd)
                continue;
            const person = byUser.get(request.employee_user_id);
            const kind = absenceKindToUi(request.kind, request.kind_code);
            if (!person || !kind || hiddenKinds.has(kind))
                continue;
            const startDay = request.date_from < monthStart ? 1 : Number(request.date_from.slice(8, 10));
            const endDay = request.date_to > monthEnd ? days : Number(request.date_to.slice(8, 10));
            bars.push({
                employeeId: person.id,
                label: labelOf(kind),
                color: facts.legend.find((item) => item.kind === kind)?.color ?? '#9C27FF',
                startDay,
                endDay,
                pending: pending || declined,
                remote: kind === 'remote',
                unpaid: kind === 'dayoff',
            });
        }
        for (const bar of bars) {
            if (bar.pending || bar.remote)
                continue;
            for (let day = bar.startDay; day <= bar.endDay; day += 1)
                outCounts[day] = (outCounts[day] ?? 0) + 1;
        }
        const todayDay = scheduleYear === today.getFullYear() && month === today.getMonth() ? today.getDate() : null;
        return { bars, outCounts, days, todayDay, people: visible };
    }, [daysByEmployee, directory, facts.legend, facts.requests, hiddenKinds, scheduleYear, statusFilter, today, viewMonth]);
    const rememberDirectory = useCallback((rows) => {
        setDirectory(rows);
    }, []);
    const rememberShown = useCallback((rows) => {
        setShownPeople(rows);
    }, []);
    const rememberStaffUi = useCallback((ui) => {
        setStaffUi(ui);
    }, []);
    useEffect(() => {
        if (storedMonthOpened.current)
            return;
        storedMonthOpened.current = true;
        if (viewMonth != null)
            setOpenToken((value) => value + 1);
    }, [viewMonth]);
    useEffect(() => {
        if (pendingEmployeeIds.current.length === 0) {
            saveReady.current = true;
            return;
        }
        if (directory.length === 0)
            return;
        const wanted = [...pendingEmployeeIds.current];
        pendingEmployeeIds.current = [];
        const rows = directory.filter((person) => wanted.includes(person.id));
        restoredEmployeeIds.current = rows.length > 0 ? rows.map((person) => person.id) : wanted;
        saveReady.current = true;
        if (rows.length > 0)
            setSelectedEmployees(rows);
    }, [directory]);
    useEffect(() => {
        if (!saveReady.current)
            return;
        const selectedEmployeeIds = restoredEmployeeIds.current ?? selectedEmployees.map((person) => person.id);
        restoredEmployeeIds.current = null;
        saveVacationCalendarUi({
            year: scheduleYear,
            viewMonth,
            monthPanelOpen,
            status: statusFilter,
            hiddenKinds: [...hiddenKinds],
            selectedEmployeeIds,
            selectedPeriod,
            staff: staffUi,
            hideLates,
        });
    }, [hiddenKinds, hideLates, monthPanelOpen, scheduleYear, selectedEmployees, selectedPeriod, staffUi, statusFilter, viewMonth]);
    const canEditSchedule = !loading && canEditVacationSchedule(user);
    const canViewDocs = !loading && canViewVacationManualEntryDocs(user);
    const dayRows = useMemo(() => {
        if (!selectedPeriod)
            return [];
        const startIso = padIso(scheduleYear, selectedPeriod.start);
        const endIso = padIso(scheduleYear, selectedPeriod.end);
        const fromIso = startIso <= endIso ? startIso : endIso;
        const toIso = startIso <= endIso ? endIso : startIso;
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const rows = [];
        for (const person of focusPeople) {
            const days = daysByEmployee.get(person.id) ?? [];
            const inside = days.filter((day) => day.iso >= fromIso && day.iso <= toIso && !hiddenKinds.has(day.kind));
            const kinds = [...new Set(inside.map((day) => day.kind))];
            for (const kind of kinds) {
                const sample = inside.find((day) => day.kind === kind);
                if (!sample)
                    continue;
                const run = absenceRunAround(days, sample.iso, kind);
                if (!run)
                    continue;
                const legendItem = legendByKind.get(kind);
                rows.push({
                    employeeId: person.id,
                    label: person.label,
                    teamName: person.teamName,
                    color: legendItem?.color ?? '#64748b',
                    kindLabel: legendItem?.label ?? kind,
                    rangeLabel: formatAbsenceRange(run.from, run.to),
                    canOpenCard: !isVacationSystemRowId(person.id),
                });
            }
        }
        appendLateRows(rows, focusPeople, lateMarks, fromIso, toIso, hideLates);
        rows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        return rows;
    }, [daysByEmployee, facts.legend, focusPeople, hiddenKinds, hideLates, lateMarks, scheduleYear, selectedPeriod]);
    const openCalendarMonth = (month) => {
        setViewMonth(month);
        setOpenToken((value) => value + 1);
    };
    const stepSideMonth = (delta) => {
        const next = sideMonth + delta;
        if (next < 0) {
            if (scheduleYear <= 2000)
                return;
            setScheduleYear(scheduleYear - 1);
            setSideMonth(11);
            return;
        }
        if (next > 11) {
            if (scheduleYear >= 2100)
                return;
            setScheduleYear(scheduleYear + 1);
            setSideMonth(0);
            return;
        }
        setSideMonth(next);
    };
    const stepCalendarMonth = (delta) => {
        const current = viewMonth ?? today.getMonth();
        let month = current + delta;
        let year = scheduleYear;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
        else if (month > 11) {
            month = 0;
            year += 1;
        }
        year = Math.min(2100, Math.max(2000, year));
        setScheduleYear(year);
        setViewMonth(month);
    };
    const section = view === 'calendar' ? 'calendar' : view === 'analytics' ? 'analytics' : 'requests';
    const switchRef = useRef(null);
    const [switchThumb, setSwitchThumb] = useState({ x: 0, y: 0, w: 0, h: 0 });
    useLayoutEffect(() => {
        const nav = switchRef.current;
        const active = nav?.querySelector('.vac-switch__item--on');
        if (!nav || !active)
            return;
        setSwitchThumb({
            x: active.offsetLeft,
            y: active.offsetTop,
            w: active.offsetWidth,
            h: active.offsetHeight,
        });
    }, [section, requestsBadge]);
    const showToDecideAttention = view === 'calendar' && canDecideRequests && counts.toDecideCount > 0;
    const showMinePendingAttention = view === 'calendar' && counts.minePendingCount > 0;
    const openRequests = () => {
        if (canDecideRequests && counts.toDecideCount > 0)
            setView('to_decide');
        else
            setView('mine');
    };
    return (_jsxs("div", { className: "vacation-schedule-page", children: [_jsxs("main", { className: "vacation-schedule-page__main", children: [_jsxs("header", { className: "vacation-schedule-page__header", children: [_jsxs("div", { className: "vacation-schedule-page__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("h1", { className: "vacation-schedule-page__title", children: "\u0413\u0440\u0430\u0444\u0438\u043A \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432" })] }), _jsxs("div", { className: "app-page-header-end", children: [_jsxs("nav", { className: "vac-switch", ref: switchRef, "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0433\u0440\u0430\u0444\u0438\u043A\u0430 \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432", children: [_jsx("span", { className: "vac-switch__thumb", "aria-hidden": true, style: {
                                                    width: switchThumb.w,
                                                    height: switchThumb.h,
                                                    transform: `translate(${switchThumb.x}px, ${switchThumb.y}px)`,
                                                } }), _jsx("button", { type: "button", className: `vac-switch__item${section === 'calendar' ? ' vac-switch__item--on' : ''}`, "aria-current": section === 'calendar' ? 'page' : undefined, onClick: () => setView('calendar'), children: "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C" }), _jsx("button", { type: "button", className: `vac-switch__item${section === 'analytics' ? ' vac-switch__item--on' : ''}`, "aria-current": section === 'analytics' ? 'page' : undefined, onClick: () => setView('analytics'), children: "\u0410\u043D\u0430\u043B\u0438\u0437" }), _jsxs("button", { type: "button", className: `vac-switch__item${section === 'requests' ? ' vac-switch__item--on' : ''}`, "aria-current": section === 'requests' ? 'page' : undefined, onClick: openRequests, children: ["\u0417\u0430\u044F\u0432\u043A\u0438", requestsBadge ? _jsx("span", { className: "vac-switch__badge", "aria-hidden": true, children: requestsBadge }) : null] })] }), _jsx("button", { type: "button", className: "vac-page-add-btn", onClick: () => setRequestModalOpen(true), "aria-label": "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435", title: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430", children: "+" })] })] }), showToDecideAttention ? (_jsxs("div", { className: "vac-attention", role: "status", children: [_jsx("span", { className: "vac-attention__dot", "aria-hidden": true }), _jsx("p", { className: "vac-attention__text", children: vacationAttentionText(locale, 'decide', counts.toDecideCount) }), _jsx("button", { type: "button", className: "vac-attention__action", onClick: () => setView('to_decide'), children: t('vacationSchedule.attention.goToDecide') })] })) : showMinePendingAttention ? (_jsxs("div", { className: "vac-attention vac-attention--info", role: "status", children: [_jsx("span", { className: "vac-attention__dot", "aria-hidden": true }), _jsx("p", { className: "vac-attention__text", children: vacationAttentionText(locale, 'mine', counts.minePendingCount) }), _jsx("button", { type: "button", className: "vac-attention__action", onClick: () => setView('mine'), children: t('vacationSchedule.attention.goToMine') })] })) : null, _jsx("div", { className: "vacation-schedule-page__body", children: _jsx("div", { className: `vacation-schedule-page__pane is-${section}`, children: section === 'analytics' ? (_jsx(VacationAnalyticsPanel, { year: scheduleYear, onYearChange: setScheduleYear })) : section === 'requests' ? (_jsxs("div", { className: "vac-requests", children: [canDecideRequests ? (_jsx("div", { className: "vac-tabs", role: "tablist", "aria-label": "\u041A\u0430\u043A\u0438\u0435 \u0437\u0430\u044F\u0432\u043A\u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C", children: [
                                            ['mine', 'Мои'],
                                            ['to_decide', 'На согласование'],
                                            ['all', 'Все'],
                                        ].map(([id, label]) => (_jsx("button", { type: "button", role: "tab", "aria-selected": view === id, className: `vac-tabs__tab${view === id ? ' vac-tabs__tab--on' : ''}`, onClick: () => setView(id), children: _jsxs("span", { className: "vac-tabs__tab-inner", children: [label, id === 'to_decide' && toDecideBadge ? (_jsx("span", { className: "vac-tabs__tab-badge", "aria-hidden": true, children: toDecideBadge })) : null, id === 'mine' && minePendingBadge ? (_jsx("span", { className: "vac-tabs__tab-badge", "aria-hidden": true, children: minePendingBadge })) : null] }) }, id))) })) : null, _jsx(VacationLeaveRequestsPanel, { mode: view === 'to_decide' || view === 'all' ? view : 'mine', refreshToken: refreshToken, onScheduleMayHaveChanged: () => setRefreshToken((value) => value + 1) })] })) : (_jsx(_Fragment, { children: _jsxs("div", { className: `vac-board vac-board--plan${viewMonth != null ? ' vac-board--month' : ''}`, children: [_jsx(VacationEmployeeSidebar, { year: scheduleYear, selectedIds: selectedIds, allowedIds: allowedIds, onSelectEmployees: setSelectedEmployees, onToggleEmployee: (employee) => {
                                                setSelectedEmployees((prev) => (prev.some((row) => row.id === employee.id)
                                                    ? prev.filter((row) => row.id !== employee.id)
                                                    : [...prev, employee]));
                                            }, onShownEmployees: rememberShown, onDirectory: rememberDirectory, initialQuery: staffUi.query, initialTeamFilterIds: staffUi.teamFilterIds, initialHiddenOpen: staffUi.hiddenOpen, initialCollapsedTeamIds: staffUi.collapsedTeamIds, onStaffUiChange: rememberStaffUi }), _jsxs("div", { className: "vac-board__main", children: [_jsx(VacationCalendarFilters, { year: scheduleYear, onYearChange: (next) => setScheduleYear(Math.min(2100, Math.max(2000, next))), status: statusFilter, onStatusChange: setStatusFilter, monthOpen: viewMonth != null, monthIndex: viewMonth, onMonthStep: stepCalendarMonth, onShowYear: () => openCalendarMonth(null), onShowMonth: () => openCalendarMonth(scheduleYear === today.getFullYear() ? today.getMonth() : (viewMonth ?? 0)), legend: facts.legend, kindCounts: kindCounts, hiddenKinds: hiddenKinds, onToggleKind: (kind) => {
                                                        setHiddenKinds((prev) => {
                                                            const next = new Set(prev);
                                                            if (next.has(kind))
                                                                next.delete(kind);
                                                            else
                                                                next.add(kind);
                                                            return next;
                                                        });
                                                    }, lates: trackAttendance ? {
                                                        count: new Set(lateMarks.filter((late) => focusPeople.some((person) => person.id === late.employeeId)).map((late) => late.employeeId)).size,
                                                        hidden: hideLates,
                                                        onToggle: () => setHideLates((hidden) => !hidden),
                                                    } : null }), !facts.ready ? (_jsx("div", { className: "vac-cal-skel", "aria-busy": "true", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044F", children: Array.from({ length: 12 }, (_, index) => (_jsx("div", { className: "vac-cal-skel__month" }, index))) })) : viewMonth == null ? (_jsx(VacationYearCalendar, { year: scheduleYear, marksByDay: marksByDay, openToken: openToken, requestedMonth: null, onMonthChange: setViewMonth, occupancy: occupancy, focusMonth: sideMonth, onOpenMonth: (monthIndex) => openCalendarMonth(monthIndex), selectedPeriod: selectedPeriod, onSelectDay: (monthIndex, day) => {
                                                        setSelectedPeriod((prev) => {
                                                            if (!prev || prev.start.monthIndex !== prev.end.monthIndex || prev.start.day !== prev.end.day)
                                                                return { start: { monthIndex, day }, end: { monthIndex, day } };
                                                            return { start: prev.start, end: { monthIndex, day } };
                                                        });
                                                    } })) : (_jsx(VacationMonthTimeline, { year: scheduleYear, monthIndex: viewMonth ?? 0, daysInMonth: timeline.days, todayDay: timeline.todayDay, people: timeline.people, selectedIds: selectedIds, bars: timeline.bars, outCounts: timeline.outCounts, pickedStart: selectedPeriod && viewMonth != null && selectedPeriod.start.monthIndex === viewMonth ? Math.min(selectedPeriod.start.day, selectedPeriod.end.day) : null, pickedEnd: selectedPeriod && viewMonth != null && selectedPeriod.end.monthIndex === viewMonth ? Math.max(selectedPeriod.start.day, selectedPeriod.end.day) : null, onPickRange: (startDay, endDay) => {
                                                        const month = viewMonth ?? 0;
                                                        setSelectedPeriod({
                                                            start: { monthIndex: month, day: startDay },
                                                            end: { monthIndex: month, day: endDay },
                                                        });
                                                    }, onToggle: (person) => {
                                                        setSelectedEmployees((prev) => (prev.some((row) => row.id === person.id)
                                                            ? prev.filter((row) => row.id !== person.id)
                                                            : [...prev, person]));
                                                    } }))] }), viewMonth == null && !selectedPeriod ? (_jsx(VacationMonthPanel, { year: scheduleYear, monthIndex: detailMonth, open: monthPanelOpen, rows: monthRows, showDocs: canViewDocs, onToggle: () => setMonthPanelOpen((open) => !open), onStepMonth: stepSideMonth, onOpenCard: setDetailEmployeeId, onOpenDocs: (employeeId, label) => {
                                                const hit = (daysByEmployee.get(employeeId) ?? []).find((day) => day.monthIndex === detailMonth);
                                                setDocsTarget({
                                                    employeeId,
                                                    label,
                                                    dateIso: hit?.iso ?? padIso(scheduleYear, { monthIndex: detailMonth, day: 1 }),
                                                });
                                            } })) : null, selectedPeriod ? (_jsx(VacationDayDetails, { year: scheduleYear, monthIndex: selectedPeriod.start.monthIndex, day: selectedPeriod.start.day, endMonthIndex: selectedPeriod.end.monthIndex, endDay: selectedPeriod.end.day, rows: dayRows, showDocs: canViewDocs, onClose: () => setSelectedPeriod(null), onOpenCard: setDetailEmployeeId, onOpenDocs: (employeeId, label) => {
                                                const start = padIso(scheduleYear, selectedPeriod.start);
                                                const end = padIso(scheduleYear, selectedPeriod.end);
                                                setDocsTarget({ employeeId, label, dateIso: start <= end ? start : end });
                                            } })) : null] }) })) }, section) })] }), _jsx(VacationAbsenceRequestModal, { open: requestModalOpen, onClose: () => setRequestModalOpen(false), onSubmitted: () => {
                    setRefreshToken((value) => value + 1);
                    setView('mine');
                } }), detailEmployeeId != null ? (_jsx(VacationEmployeeDetailModal, { employeeId: detailEmployeeId, year: scheduleYear, canEdit: canEditSchedule, canViewDocs: canViewDocs, onClose: () => setDetailEmployeeId(null), onScheduleMutated: () => setScheduleReload((value) => value + 1) })) : null, docsTarget ? (_jsx(VacationPeriodDocsModal, { open: true, year: scheduleYear, employeeId: docsTarget.employeeId, employeeName: docsTarget.label, dateIso: docsTarget.dateIso, onClose: () => setDocsTarget(null) })) : null] }));
}
