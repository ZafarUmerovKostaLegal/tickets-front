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
    while (cells.length % 7 !== 0)
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

export function VacationYearCalendar({ year = new Date().getFullYear() }: Props) {
    const [monthIndex, setMonthIndex] = useState<number | null>(null);

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
                    {WEEKDAYS.map((label) => (
                        <div key={label} className="vac-cal__wd vac-cal__wd--lg">{label}</div>
                    ))}
                    {cells.map((day, index) => {
                        const weekend = day != null && vacationDayIsWeekendRu(year, monthIndex, day);
                        const today = day != null && isToday(year, monthIndex, day);
                        return (
                            <div
                                key={`${monthIndex}-${index}`}
                                className={`vac-cal__cell vac-cal__cell--lg${weekend ? ' vac-cal__cell--weekend' : ''}${today ? ' vac-cal__cell--today' : ''}`}
                            >
                                {day ?? ''}
                            </div>
                        );
                    })}
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
                        className="vac-cal__month"
                        onDoubleClick={() => setMonthIndex(index)}
                    >
                        <h2 className="vac-cal__name">{name}</h2>
                        <div className="vac-cal__mini">
                            {WEEKDAYS.map((label) => (
                                <div key={label} className="vac-cal__wd">{label}</div>
                            ))}
                            {cells.map((day, cellIndex) => {
                                const weekend = day != null && vacationDayIsWeekendRu(year, index, day);
                                const today = day != null && isToday(year, index, day);
                                return (
                                    <div
                                        key={`${index}-${cellIndex}`}
                                        className={`vac-cal__cell${weekend ? ' vac-cal__cell--weekend' : ''}${today ? ' vac-cal__cell--today' : ''}`}
                                    >
                                        {day ?? ''}
                                    </div>
                                );
                            })}
                        </div>
                    </article>
                );
            })}
        </section>
    );
}
