import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    getVacationScheduleEmployee,
    listVacationScheduleEmployees,
    type VacationLeaveRequestApi,
    type VacationLeaveRequestKind,
} from '@entities/vacation';
import {
    apiAbsenceKindToUi,
    VACATION_ABSENCE_LEGEND,
    VACATION_KIND_COLORS,
    VACATION_KIND_SEALS,
    VACATION_MONTH_NAMES,
    vacationDayIsWeekendRu,
    vacationKindHumanLabel,
    vacationKindSealUsesDarkInk,
    type VacationAbsenceKind,
} from '../lib/vacationScheduleModel';
import { formatRuDate, formatRuRange, leaveKindLabel, ruDaysWord } from '../lib/leaveRequestDisplay';
import './VacationLeaveYearCalendarModal.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

const LEAVE_KIND_TO_UI: Record<VacationLeaveRequestKind, VacationAbsenceKind> = {
    annual_vacation: 'annual',
    sick_leave: 'sick',
    day_off: 'dayoff',
    remote_work: 'remote',
};

type DayMark = {
    kind: VacationAbsenceKind;
    inRequest: boolean;
    fromSchedule: boolean;
};

type AbsenceRun = {
    from: string;
    to: string;
    kind: VacationAbsenceKind;
    days: number;
    inRequest: boolean;
};

type Props = {
    open: boolean;
    request: VacationLeaveRequestApi | null;
    onClose: () => void;
};

function yearFromIso(iso: string): number {
    const y = Number(iso.slice(0, 4));
    return Number.isFinite(y) ? y : new Date().getFullYear();
}

function isoDay(year: number, monthIndex: number, day: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayIso(): string {
    const d = new Date();
    return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function firstWeekdayMon0(year: number, monthIndex: number): number {
    return (new Date(year, monthIndex, 1).getDay() + 6) % 7;
}

function inInclusiveRange(iso: string, from: string, to: string): boolean {
    const d = iso.slice(0, 10);
    return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
    const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    d.setDate(d.getDate() + delta);
    return isoDay(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildMonthCells(year: number, monthIndex: number): Array<{ day: number | null; iso: string | null }> {
    const total = daysInMonth(year, monthIndex);
    const offset = firstWeekdayMon0(year, monthIndex);
    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < offset; i += 1)
        cells.push({ day: null, iso: null });
    for (let d = 1; d <= total; d += 1)
        cells.push({ day: d, iso: isoDay(year, monthIndex, d) });
    while (cells.length < 42)
        cells.push({ day: null, iso: null });
    return cells;
}

function collectRuns(marks: Record<string, DayMark>): AbsenceRun[] {
    const dates = Object.keys(marks).sort();
    if (dates.length === 0)
        return [];
    const runs: AbsenceRun[] = [];
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

function runEdge(iso: string, marks: Record<string, DayMark>): 'single' | 'start' | 'mid' | 'end' | null {
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

export function VacationLeaveYearCalendarModal({ open, request, onClose }: Props) {
    const requestYear = request ? yearFromIso(request.date_from) : new Date().getFullYear();
    const requestMonth = request ? Math.max(0, Number(request.date_from.slice(5, 7)) - 1) : 0;
    const [year, setYear] = useState(requestYear);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scheduleFound, setScheduleFound] = useState(true);
    const [marksByIso, setMarksByIso] = useState<Record<string, DayMark>>({});
    const [hiddenKinds, setHiddenKinds] = useState<Set<VacationAbsenceKind>>(() => new Set());
    const [selectedIso, setSelectedIso] = useState<string | null>(null);
    const [focusMonth, setFocusMonth] = useState<number | null>(null);
    const monthRefs = useRef<Array<HTMLElement | null>>([]);

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
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
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
    }, [open, onClose]);

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
                const map: Record<string, DayMark> = {};

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
                    const cursor = new Date(
                        Number(request.date_from.slice(0, 4)),
                        Number(request.date_from.slice(5, 7)) - 1,
                        Number(request.date_from.slice(8, 10)),
                    );
                    const end = new Date(
                        Number(request.date_to.slice(0, 4)),
                        Number(request.date_to.slice(5, 7)) - 1,
                        Number(request.date_to.slice(8, 10)),
                    );
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
            catch (e: unknown) {
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
        const out: Record<string, DayMark> = {};
        for (const [iso, mark] of Object.entries(marksByIso)) {
            if (hiddenKinds.has(mark.kind) && !mark.inRequest)
                continue;
            out[iso] = mark;
        }
        return out;
    }, [marksByIso, hiddenKinds]);

    const runs = useMemo(() => collectRuns(visibleMarks), [visibleMarks]);

    const stats = useMemo(() => {
        const byKind: Partial<Record<VacationAbsenceKind, number>> = {};
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
        const set = new Set<VacationAbsenceKind>();
        for (const m of Object.values(marksByIso))
            set.add(m.kind);
        return VACATION_ABSENCE_LEGEND.filter((x) => set.has(x.kind));
    }, [marksByIso]);

    const selectedMark = selectedIso ? visibleMarks[selectedIso] ?? marksByIso[selectedIso] : undefined;
    const selectedRun = selectedIso
        ? runs.find((r) => selectedIso >= r.from && selectedIso <= r.to)
        : undefined;

    const today = todayIso();

    const scrollToMonth = (monthIndex: number) => {
        setFocusMonth(monthIndex);
        monthRefs.current[monthIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const toggleKind = (kind: VacationAbsenceKind) => {
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

    return createPortal(
        <div className="vac-yr-cal-ov" role="presentation" onClick={onClose}>
            <div
                className="vac-yr-cal vac-yr-cal--advanced"
                role="dialog"
                aria-modal="true"
                aria-labelledby="vac-yr-cal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="vac-yr-cal__head">
                    <div className="vac-yr-cal__head-copy">
                        <div className="vac-yr-cal__title-row">
                            <h2 id="vac-yr-cal-title" className="vac-yr-cal__title">{titleName}</h2>
                            {request.employee_position ? (
                                <span className="vac-yr-cal__badge">{request.employee_position}</span>
                            ) : null}
                        </div>
                        <p className="vac-yr-cal__request">
                            Заявка #{request.id}: {leaveKindLabel(request.kind)} · {period}
                            <span className="vac-yr-cal__days-pill">
                                {request.days_count} {ruDaysWord(request.days_count)}
                            </span>
                        </p>
                    </div>

                    <div className="vac-yr-cal__year-nav" role="group" aria-label="Год календаря">
                        <button type="button" className="vac-yr-cal__year-btn" onClick={() => setYear((y) => y - 1)} aria-label="Предыдущий год">
                            ‹
                        </button>
                        <strong className="vac-yr-cal__year">{year}</strong>
                        <button type="button" className="vac-yr-cal__year-btn" onClick={() => setYear((y) => y + 1)} aria-label="Следующий год">
                            ›
                        </button>
                        {!isRequestYear && (
                            <button type="button" className="vac-yr-cal__year-reset" onClick={() => setYear(requestYear)}>
                                К заявке
                            </button>
                        )}
                    </div>

                    <button type="button" className="vac-yr-cal__x" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </header>

                <div className="vac-yr-cal__layout">
                    <div className="vac-yr-cal__main">
                        {loading && <p className="vac-yr-cal__status">Загрузка календаря…</p>}
                        {error && <p className="vac-yr-cal__err" role="alert">{error}</p>}
                        {!loading && !error && !scheduleFound && (
                            <p className="vac-yr-cal__hint">
                                Сотрудник ещё не в графике на {year}. Показан период заявки; остальные отметки появятся после попадания в график.
                            </p>
                        )}

                        {!loading && !error && (
                            <>
                                <div className="vac-yr-cal__legend" aria-label="Легенда и фильтр">
                                    <span className="vac-yr-cal__legend-item vac-yr-cal__legend-item--request">
                                        <i />
                                        Период заявки
                                    </span>
                                    {usedKinds.map((k) => {
                                        const hidden = hiddenKinds.has(k.kind);
                                        return (
                                            <button
                                                key={k.kind}
                                                type="button"
                                                className={`vac-yr-cal__legend-item vac-yr-cal__legend-btn${hidden ? ' vac-yr-cal__legend-item--off' : ''}`}
                                                onClick={() => toggleKind(k.kind)}
                                                aria-pressed={!hidden}
                                                title={hidden ? 'Показать' : 'Скрыть'}
                                            >
                                                <i style={{ background: k.color }}>{VACATION_KIND_SEALS[k.kind]}</i>
                                                {k.label}
                                                <b>{stats.byKind[k.kind] ?? 0}</b>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="vac-yr-cal__months">
                                    {Array.from({ length: 12 }, (_, monthIndex) => {
                                        const cells = buildMonthCells(year, monthIndex);
                                        const monthCount = stats.monthCounts[monthIndex];
                                        const isFocus = focusMonth === monthIndex;
                                        const hasRequest = isRequestYear && monthIndex === requestMonth;
                                        return (
                                            <section
                                                key={monthIndex}
                                                ref={(el) => {
                                                    monthRefs.current[monthIndex] = el;
                                                }}
                                                className={[
                                                    'vac-yr-cal__month',
                                                    isFocus ? ' vac-yr-cal__month--focus' : '',
                                                    hasRequest ? ' vac-yr-cal__month--request' : '',
                                                ].join('')}
                                            >
                                                <div className="vac-yr-cal__month-head">
                                                    <h3 className="vac-yr-cal__month-title">{VACATION_MONTH_NAMES[monthIndex]}</h3>
                                                    <span className={`vac-yr-cal__month-count${monthCount > 0 ? '' : ' vac-yr-cal__month-count--empty'}`}>
                                                        {monthCount > 0 ? monthCount : ''}
                                                    </span>
                                                </div>
                                                <div className="vac-yr-cal__weekdays">
                                                    {WEEKDAYS.map((w) => (
                                                        <span key={w}>{w}</span>
                                                    ))}
                                                </div>
                                                <div className="vac-yr-cal__grid">
                                                    {cells.map((cell, idx) => {
                                                        if (cell.day == null || cell.iso == null) {
                                                            return <span key={`e-${idx}`} className="vac-yr-cal__cell vac-yr-cal__cell--empty" />;
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
                                                        return (
                                                            <button
                                                                key={cell.iso}
                                                                type="button"
                                                                className={classes}
                                                                onClick={() => {
                                                                    setSelectedIso(cell.iso);
                                                                    setFocusMonth(monthIndex);
                                                                }}
                                                                style={mark ? {
                                                                    background: VACATION_KIND_COLORS[mark.kind],
                                                                    color: vacationKindSealUsesDarkInk(mark.kind) ? '#1e293b' : '#fff',
                                                                } : undefined}
                                                                title={mark
                                                                    ? `${formatRuDate(cell.iso)} · ${vacationKindHumanLabel(mark.kind)}${mark.inRequest ? ' · заявка' : ''}`
                                                                    : formatRuDate(cell.iso)}
                                                            >
                                                                {cell.day}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <aside className="vac-yr-cal__side" aria-label="Детали">
                        <section className="vac-yr-cal__side-card">
                            <h3 className="vac-yr-cal__side-title">Выбранный день</h3>
                            {selectedIso ? (
                                <>
                                    <p className="vac-yr-cal__side-date">{formatRuDate(selectedIso)}</p>
                                    {selectedMark ? (
                                        <div className="vac-yr-cal__side-mark">
                                            <span
                                                className="vac-yr-cal__side-seal"
                                                style={{
                                                    background: VACATION_KIND_COLORS[selectedMark.kind],
                                                    color: vacationKindSealUsesDarkInk(selectedMark.kind) ? '#1e293b' : '#fff',
                                                }}
                                            >
                                                {VACATION_KIND_SEALS[selectedMark.kind]}
                                            </span>
                                            <div>
                                                <strong>{vacationKindHumanLabel(selectedMark.kind)}</strong>
                                                <span>
                                                    {selectedMark.inRequest ? 'В периоде заявки' : 'Отметка в графике'}
                                                    {!selectedMark.fromSchedule && selectedMark.inRequest ? ' · ещё не в графике' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="vac-yr-cal__side-empty">Отметок нет</p>
                                    )}
                                    {selectedRun && selectedRun.days > 1 ? (
                                        <p className="vac-yr-cal__side-run">
                                            {formatRuRange(selectedRun.from, selectedRun.to)}
                                            {' · '}
                                            {selectedRun.days} {ruDaysWord(selectedRun.days)}
                                        </p>
                                    ) : null}
                                </>
                            ) : (
                                <p className="vac-yr-cal__side-empty">Кликните по дню в календаре</p>
                            )}
                        </section>

                        <section className="vac-yr-cal__side-card">
                            <h3 className="vac-yr-cal__side-title">Периоды за {year}</h3>
                            {runs.length === 0 ? (
                                <p className="vac-yr-cal__side-empty">Нет отмеченных периодов</p>
                            ) : (
                                <ul className="vac-yr-cal__runs">
                                    {runs.map((run) => (
                                        <li key={`${run.from}-${run.to}-${run.kind}`}>
                                            <button
                                                type="button"
                                                className={`vac-yr-cal__run${run.inRequest ? ' vac-yr-cal__run--req' : ''}${selectedRun?.from === run.from && selectedRun.to === run.to ? ' vac-yr-cal__run--on' : ''}`}
                                                onClick={() => {
                                                    setSelectedIso(run.from);
                                                    scrollToMonth(Number(run.from.slice(5, 7)) - 1);
                                                }}
                                            >
                                                <i style={{ background: VACATION_KIND_COLORS[run.kind] }} />
                                                <span className="vac-yr-cal__run-body">
                                                    <strong>{vacationKindHumanLabel(run.kind)}</strong>
                                                    <em>{formatRuRange(run.from, run.to)}</em>
                                                </span>
                                                <b>{run.days}</b>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </aside>
                </div>
            </div>
        </div>,
        document.body,
    );
}
