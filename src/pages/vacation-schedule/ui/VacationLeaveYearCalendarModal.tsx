import { useEffect, useMemo, useState } from 'react';
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
import { formatRuRange, leaveKindLabel, ruDaysWord } from '../lib/leaveRequestDisplay';
import './VacationLeaveYearCalendarModal.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

const LEAVE_KIND_TO_UI: Record<VacationLeaveRequestKind, VacationAbsenceKind> = {
    annual_vacation: 'annual',
    day_off: 'dayoff',
    remote_work: 'remote',
};

type DayMark = {
    kind: VacationAbsenceKind;
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

function buildMonthCells(year: number, monthIndex: number): Array<{ day: number | null; iso: string | null }> {
    const total = daysInMonth(year, monthIndex);
    const offset = firstWeekdayMon0(year, monthIndex);
    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < offset; i += 1)
        cells.push({ day: null, iso: null });
    for (let d = 1; d <= total; d += 1)
        cells.push({ day: d, iso: isoDay(year, monthIndex, d) });
    while (cells.length % 7 !== 0)
        cells.push({ day: null, iso: null });
    return cells;
}

export function VacationLeaveYearCalendarModal({ open, request, onClose }: Props) {
    const year = request ? yearFromIso(request.date_from) : new Date().getFullYear();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scheduleFound, setScheduleFound] = useState(true);
    const [marksByIso, setMarksByIso] = useState<Record<string, DayMark>>({});

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
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
        const y = yearFromIso(request.date_from);
        const requestKind = LEAVE_KIND_TO_UI[request.kind] ?? 'annual';

        void (async () => {
            try {
                const employees = await listVacationScheduleEmployees(y);
                if (cancelled)
                    return;
                const row = employees.find((e) => e.auth_user_id === request.employee_user_id);
                const map: Record<string, DayMark> = {};

                if (row) {
                    const detail = await getVacationScheduleEmployee(row.id, y);
                    if (cancelled)
                        return;
                    for (const day of detail.absence_days ?? []) {
                        const iso = day.absence_on?.slice(0, 10);
                        if (!iso)
                            continue;
                        const ui = apiAbsenceKindToUi(day.kind);
                        if (!ui)
                            continue;
                        map[iso] = {
                            kind: ui,
                            inRequest: inInclusiveRange(iso, request.date_from, request.date_to),
                        };
                    }
                }
                else {
                    setScheduleFound(false);
                }

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
                    const iso = isoDay(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
                    if (cursor.getFullYear() === y) {
                        const existing = map[iso];
                        map[iso] = {
                            kind: existing?.kind ?? requestKind,
                            inRequest: true,
                        };
                    }
                    cursor.setDate(cursor.getDate() + 1);
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
    }, [open, request]);

    const usedKinds = useMemo(() => {
        const set = new Set<VacationAbsenceKind>();
        for (const m of Object.values(marksByIso))
            set.add(m.kind);
        return VACATION_ABSENCE_LEGEND.filter((x) => set.has(x.kind));
    }, [marksByIso]);

    if (!open || !request)
        return null;

    const titleName = request.employee_full_name || request.employee_email || `Сотрудник #${request.employee_user_id}`;
    const period = formatRuRange(request.date_from, request.date_to);

    return createPortal(
        <div className="vac-yr-cal-ov" role="presentation" onClick={onClose}>
            <div
                className="vac-yr-cal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="vac-yr-cal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="vac-yr-cal__head">
                    <div className="vac-yr-cal__head-copy">
                        <h2 id="vac-yr-cal-title" className="vac-yr-cal__title">{titleName}</h2>
                        <p className="vac-yr-cal__sub">
                            Календарь {year}
                            {request.employee_position ? ` · ${request.employee_position}` : ''}
                        </p>
                        <p className="vac-yr-cal__request">
                            Заявка #{request.id}: {leaveKindLabel(request.kind)} · {period}
                            {' '}
                            <span className="vac-yr-cal__days-pill">
                                {request.days_count} {ruDaysWord(request.days_count)}
                            </span>
                        </p>
                    </div>
                    <button type="button" className="vac-yr-cal__x" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </header>

                <div className="vac-yr-cal__body">
                    {loading && <p className="vac-yr-cal__status">Загрузка календаря…</p>}
                    {error && <p className="vac-yr-cal__err" role="alert">{error}</p>}
                    {!loading && !error && !scheduleFound && (
                        <p className="vac-yr-cal__hint">
                            Сотрудник ещё не в графике на {year}. Показан период заявки; остальные отметки появятся после попадания в график.
                        </p>
                    )}

                    {!loading && !error && (
                        <>
                            <div className="vac-yr-cal__legend" aria-label="Легенда">
                                <span className="vac-yr-cal__legend-item vac-yr-cal__legend-item--request">
                                    <i />
                                    Период заявки
                                </span>
                                {usedKinds.map((k) => (
                                    <span key={k.kind} className="vac-yr-cal__legend-item">
                                        <i style={{ background: k.color }}>{VACATION_KIND_SEALS[k.kind]}</i>
                                        {k.label}
                                    </span>
                                ))}
                            </div>

                            <div className="vac-yr-cal__months">
                                {Array.from({ length: 12 }, (_, monthIndex) => {
                                    const cells = buildMonthCells(year, monthIndex);
                                    return (
                                        <section key={monthIndex} className="vac-yr-cal__month">
                                            <h3 className="vac-yr-cal__month-title">{VACATION_MONTH_NAMES[monthIndex]}</h3>
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
                                                    const mark = marksByIso[cell.iso];
                                                    const weekend = vacationDayIsWeekendRu(year, monthIndex, cell.day);
                                                    const classes = [
                                                        'vac-yr-cal__cell',
                                                        weekend ? ' vac-yr-cal__cell--weekend' : '',
                                                        mark ? ' vac-yr-cal__cell--mark' : '',
                                                        mark?.inRequest ? ' vac-yr-cal__cell--request' : '',
                                                    ].join('');
                                                    const title = mark
                                                        ? `${cell.iso}: ${vacationKindHumanLabel(mark.kind)}${mark.inRequest ? ' · в заявке' : ''}`
                                                        : cell.iso;
                                                    return (
                                                        <span
                                                            key={cell.iso}
                                                            className={classes}
                                                            title={title}
                                                            style={mark ? {
                                                                background: VACATION_KIND_COLORS[mark.kind],
                                                                color: vacationKindSealUsesDarkInk(mark.kind) ? '#1e293b' : '#fff',
                                                            } : undefined}
                                                        >
                                                            {cell.day}
                                                        </span>
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
            </div>
        </div>,
        document.body,
    );
}
