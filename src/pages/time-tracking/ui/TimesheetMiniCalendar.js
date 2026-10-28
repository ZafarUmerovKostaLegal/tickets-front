import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { addDays, addMonths, isFutureCalendarDay, isSameMonth, startOfMonth, startOfWeek, weekdayLabels, } from './timesheetDateUtils';
function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}
export function TimesheetMiniCalendar({ selected, today, hoursByDate, onSelect }) {
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
    return (_jsxs("div", { className: "tsp-mini", role: "group", "aria-label": t('timeTrackingPage.timesheet.jumpToDate'), children: [_jsxs("div", { className: "tsp-mini__head", children: [_jsx("button", { type: "button", className: "tsp-mini__nav", onClick: () => setVisibleMonth((month) => startOfMonth(addMonths(month, -1))), "aria-label": t('timeTrackingPage.timesheet.prevMonth'), children: "\u2039" }), _jsx("span", { className: "tsp-mini__title", children: title }), _jsx("button", { type: "button", className: "tsp-mini__nav", disabled: nextBlocked, onClick: () => setVisibleMonth((month) => startOfMonth(addMonths(month, 1))), "aria-label": t('timeTrackingPage.timesheet.nextMonth'), children: "\u203A" })] }), _jsx("div", { className: "tsp-mini__dows", "aria-hidden": true, children: labels.map((label, index) => (_jsx("span", { className: `tsp-mini__dow${index >= 5 ? ' tsp-mini__dow--wknd' : ''}`, children: label }, label))) }), _jsx("div", { className: "tsp-mini__grid", role: "grid", children: cells.map((day) => {
                    const future = isFutureCalendarDay(day, today);
                    const inMonth = isSameMonth(day, visibleMonth);
                    const selectedDay = sameDay(day, selected);
                    const todayDay = sameDay(day, today);
                    const weekend = day.getDay() === 0 || day.getDay() === 6;
                    const hasHours = (hoursByDate.get(dateKey(day)) ?? 0) > 0;
                    return (_jsxs("button", { type: "button", role: "gridcell", className: [
                            'tsp-mini__day',
                            inMonth ? '' : 'tsp-mini__day--out',
                            weekend ? 'tsp-mini__day--wknd' : '',
                            selectedDay ? 'tsp-mini__day--selected' : '',
                            todayDay ? 'tsp-mini__day--today' : '',
                            future ? 'tsp-mini__day--future' : '',
                        ].filter(Boolean).join(' '), disabled: future, "aria-selected": selectedDay, "aria-current": todayDay ? 'date' : undefined, onClick: () => onSelect(new Date(day.getFullYear(), day.getMonth(), day.getDate())), children: [day.getDate(), hasHours ? _jsx("span", { className: "tsp-mini__dot", "aria-hidden": true }) : null] }, dateKey(day)));
                }) }), _jsx("button", { type: "button", className: "tsp-mini__today", onClick: () => onSelect(new Date(today.getFullYear(), today.getMonth(), today.getDate())), children: t('timeTrackingPage.timesheet.today') })] }));
}
