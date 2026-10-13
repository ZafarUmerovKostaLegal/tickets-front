import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import {
    addDays,
    addMonths,
    isFutureCalendarDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
    weekdayLabels,
} from './timesheetDateUtils';

type TimesheetMiniCalendarProps = {
    selected: Date;
    today: Date;
    hoursByDate: Map<string, number>;
    onSelect: (day: Date) => void;
};

function dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export function TimesheetMiniCalendar({ selected, today, hoursByDate, onSelect }: TimesheetMiniCalendarProps) {
    const { t, locale } = useI18n();
    const dateTag = localeTag(locale);
    const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selected));

    useEffect(() => {
        setVisibleMonth(startOfMonth(selected));
    }, [selected]);

    const labels = weekdayLabels(t);
    const cells = useMemo(() => {
        const start = startOfWeek(startOfMonth(visibleMonth));
        return Array.from({ length: 42 }, (_, index) => addDays(start, index));
    }, [visibleMonth]);
    const title = visibleMonth.toLocaleDateString(dateTag, { month: 'long', year: 'numeric' });
    const nextMonth = addMonths(visibleMonth, 1);
    const nextBlocked = isFutureCalendarDay(startOfMonth(nextMonth), today) && !isSameMonth(nextMonth, today);

    return (
        <aside className="tsp-mini" aria-label={t('timeTrackingPage.timesheet.jumpToDate')}>
            <div className="tsp-mini__head">
                <button
                    type="button"
                    className="tsp-mini__nav"
                    onClick={() => setVisibleMonth((month) => startOfMonth(addMonths(month, -1)))}
                    aria-label={t('timeTrackingPage.timesheet.prevMonth')}
                >
                    ‹
                </button>
                <span className="tsp-mini__title">{title}</span>
                <button
                    type="button"
                    className="tsp-mini__nav"
                    disabled={nextBlocked}
                    onClick={() => setVisibleMonth((month) => startOfMonth(addMonths(month, 1)))}
                    aria-label={t('timeTrackingPage.timesheet.nextMonth')}
                >
                    ›
                </button>
            </div>
            <div className="tsp-mini__dows" aria-hidden>
                {labels.map((label) => (
                    <span key={label} className="tsp-mini__dow">{label}</span>
                ))}
            </div>
            <div className="tsp-mini__grid" role="grid">
                {cells.map((day) => {
                    const future = isFutureCalendarDay(day, today);
                    const inMonth = isSameMonth(day, visibleMonth);
                    const selectedDay = sameDay(day, selected);
                    const todayDay = sameDay(day, today);
                    const hasHours = (hoursByDate.get(dateKey(day)) ?? 0) > 0;
                    return (
                        <button
                            key={dateKey(day)}
                            type="button"
                            role="gridcell"
                            className={[
                                'tsp-mini__day',
                                inMonth ? '' : 'tsp-mini__day--out',
                                selectedDay ? 'tsp-mini__day--selected' : '',
                                todayDay ? 'tsp-mini__day--today' : '',
                                future ? 'tsp-mini__day--future' : '',
                            ].filter(Boolean).join(' ')}
                            disabled={future}
                            aria-selected={selectedDay}
                            aria-current={todayDay ? 'date' : undefined}
                            onClick={() => onSelect(new Date(day.getFullYear(), day.getMonth(), day.getDate()))}
                        >
                            {day.getDate()}
                            {hasHours ? <span className="tsp-mini__dot" aria-hidden /> : null}
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                className="tsp-mini__today"
                onClick={() => onSelect(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
            >
                {t('timeTrackingPage.timesheet.today')}
            </button>
        </aside>
    );
}
