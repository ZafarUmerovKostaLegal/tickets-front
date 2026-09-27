import { useState } from 'react';
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
};

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

export function VacationYearCalendar({ year = new Date().getFullYear() }: Props) {
    const [monthIndex, setMonthIndex] = useState<number | null>(null);
    const now = new Date();
    const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;

    if (monthIndex != null) {
        const cells = monthCells(year, monthIndex);
        return (
            <section className="vac-cal vac-cal--month" aria-label={`${VACATION_MONTH_NAMES[monthIndex]} ${year}`}>
                <header className="vac-cal__month-bar">
                    <button type="button" className="vac-cal__back" onClick={() => setMonthIndex(null)}>
                        К году
                    </button>
                    <h2 className="vac-cal__month-title">{VACATION_MONTH_NAMES[monthIndex]} {year}</h2>
                </header>
                <div className="vac-cal__sheet">
                    {WEEKDAYS.map((label, weekday) => (
                        <div key={label} className={`vac-cal__wd vac-cal__wd--lg${weekday >= 5 ? ' vac-cal__wd--end' : ''}`}>{label}</div>
                    ))}
                    {cells.map((day, index) => (
                        <div key={`${monthIndex}-${index}`} className="vac-cal__cell vac-cal__cell--lg">
                            <DayNum year={year} monthIndex={monthIndex} day={day} />
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="vac-cal" aria-label={`Календарь ${year}`}>
            {VACATION_MONTH_NAMES.map((name, index) => {
                const cells = monthCells(year, index);
                return (
                    <article
                        key={name}
                        className={`vac-cal__month${index === currentMonth ? ' vac-cal__month--now' : ''}`}
                        onDoubleClick={() => setMonthIndex(index)}
                    >
                        <h2 className="vac-cal__name">{name}</h2>
                        <div className="vac-cal__mini">
                            {WEEKDAYS.map((label, weekday) => (
                                <div key={label} className={`vac-cal__wd${weekday >= 5 ? ' vac-cal__wd--end' : ''}`}>{label}</div>
                            ))}
                            {cells.map((day, cellIndex) => (
                                <div key={`${index}-${cellIndex}`} className="vac-cal__cell">
                                    <DayNum year={year} monthIndex={index} day={day} />
                                </div>
                            ))}
                        </div>
                    </article>
                );
            })}
        </section>
    );
}
