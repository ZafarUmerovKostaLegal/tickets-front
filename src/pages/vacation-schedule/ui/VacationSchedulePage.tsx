import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVacationLeavePendingBadge } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import { isVacationSystemRowId, type VacationAbsenceKind, type VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';
import { canDecideVacationLeaveRequests, canEditVacationSchedule, canViewVacationManualEntryDocs } from '../model/vacationScheduleAccess';
import { VacationAbsenceRequestModal } from './VacationAbsenceRequestModal';
import { VacationCalendarFilters } from './VacationCalendarFilters';
import { VacationDayDetails, type VacationDayDetailRow } from './VacationDayDetails';
import { VacationMonthPanel } from './VacationMonthPanel';
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal';
import { VacationEmployeeSidebar } from './VacationEmployeeSidebar';
import { VacationLeaveRequestsPanel } from './VacationLeaveRequestsPanel';
import { VacationPeriodDocsModal } from './VacationPeriodDocsModal';
import { VacationYearCalendar, type VacationCalendarPaint, type VacationCalendarPeriod } from './VacationYearCalendar';
import {
    emptyVacationStaffUi,
    loadVacationCalendarUi,
    saveVacationCalendarUi,
    type VacationCalendarStaffUi,
} from '../lib/vacationCalendarUiStorage';
import {
    absenceRunAround,
    employeeMatchesStatus,
    formatAbsenceRange,
    indexAbsenceDays,
    marksForRoster,
    requestsByUser,
    todayIsoDate,
    useVacationCalendarFacts,
    type VacationCalendarStatus,
    type VacationRosterPerson,
} from '../lib/vacationCalendarFacts';
import './VacationSchedulePage.css';

type View = 'calendar' | 'mine' | 'to_decide' | 'all';

const VIEW_IDS = new Set<View>(['calendar', 'mine', 'to_decide', 'all']);

function ruCountWord(count: number, one: string, few: string, many: string): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11)
        return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return few;
    return many;
}

function vacationAttentionText(locale: string, kind: 'decide' | 'mine', count: number): string {
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

function padIso(year: number, part: { monthIndex: number; day: number }): string {
    return `${year}-${String(part.monthIndex + 1).padStart(2, '0')}-${String(part.day).padStart(2, '0')}`;
}

function parseView(raw: string | null): View | null {
    if (!raw || raw === 'schedule')
        return raw ? 'calendar' : null;
    return VIEW_IDS.has(raw as View) ? raw as View : null;
}

function tabParam(view: View): string {
    return view === 'calendar' ? 'schedule' : view;
}

const EMPTY_KINDS = new Set<VacationAbsenceKind>();

export function VacationSchedulePage() {
    const remembered = useRef(loadVacationCalendarUi()).current;
    const { t, locale } = useI18n();
    const { user, loading } = useCurrentUser();
    const [searchParams, setSearchParams] = useSearchParams();
    const canDecideRequests = useMemo(
        () => !loading && canDecideVacationLeaveRequests(user),
        [loading, user],
    );
    const { counts, toDecideBadge, minePendingBadge } = useVacationLeavePendingBadge(!loading);
    const [view, setView] = useState<View>(() => parseView(searchParams.get('tab')) ?? 'calendar');
    const [selectedEmployees, setSelectedEmployees] = useState<VacationScheduleEmployeeRow[]>([]);
    const [requestModalOpen, setRequestModalOpen] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [scheduleYear, setScheduleYear] = useState(() => remembered?.year ?? new Date().getFullYear());
    const [scheduleReload, setScheduleReload] = useState(0);
    const [selectedPeriod, setSelectedPeriod] = useState<VacationCalendarPeriod | null>(() => remembered?.selectedPeriod ?? null);
    const [monthPanelOpen, setMonthPanelOpen] = useState(() => remembered?.monthPanelOpen ?? true);
    const [staffUi, setStaffUi] = useState<VacationCalendarStaffUi>(() => remembered?.staff ?? emptyVacationStaffUi());
    const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
    const [docsTarget, setDocsTarget] = useState<{ employeeId: number; label: string; dateIso: string } | null>(null);
    const [statusFilter, setStatusFilter] = useState<VacationCalendarStatus>(() => remembered?.status ?? 'all');
    const [hiddenKinds, setHiddenKinds] = useState<Set<VacationAbsenceKind>>(() => new Set(remembered?.hiddenKinds ?? []));
    const [viewMonth, setViewMonth] = useState<number | null>(() => remembered?.viewMonth ?? null);
    const pendingEmployeeIds = useRef(remembered?.selectedEmployeeIds ?? []);
    const saveReady = useRef(false);
    const restoredEmployeeIds = useRef<number[] | null>(null);
    const storedMonthOpened = useRef(false);
    const [openToken, setOpenToken] = useState(0);
    const [directory, setDirectory] = useState<VacationRosterPerson[]>([]);
    const [shownPeople, setShownPeople] = useState<VacationRosterPerson[]>([]);
    const facts = useVacationCalendarFacts(scheduleYear, canDecideRequests, scheduleReload);
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
    const marks = useMemo(
        () => marksForRoster(scheduleYear, facts.days.filter((day) => day != null), directory),
        [directory, facts.days, scheduleYear],
    );
    const daysByEmployee = useMemo(() => indexAbsenceDays(scheduleYear, marks), [marks, scheduleYear]);
    const allowedIds = useMemo(() => {
        if (statusFilter === 'all')
            return null;
        const ids = new Set<number>();
        for (const person of directory) {
            if (employeeMatchesStatus(person, statusFilter, scheduleYear, todayIso, daysByEmployee, requestMap, EMPTY_KINDS))
                ids.add(person.id);
        }
        return ids;
    }, [daysByEmployee, directory, requestMap, scheduleYear, statusFilter, todayIso]);
    const focusPeople = useMemo(() => {
        const base = selectedIds.size === 0
            ? shownPeople
            : shownPeople.filter((person) => selectedIds.has(person.id));
        return base;
    }, [selectedIds, shownPeople]);
    const kindCounts = useMemo(() => {
        const countsByKind = new Map<VacationAbsenceKind, number>();
        for (const person of focusPeople) {
            const kinds = new Set((daysByEmployee.get(person.id) ?? []).map((day) => day.kind));
            for (const kind of kinds)
                countsByKind.set(kind, (countsByKind.get(kind) ?? 0) + 1);
        }
        return countsByKind;
    }, [daysByEmployee, focusPeople]);
    const marksByDay = useMemo(() => {
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const map = new Map<string, VacationCalendarPaint[]>();
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
        return map;
    }, [daysByEmployee, facts.legend, focusPeople, hiddenKinds]);
    const detailMonth = viewMonth ?? (scheduleYear === today.getFullYear() ? today.getMonth() : 0);
    const monthRows = useMemo(() => {
        const fromIso = padIso(scheduleYear, { monthIndex: detailMonth, day: 1 });
        const toIso = padIso(scheduleYear, { monthIndex: detailMonth, day: 31 });
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const rows: VacationDayDetailRow[] = [];
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
        rows.sort((a, b) => a.rangeLabel.localeCompare(b.rangeLabel, 'ru') || a.label.localeCompare(b.label, 'ru'));
        return rows;
    }, [daysByEmployee, detailMonth, facts.legend, focusPeople, hiddenKinds, scheduleYear]);
    const rememberDirectory = useCallback((rows: VacationRosterPerson[]) => {
        setDirectory(rows);
    }, []);
    const rememberShown = useCallback((rows: VacationRosterPerson[]) => {
        setShownPeople(rows);
    }, []);
    const rememberStaffUi = useCallback((ui: VacationCalendarStaffUi) => {
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
        const wanted = new Set(pendingEmployeeIds.current);
        pendingEmployeeIds.current = [];
        const rows = directory.filter((person) => wanted.has(person.id));
        restoredEmployeeIds.current = rows.map((person) => person.id);
        saveReady.current = true;
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
        });
    }, [hiddenKinds, monthPanelOpen, scheduleYear, selectedEmployees, selectedPeriod, staffUi, statusFilter, viewMonth]);
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
        const rows: VacationDayDetailRow[] = [];
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
        rows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        return rows;
    }, [daysByEmployee, facts.legend, focusPeople, hiddenKinds, scheduleYear, selectedPeriod]);
    const openCalendarMonth = (month: number | null) => {
        setViewMonth(month);
        setOpenToken((value) => value + 1);
    };
    const requestsOpen = view !== 'calendar';
    const showToDecideAttention = view === 'calendar' && canDecideRequests && counts.toDecideCount > 0;
    const showMinePendingAttention = view === 'calendar' && counts.minePendingCount > 0;

    const openRequests = () => {
        if (canDecideRequests && counts.toDecideCount > 0)
            setView('to_decide');
        else
            setView('mine');
    };

    return (
        <div className="vacation-schedule-page">
            <main className="vacation-schedule-page__main">
                <header className="vacation-schedule-page__header">
                    <div className="vacation-schedule-page__header-start">
                        <AppBackButton className="app-back-btn" />
                        <AppHomeLogo withSeparator />
                        <h1 className="vacation-schedule-page__title">График отпусков</h1>
                    </div>
                    <div className="app-page-header-end">
                        <nav className="vac-switch" aria-label="Разделы графика отпусков">
                            <button
                                type="button"
                                className={`vac-switch__item${!requestsOpen ? ' vac-switch__item--on' : ''}`}
                                aria-current={!requestsOpen ? 'page' : undefined}
                                onClick={() => setView('calendar')}
                            >
                                Календарь
                            </button>
                            <button
                                type="button"
                                className={`vac-switch__item${requestsOpen ? ' vac-switch__item--on' : ''}`}
                                aria-current={requestsOpen ? 'page' : undefined}
                                onClick={openRequests}
                            >
                                Заявки
                                {requestsBadge ? <span className="vac-switch__badge" aria-hidden>{requestsBadge}</span> : null}
                            </button>
                        </nav>
                        <button
                            type="button"
                            className="vac-page-add-btn"
                            onClick={() => setRequestModalOpen(true)}
                            aria-label="Новая заявка на отсутствие"
                            title="Новая заявка"
                        >
                            +
                        </button>
                    </div>
                </header>
                {showToDecideAttention ? (
                    <div className="vac-attention" role="status">
                        <span className="vac-attention__dot" aria-hidden />
                        <p className="vac-attention__text">{vacationAttentionText(locale, 'decide', counts.toDecideCount)}</p>
                        <button type="button" className="vac-attention__action" onClick={() => setView('to_decide')}>
                            {t('vacationSchedule.attention.goToDecide')}
                        </button>
                    </div>
                ) : showMinePendingAttention ? (
                    <div className="vac-attention vac-attention--info" role="status">
                        <span className="vac-attention__dot" aria-hidden />
                        <p className="vac-attention__text">{vacationAttentionText(locale, 'mine', counts.minePendingCount)}</p>
                        <button type="button" className="vac-attention__action" onClick={() => setView('mine')}>
                            {t('vacationSchedule.attention.goToMine')}
                        </button>
                    </div>
                ) : null}
                <div className="vacation-schedule-page__body">
                    {requestsOpen ? (
                        <div className="vac-requests">
                            {canDecideRequests ? (
                                <div className="vac-tabs" role="tablist" aria-label="Какие заявки показать">
                                    {([
                                        ['mine', 'Мои'],
                                        ['to_decide', 'На согласование'],
                                        ['all', 'Все'],
                                    ] as const).map(([id, label]) => (
                                        <button
                                            key={id}
                                            type="button"
                                            role="tab"
                                            aria-selected={view === id}
                                            className={`vac-tabs__tab${view === id ? ' vac-tabs__tab--on' : ''}`}
                                            onClick={() => setView(id)}
                                        >
                                            <span className="vac-tabs__tab-inner">
                                                {label}
                                                {id === 'to_decide' && toDecideBadge ? (
                                                    <span className="vac-tabs__tab-badge" aria-hidden>{toDecideBadge}</span>
                                                ) : null}
                                                {id === 'mine' && minePendingBadge ? (
                                                    <span className="vac-tabs__tab-badge" aria-hidden>{minePendingBadge}</span>
                                                ) : null}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            <VacationLeaveRequestsPanel
                                mode={view}
                                refreshToken={refreshToken}
                                onScheduleMayHaveChanged={() => setRefreshToken((value) => value + 1)}
                            />
                        </div>
                    ) : (
                        <>
                        <div className="vac-board">
                            <VacationEmployeeSidebar
                                year={scheduleYear}
                                selectedIds={selectedIds}
                                allowedIds={allowedIds}
                                onSelectEmployees={setSelectedEmployees}
                                onToggleEmployee={(employee) => {
                                    setSelectedEmployees((prev) => (
                                        prev.some((row) => row.id === employee.id)
                                            ? prev.filter((row) => row.id !== employee.id)
                                            : [...prev, employee]
                                    ));
                                }}
                                onShownEmployees={rememberShown}
                                onDirectory={rememberDirectory}
                                initialQuery={staffUi.query}
                                initialTeamFilterIds={staffUi.teamFilterIds}
                                initialHiddenOpen={staffUi.hiddenOpen}
                                onStaffUiChange={rememberStaffUi}
                            />
                            <div className="vac-board__main">
                            <VacationCalendarFilters
                                year={scheduleYear}
                                onYearChange={(next) => setScheduleYear(Math.min(2100, Math.max(2000, next)))}
                                status={statusFilter}
                                onStatusChange={setStatusFilter}
                                monthOpen={viewMonth != null}
                                onShowYear={() => openCalendarMonth(null)}
                                onShowMonth={() => openCalendarMonth(scheduleYear === today.getFullYear() ? today.getMonth() : (viewMonth ?? 0))}
                                legend={facts.legend}
                                kindCounts={kindCounts}
                                hiddenKinds={hiddenKinds}
                                onToggleKind={(kind) => {
                                    setHiddenKinds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(kind))
                                            next.delete(kind);
                                        else
                                            next.add(kind);
                                        return next;
                                    });
                                }}
                            />
                            <VacationYearCalendar
                                year={scheduleYear}
                                marksByDay={marksByDay}
                                openToken={openToken}
                                requestedMonth={viewMonth}
                                onMonthChange={setViewMonth}
                                selectedPeriod={selectedPeriod}
                                onSelectDay={(monthIndex, day) => {
                                    setSelectedPeriod((prev) => {
                                        if (!prev || prev.start.monthIndex !== prev.end.monthIndex || prev.start.day !== prev.end.day)
                                            return { start: { monthIndex, day }, end: { monthIndex, day } };
                                        return { start: prev.start, end: { monthIndex, day } };
                                    });
                                }}
                            />
                            </div>
                            <VacationMonthPanel
                                year={scheduleYear}
                                monthIndex={detailMonth}
                                open={monthPanelOpen}
                                rows={monthRows}
                                showDocs={canViewDocs}
                                onToggle={() => setMonthPanelOpen((open) => !open)}
                                onOpenCard={setDetailEmployeeId}
                                onOpenDocs={(employeeId, label) => {
                                    const hit = (daysByEmployee.get(employeeId) ?? []).find((day) => day.monthIndex === detailMonth);
                                    setDocsTarget({
                                        employeeId,
                                        label,
                                        dateIso: hit?.iso ?? padIso(scheduleYear, { monthIndex: detailMonth, day: 1 }),
                                    });
                                }}
                            />
                            {selectedPeriod ? (
                                <VacationDayDetails
                                    year={scheduleYear}
                                    monthIndex={selectedPeriod.start.monthIndex}
                                    day={selectedPeriod.start.day}
                                    endMonthIndex={selectedPeriod.end.monthIndex}
                                    endDay={selectedPeriod.end.day}
                                    rows={dayRows}
                                    showDocs={canViewDocs}
                                    onClose={() => setSelectedPeriod(null)}
                                    onOpenCard={setDetailEmployeeId}
                                    onOpenDocs={(employeeId, label) => {
                                        const start = padIso(scheduleYear, selectedPeriod.start);
                                        const end = padIso(scheduleYear, selectedPeriod.end);
                                        setDocsTarget({ employeeId, label, dateIso: start <= end ? start : end });
                                    }}
                                />
                            ) : null}
                        </div>
                        </>
                    )}
                </div>
            </main>
            <VacationAbsenceRequestModal
                open={requestModalOpen}
                onClose={() => setRequestModalOpen(false)}
                onSubmitted={() => {
                    setRefreshToken((value) => value + 1);
                    setView('mine');
                }}
            />
            {detailEmployeeId != null ? (
                <VacationEmployeeDetailModal
                    employeeId={detailEmployeeId}
                    year={scheduleYear}
                    canEdit={canEditSchedule}
                    canViewDocs={canViewDocs}
                    onClose={() => setDetailEmployeeId(null)}
                    onScheduleMutated={() => setScheduleReload((value) => value + 1)}
                />
            ) : null}
            {docsTarget ? (
                <VacationPeriodDocsModal
                    open
                    year={scheduleYear}
                    employeeId={docsTarget.employeeId}
                    employeeName={docsTarget.label}
                    dateIso={docsTarget.dateIso}
                    onClose={() => setDocsTarget(null)}
                />
            ) : null}
        </div>
    );
}
