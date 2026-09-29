import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react';
import { VACATION_MONTH_NAMES, vacationDayIsWeekendRu } from '../lib/vacationScheduleModel';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

function monthCells(year: number, monthIndex: number): Array<number | null> {
    const startPad = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < startPad; i += 1)
        cells.push(null);
    for (let day = 1; day <= days; day += 1)
        cells.push(day);
    while (cells.length < 42)
        cells.push(null);
    return cells;
}

function isToday(year: number, monthIndex: number, day: number): boolean {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === monthIndex && now.getDate() === day;
}

type Props = {
    year?: number;
    marksByDay?: ReadonlyMap<string, VacationCalendarPaint[]>;
    openToken?: number;
    requestedMonth?: number | null;
    onMonthChange?: (month: number | null) => void;
    selectedPeriod?: VacationCalendarPeriod | null;
    onSelectDay?: (monthIndex: number, day: number) => void;
    occupancy?: ReadonlyMap<string, number>;
    onOpenMonth?: (monthIndex: number) => void;
};

export type VacationCalendarDay = { monthIndex: number; day: number };

export type VacationCalendarPeriod = {
    start: VacationCalendarDay;
    end: VacationCalendarDay;
};

export type VacationCalendarPaint = {
    employeeId: number;
    label: string;
    color: string;
    kindLabel: string;
};

function daySerial(monthIndex: number, day: number): number {
    return monthIndex * 40 + day;
}

function periodEdge(monthIndex: number, day: number, period: VacationCalendarPeriod | null): 'end' | 'mid' | null {
    if (!period)
        return null;
    const value = daySerial(monthIndex, day);
    const start = daySerial(period.start.monthIndex, period.start.day);
    const end = daySerial(period.end.monthIndex, period.end.day);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    if (value < low || value > high)
        return null;
    return value === low || value === high ? 'end' : 'mid';
}
function DayCell({
    className,
    day,
    picked,
    ranged,
    label,
    onSelect,
    onHover,
    children,
}: {
    className: string;
    day: number | null;
    picked: boolean;
    ranged: boolean;
    label: string;
    onSelect: () => void;
    onHover?: (anchor: HTMLElement | null) => void;
    children: ReactNode;
}) {
    if (day == null)
        return <div className={className}>{children}</div>;
    return (
        <button
            type="button"
            className={`${className}${picked ? ' is-picked' : ''}${ranged ? ' is-range' : ''}`}
            aria-pressed={picked}
            aria-label={label}
            onMouseEnter={(event) => onHover?.(event.currentTarget)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={(event) => onHover?.(event.currentTarget)}
            onBlur={() => onHover?.(null)}
            onClick={(event) => {
                event.stopPropagation();
                onSelect();
            }}
        >
            {children}
        </button>
    );
}

function DayNum({ year, monthIndex, day }: { year: number; monthIndex: number; day: number | null }) {
    if (day == null)
        return <span className="vac-cal__num vac-cal__num--empty" />;
    const weekend = vacationDayIsWeekendRu(year, monthIndex, day);
    const today = isToday(year, monthIndex, day);
    return (
        <span className={`vac-cal__num${weekend ? ' vac-cal__num--weekend' : ''}${today ? ' vac-cal__num--today' : ''}`}>
            {day}
        </span>
    );
}

function DayMarks({ items, compact }: { items: VacationCalendarPaint[] | undefined; compact: boolean }) {
    if (!items || items.length === 0)
        return null;
    if (compact) {
        const colors = [...new Set(items.map((item) => item.color))].slice(0, 4);
        return (
            <span className="vac-cal__dots" aria-hidden>
                {colors.map((color) => <i key={color} style={{ background: color }} />)}
            </span>
        );
    }
    const shown = items.slice(0, 3);
    const rest = items.length - shown.length;
    return (
        <span className="vac-cal__marks">
            {shown.map((item) => (
                <span key={`${item.employeeId}-${item.kindLabel}`} className="vac-cal__mark" title={item.kindLabel}>
                    <i style={{ background: item.color }} aria-hidden />
                    <span>{item.label}</span>
                </span>
            ))}
            {rest > 0 ? <span className="vac-cal__mark-more">+{rest}</span> : null}
        </span>
    );
}

type FlyBox = { left: number; top: number; width: number; height: number };
type FlyMotion = 'enter' | 'opening' | 'open' | 'exit';

function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function measureCard(stage: HTMLElement, card: HTMLElement): FlyBox {
    const stageRect = stage.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
        left: cardRect.left - stageRect.left,
        top: cardRect.top - stageRect.top,
        width: cardRect.width,
        height: cardRect.height,
    };
}

function measureStage(stage: HTMLElement): FlyBox {
    const stageRect = stage.getBoundingClientRect();
    return { left: 0, top: 0, width: stageRect.width, height: stageRect.height };
}

function MonthSheet({
    year,
    monthIndex,
    marksByDay,
    selectedPeriod,
    onSelectDay,
    onStep,
    onBack,
}: {
    year: number;
    monthIndex: number;
    marksByDay: ReadonlyMap<string, VacationCalendarPaint[]>;
    selectedPeriod: VacationCalendarPeriod | null;
    onSelectDay: (monthIndex: number, day: number) => void;
    onStep: (delta: number) => void;
    onBack: () => void;
}) {
    const cells = monthCells(year, monthIndex);
    return (
        <>
            <header className="vac-cal__month-bar">
                <button type="button" className="vac-cal__back" onClick={onBack}>
                    К году
                </button>
                <h2 className="vac-cal__month-title">{VACATION_MONTH_NAMES[monthIndex]} {year}</h2>
                <div className="vac-cal__month-nav">
                    <button type="button" className="vac-cal__step" aria-label="Предыдущий месяц" onClick={() => onStep(-1)}>‹</button>
                    <button type="button" className="vac-cal__step" aria-label="Следующий месяц" onClick={() => onStep(1)}>›</button>
                </div>
            </header>
            <div className="vac-cal__sheet">
                {WEEKDAYS.map((label, weekday) => (
                    <div key={label} className={`vac-cal__wd vac-cal__wd--lg${weekday >= 5 ? ' vac-cal__wd--end' : ''}`}>{label}</div>
                ))}
                {cells.map((day, index) => {
                    const weekend = day != null && vacationDayIsWeekendRu(year, monthIndex, day);
                    const today = day != null && isToday(year, monthIndex, day);
                    return (
                        <DayCell
                            key={`${monthIndex}-${index}`}
                            className={`vac-cal__cell vac-cal__cell--lg${day == null ? ' vac-cal__cell--empty' : ''}${weekend ? ' vac-cal__cell--weekend' : ''}${today ? ' vac-cal__cell--today' : ''}`}
                            day={day}
                            picked={day != null && periodEdge(monthIndex, day, selectedPeriod) === 'end'}
                            ranged={day != null && periodEdge(monthIndex, day, selectedPeriod) === 'mid'}
                            label={day == null ? '' : `${day} ${VACATION_MONTH_NAMES[monthIndex]} ${year}`}
                            onSelect={() => {
                                if (day != null)
                                    onSelectDay(monthIndex, day);
                            }}
                        >
                            <DayNum year={year} monthIndex={monthIndex} day={day} />
                            {day != null ? <DayMarks items={marksByDay.get(`${monthIndex}-${day}`)} compact={false} /> : null}
                        </DayCell>
                    );
                })}
            </div>
        </>
    );
}

export function VacationYearCalendar({
    year = new Date().getFullYear(),
    marksByDay = new Map(),
    openToken = 0,
    requestedMonth = null,
    onMonthChange,
    selectedPeriod = null,
    onSelectDay,
    occupancy,
    onOpenMonth,
}: Props) {
    const stageRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Array<HTMLElement | null>>([]);
    const frameRef = useRef(0);
    const [monthIndex, setMonthIndex] = useState<number | null>(null);
    const [motion, setMotion] = useState<FlyMotion | null>(null);
    const [box, setBox] = useState<FlyBox | null>(null);
    const [anim, setAnim] = useState(false);
    const motionRef = useRef<FlyMotion | null>(null);
    motionRef.current = motion;
    const onMonthChangeRef = useRef(onMonthChange);
    onMonthChangeRef.current = onMonthChange;
    const requestedMonthRef = useRef(requestedMonth);
    requestedMonthRef.current = requestedMonth;
    const openTokenSeen = useRef(openToken);
    const now = new Date();
    const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
    const yearRecede = motion === 'enter' || motion === 'opening' || motion === 'open';
    const [tip, setTip] = useState<{
        left: number;
        top: number;
        below: boolean;
        date: string;
        people: VacationCalendarPaint[];
    } | null>(null);

    const showDayTip = (month: number, day: number, anchor: HTMLElement | null) => {
        if (!anchor) {
            setTip(null);
            return;
        }
        const people = (marksByDay.get(`${month}-${day}`) ?? []).filter((mark) => !mark.kindLabel.startsWith('Опоздание'));
        if (people.length === 0) {
            setTip(null);
            return;
        }
        const rect = anchor.getBoundingClientRect();
        const below = rect.top < 120;
        setTip({
            left: rect.left + rect.width / 2,
            top: below ? rect.bottom : rect.top,
            below,
            date: `${day} ${VACATION_MONTH_NAMES[month]}`,
            people,
        });
    };

    const reset = () => {
        setMonthIndex(null);
        setMotion(null);
        setBox(null);
        setAnim(false);
    };

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    useEffect(() => {
        if (motion !== 'enter')
            return;
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => {
                const stage = stageRef.current;
                if (!stage)
                    return;
                setBox(measureStage(stage));
                setAnim(true);
                setMotion('opening');
            });
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [motion]);

    useEffect(() => {
        if (motion !== 'open')
            return;
        const stage = stageRef.current;
        if (!stage)
            return;
        const apply = () => setBox(measureStage(stage));
        const observer = new ResizeObserver(apply);
        observer.observe(stage);
        return () => observer.disconnect();
    }, [motion]);

    useEffect(() => {
        if (motion !== 'opening' && motion !== 'exit')
            return;
        const timer = window.setTimeout(() => {
            if (motionRef.current === 'opening') {
                setAnim(false);
                setMotion('open');
                return;
            }
            if (motionRef.current === 'exit')
                reset();
        }, 700);
        return () => window.clearTimeout(timer);
    }, [motion]);

    const stepMonth = (delta: number) => {
        if (monthIndex == null)
            return;
        const next = (monthIndex + delta + 12) % 12;
        onMonthChangeRef.current?.(next);
        setMonthIndex(next);
    };

    const openMonth = (index: number) => {
        onMonthChangeRef.current?.(index);
        if (motion)
            return;
        const stage = stageRef.current;
        const card = cardRefs.current[index];
        if (!stage || !card) {
            setMonthIndex(index);
            setMotion('open');
            return;
        }
        if (prefersReducedMotion()) {
            setBox(measureStage(stage));
            setMonthIndex(index);
            setMotion('open');
            return;
        }
        setBox(measureCard(stage, card));
        setAnim(false);
        setMonthIndex(index);
        setMotion('enter');
    };

    const closeMonth = () => {
        onMonthChangeRef.current?.(null);
        if (monthIndex == null || motion === 'exit' || motion === 'enter' || motion == null)
            return;
        const stage = stageRef.current;
        const card = cardRefs.current[monthIndex];
        if (!stage || !card || prefersReducedMotion()) {
            reset();
            return;
        }
        const target = measureCard(stage, card);
        if (motion === 'opening') {
            setBox(target);
            setMotion('exit');
            return;
        }
        setAnim(true);
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(() => {
            setBox(target);
            setMotion('exit');
        });
    };

    const restoredMonth = useRef(false);
    useEffect(() => {
        if (restoredMonth.current)
            return;
        restoredMonth.current = true;
        const month = requestedMonthRef.current;
        if (month == null)
            return;
        openMonth(month);
    }, []);

    useEffect(() => {
        if (openToken === openTokenSeen.current)
            return;
        openTokenSeen.current = openToken;
        const month = requestedMonthRef.current;
        if (month == null)
            closeMonth();
        else
            openMonth(month);
    }, [openToken]);

    const onFlyEnd = (event: TransitionEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget || event.propertyName !== 'width')
            return;
        if (motionRef.current === 'opening') {
            setAnim(false);
            setMotion('open');
            return;
        }
        if (motionRef.current === 'exit')
            reset();
    };

    const flyClass = [
        'vac-cal',
        'vac-cal--month',
        'vac-cal--fly',
        anim ? 'is-anim' : '',
        motion === 'opening' || motion === 'open' ? 'is-full' : '',
        motion === 'exit' ? 'is-exit' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className="vac-cal-stage" ref={stageRef}>
            <section
                className={`vac-cal${yearRecede ? ' vac-cal--recede' : ''}`}
                aria-label={`Календарь ${year}`}
                aria-hidden={yearRecede}
            >
                {VACATION_MONTH_NAMES.map((name, index) => {
                    const cells = monthCells(year, index);
                    const source = monthIndex === index;
                    return (
                        <article
                            key={name}
                            ref={(node) => { cardRefs.current[index] = node; }}
                            className={`vac-cal__month${index === currentMonth ? ' vac-cal__month--now' : ''}${source ? ' is-source' : ''}`}
                            onDoubleClick={() => (onOpenMonth ? onOpenMonth(index) : openMonth(index))}
                        >
                            <h2 className="vac-cal__name">{name}</h2>
                            <div className="vac-cal__mini">
                                {WEEKDAYS.map((label, weekday) => (
                                    <div key={label} className={`vac-cal__wd${weekday >= 5 ? ' vac-cal__wd--end' : ''}`}>{label}</div>
                                ))}
                                {cells.map((day, cellIndex) => {
                                    const count = day == null ? 0 : (occupancy?.get(`${index}-${day}`) ?? 0);
                                    const today = day != null && isToday(year, index, day);
                                    const away = day == null
                                        ? []
                                        : (marksByDay.get(`${index}-${day}`) ?? []).filter((mark) => !mark.kindLabel.startsWith('Опоздание'));
                                    const awayLabel = away.length === 0
                                        ? ''
                                        : `. В отпуске: ${away.map((mark) => mark.label).join(', ')}`;
                                    return (
                                    <DayCell
                                        key={`${index}-${cellIndex}`}
                                        className={`vac-cal__cell${count >= 4 ? ' is-hot' : count > 0 ? ' is-busy' : ''}${today ? ' is-today' : ''}`}
                                        day={day}
                                        picked={day != null && periodEdge(index, day, selectedPeriod) === 'end'}
                                        ranged={day != null && periodEdge(index, day, selectedPeriod) === 'mid'}
                                        label={day == null ? '' : `${day} ${name} ${year}${awayLabel}`}
                                        onHover={day == null ? undefined : (anchor) => showDayTip(index, day, anchor)}
                                        onSelect={() => {
                                            if (day != null)
                                                onSelectDay?.(index, day);
                                        }}
                                    >
                                        <DayNum year={year} monthIndex={index} day={day} />
                                    </DayCell>
                                    );
                                })}
                            </div>
                        </article>
                    );
                })}
            </section>
            {monthIndex != null && box ? (
                <section
                    className={flyClass}
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                    aria-label={`${VACATION_MONTH_NAMES[monthIndex]} ${year}`}
                    onTransitionEnd={onFlyEnd}
                >
                    <MonthSheet
                        year={year}
                        monthIndex={monthIndex}
                        marksByDay={marksByDay}
                        selectedPeriod={selectedPeriod}
                        onSelectDay={(month, day) => onSelectDay?.(month, day)}
                        onStep={stepMonth}
                        onBack={closeMonth}
                    />
                </section>
            ) : null}
            {tip ? (
                <div
                    className={`vac-cal__tip${tip.below ? ' vac-cal__tip--below' : ''}`}
                    style={{ left: tip.left, top: tip.top }}
                    role="tooltip"
                >
                    <p className="vac-cal__tip-date">{tip.date}</p>
                    <ul>
                        {tip.people.map((person) => (
                            <li key={`${person.employeeId}-${person.kindLabel}`}>
                                <i style={{ background: person.color }} aria-hidden />
                                <span>{person.label}</span>
                                <em>{person.kindLabel}</em>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
