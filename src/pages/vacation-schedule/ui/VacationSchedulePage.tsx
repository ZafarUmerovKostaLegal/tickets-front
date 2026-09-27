import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVacationLeavePendingBadge } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import { isVacationSystemRowId, type VacationAbsenceKind, type VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';
import { canDecideVacationLeaveRequests, canEditVacationSchedule, canViewVacationManualEntryDocs } from '../model/vacationScheduleAccess';
import { VacationAbsenceRequestModal } from './VacationAbsenceRequestModal';
import { VacationCalendarFilters, type VacationTodayRow } from './VacationCalendarFilters';
import { VacationDayDetails, type VacationDayDetailRow } from './VacationDayDetails';
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal';
import { VacationEmployeeSidebar } from './VacationEmployeeSidebar';
import { VacationLeaveRequestsPanel } from './VacationLeaveRequestsPanel';
import { VacationPeriodDocsModal } from './VacationPeriodDocsModal';
import { VacationYearCalendar, type VacationCalendarPaint } from './VacationYearCalendar';
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
    const { t } = useI18n();
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
    const [scheduleYear, setScheduleYear] = useState(() => new Date().getFullYear());
    const [scheduleReload, setScheduleReload] = useState(0);
    const [selectedDay, setSelectedDay] = useState<{ monthIndex: number; day: number } | null>(null);
    const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
    const [docsTarget, setDocsTarget] = useState<{ employeeId: number; label: string; dateIso: string } | null>(null);
    const [statusFilter, setStatusFilter] = useState<VacationCalendarStatus>('all');
    const [hiddenKinds, setHiddenKinds] = useState<Set<VacationAbsenceKind>>(() => new Set());
    const [viewMonth, setViewMonth] = useState<number | null>(null);
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
    const todayRows = useMemo(() => {
        if (scheduleYear !== today.getFullYear())
            return [];
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const rows: VacationTodayRow[] = [];
        for (const person of focusPeople) {
            const days = daysByEmployee.get(person.id) ?? [];
            const kindsToday = [...new Set(days.filter((day) => day.iso === todayIso && !hiddenKinds.has(day.kind)).map((day) => day.kind))];
            for (const kind of kindsToday) {
                const run = absenceRunAround(days, todayIso, kind);
                if (!run)
                    continue;
                const legendItem = legendByKind.get(kind);
                const parts = person.label.trim().split(/\s+/).filter(Boolean);
                const initials = parts.length <= 1
                    ? (parts[0] ?? '?').slice(0, 2).toUpperCase()
                    : `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
                rows.push({
                    employeeId: person.id,
                    label: person.label,
                    teamName: person.teamName,
                    initials,
                    color: legendItem?.color ?? '#64748b',
                    kindLabel: legendItem?.label ?? kind,
                    rangeLabel: formatAbsenceRange(run.from, run.to),
                });
            }
        }
        rows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        return rows;
    }, [daysByEmployee, facts.legend, focusPeople, hiddenKinds, scheduleYear, today, todayIso]);
    const rememberDirectory = useCallback((rows: VacationRosterPerson[]) => {
        setDirectory(rows);
    }, []);
    const rememberShown = useCallback((rows: VacationRosterPerson[]) => {
        setShownPeople(rows);
    }, []);
    const canEditSchedule = !loading && canEditVacationSchedule(user);
    const canViewDocs = !loading && canViewVacationManualEntryDocs(user);
    const dayRows = useMemo(() => {
        if (!selectedDay)
            return [];
        const iso = `${scheduleYear}-${String(selectedDay.monthIndex + 1).padStart(2, '0')}-${String(selectedDay.day).padStart(2, '0')}`;
        const legendByKind = new Map(facts.legend.map((item) => [item.kind, item]));
        const rows: VacationDayDetailRow[] = [];
        for (const person of focusPeople) {
            const days = daysByEmployee.get(person.id) ?? [];
            const kinds = [...new Set(days.filter((day) => day.iso === iso && !hiddenKinds.has(day.kind)).map((day) => day.kind))];
            for (const kind of kinds) {
                const run = absenceRunAround(days, iso, kind);
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
    }, [daysByEmployee, facts.legend, focusPeople, hiddenKinds, scheduleYear, selectedDay]);
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
                        <p className="vac-attention__text">
                            {t('vacationSchedule.attention.toDecide').replace('{count}', String(counts.toDecideCount))}
                        </p>
                        <button type="button" className="vac-attention__action" onClick={() => setView('to_decide')}>
                            {t('vacationSchedule.attention.goToDecide')}
                        </button>
                    </div>
                ) : showMinePendingAttention ? (
                    <div className="vac-attention vac-attention--info" role="status">
                        <p className="vac-attention__text">
                            {t('vacationSchedule.attention.minePending').replace('{count}', String(counts.minePendingCount))}
                        </p>
                        <button type="button" className="vac-attention__action" onClick={() => setView('mine')}>
                            {t('vacationSchedule.attention.goToMine')}
                        </button>
                    </div>
                ) : null}
                <div className="vacation-schedule-page__body">
                    <nav className="vac-rail" aria-label="Разделы графика отпусков">
                        <button
                            type="button"
                            className={`vac-rail__item${!requestsOpen ? ' vac-rail__item--on' : ''}`}
                            aria-current={!requestsOpen ? 'page' : undefined}
                            onClick={() => setView('calendar')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <rect x="3" y="4" width="18" height="18" rx="2"/>
                                <path d="M16 2v4M8 2v4M3 10h18"/>
                            </svg>
                            Календарь
                        </button>
                        <button
                            type="button"
                            className={`vac-rail__item${requestsOpen ? ' vac-rail__item--on' : ''}`}
                            aria-current={requestsOpen ? 'page' : undefined}
                            onClick={openRequests}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M9 11l3 3L22 4"/>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            Заявки
                            {requestsBadge ? (
                                <span className="vac-rail__badge" aria-hidden>{requestsBadge}</span>
                            ) : null}
                        </button>
                    </nav>
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
                            />
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
                                todayLabel={today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                todayRows={todayRows}
                                onPickToday={(employeeId) => {
                                    const person = shownPeople.find((row) => row.id === employeeId) ?? directory.find((row) => row.id === employeeId);
                                    if (person)
                                        setSelectedEmployees([person]);
                                }}
                            />
                            <VacationYearCalendar
                                year={scheduleYear}
                                marksByDay={marksByDay}
                                openToken={openToken}
                                requestedMonth={viewMonth}
                                onMonthChange={setViewMonth}
                                selectedDay={selectedDay}
                                onSelectDay={(monthIndex, day) => setSelectedDay({ monthIndex, day })}
                            />
                            {selectedDay ? (
                                <VacationDayDetails
                                    year={scheduleYear}
                                    monthIndex={selectedDay.monthIndex}
                                    day={selectedDay.day}
                                    rows={dayRows}
                                    showDocs={canViewDocs}
                                    onClose={() => setSelectedDay(null)}
                                    onOpenCard={setDetailEmployeeId}
                                    onOpenDocs={(employeeId, label) => {
                                        if (!selectedDay)
                                            return;
                                        const month = String(selectedDay.monthIndex + 1).padStart(2, '0');
                                        const day = String(selectedDay.day).padStart(2, '0');
                                        setDocsTarget({ employeeId, label, dateIso: `${scheduleYear}-${month}-${day}` });
                                    }}
                                />
                            ) : null}
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
