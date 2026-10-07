import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { VACATION_MONTH_NAMES, vacationDayIsWeekendRu } from '../lib/vacationScheduleModel';
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
function monthCells(year, monthIndex) {
    const startPad = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i += 1)
        cells.push(null);
    for (let day = 1; day <= days; day += 1)
        cells.push(day);
    while (cells.length < 42)
        cells.push(null);
    return cells;
}
function isToday(year, monthIndex, day) {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === monthIndex && now.getDate() === day;
}
function daySerial(monthIndex, day) {
    return monthIndex * 40 + day;
}
function periodEdge(monthIndex, day, period) {
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
function DayCell({ className, day, picked, ranged, label, onSelect, onHover, children, }) {
    if (day == null)
        return _jsx("div", { className: className, children: children });
    return (_jsx("button", { type: "button", className: `${className}${picked ? ' is-picked' : ''}${ranged ? ' is-range' : ''}`, "aria-pressed": picked, "aria-label": label, onMouseEnter: (event) => onHover?.(event.currentTarget), onMouseLeave: () => onHover?.(null), onFocus: (event) => onHover?.(event.currentTarget), onBlur: () => onHover?.(null), onClick: (event) => {
            event.stopPropagation();
            onSelect();
        }, children: children }));
}
function ringSectorPath(radius, startDeg, sweepDeg) {
    const cx = 12;
    const cy = 12;
    const start = ((startDeg - 90) * Math.PI) / 180;
    const end = ((startDeg + sweepDeg - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
function DayRing({ colors }) {
    const radius = 10.35;
    const stroke = colors[0] ?? '#9C27FF';
    if (colors.length === 1) {
        return (_jsx("svg", { className: "vac-cal__ring", viewBox: "0 0 24 24", "aria-hidden": true, children: _jsx("circle", { cx: "12", cy: "12", r: radius, fill: "none", stroke: stroke, strokeWidth: "2.55" }) }));
    }
    const slice = 360 / colors.length;
    return (_jsx("svg", { className: "vac-cal__ring", viewBox: "0 0 24 24", "aria-hidden": true, children: colors.map((color, index) => (_jsx("path", { d: ringSectorPath(radius, index * slice - 0.35, slice + 0.7), fill: "none", stroke: color, strokeWidth: "2.55", strokeLinecap: "butt" }, `${color}-${index}`))) }));
}
function DayNum({ year, monthIndex, day, colors = [] }) {
    if (day == null)
        return _jsx("span", { className: "vac-cal__num vac-cal__num--empty" });
    const weekend = vacationDayIsWeekendRu(year, monthIndex, day);
    const today = isToday(year, monthIndex, day);
    const ring = colors.length > 0;
    return (_jsxs("span", { className: `vac-cal__num${weekend ? ' vac-cal__num--weekend' : ''}${today ? ' vac-cal__num--today' : ''}${ring ? ' vac-cal__num--ring' : ''}`, children: [ring ? _jsx(DayRing, { colors: colors }) : null, _jsx("span", { className: "vac-cal__digit", children: day })] }));
}
function DayMarks({ items, compact }) {
    if (!items || items.length === 0)
        return null;
    if (compact) {
        const colors = [...new Set(items.map((item) => item.color))].slice(0, 4);
        return (_jsx("span", { className: "vac-cal__dots", "aria-hidden": true, children: colors.map((color) => _jsx("i", { style: { background: color } }, color)) }));
    }
    const shown = items.slice(0, 3);
    const rest = items.length - shown.length;
    return (_jsxs("span", { className: "vac-cal__marks", children: [shown.map((item) => (_jsxs("span", { className: "vac-cal__mark", title: item.kindLabel, children: [_jsx("i", { style: { background: item.color }, "aria-hidden": true }), _jsx("span", { children: item.label })] }, `${item.employeeId}-${item.kindLabel}`))), rest > 0 ? _jsxs("span", { className: "vac-cal__mark-more", children: ["+", rest] }) : null] }));
}
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function measureCard(stage, card) {
    const stageRect = stage.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
        left: cardRect.left - stageRect.left,
        top: cardRect.top - stageRect.top,
        width: cardRect.width,
        height: cardRect.height,
    };
}
function measureStage(stage) {
    const stageRect = stage.getBoundingClientRect();
    return { left: 0, top: 0, width: stageRect.width, height: stageRect.height };
}
function MonthSheet({ year, monthIndex, marksByDay, selectedPeriod, onSelectDay, onStep, onBack, }) {
    const cells = monthCells(year, monthIndex);
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "vac-cal__month-bar", children: [_jsx("button", { type: "button", className: "vac-cal__back", onClick: onBack, children: "\u041A \u0433\u043E\u0434\u0443" }), _jsxs("h2", { className: "vac-cal__month-title", children: [VACATION_MONTH_NAMES[monthIndex], " ", year] }), _jsxs("div", { className: "vac-cal__month-nav", children: [_jsx("button", { type: "button", className: "vac-cal__step", "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446", onClick: () => onStep(-1), children: "\u2039" }), _jsx("button", { type: "button", className: "vac-cal__step", "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446", onClick: () => onStep(1), children: "\u203A" })] })] }), _jsxs("div", { className: "vac-cal__sheet", children: [WEEKDAYS.map((label, weekday) => (_jsx("div", { className: `vac-cal__wd vac-cal__wd--lg${weekday >= 5 ? ' vac-cal__wd--end' : ''}`, children: label }, label))), cells.map((day, index) => {
                        const weekend = day != null && vacationDayIsWeekendRu(year, monthIndex, day);
                        const today = day != null && isToday(year, monthIndex, day);
                        return (_jsxs(DayCell, { className: `vac-cal__cell vac-cal__cell--lg${day == null ? ' vac-cal__cell--empty' : ''}${weekend ? ' vac-cal__cell--weekend' : ''}${today ? ' vac-cal__cell--today' : ''}`, day: day, picked: day != null && periodEdge(monthIndex, day, selectedPeriod) === 'end', ranged: day != null && periodEdge(monthIndex, day, selectedPeriod) === 'mid', label: day == null ? '' : `${day} ${VACATION_MONTH_NAMES[monthIndex]} ${year}`, onSelect: () => {
                                if (day != null)
                                    onSelectDay(monthIndex, day);
                            }, children: [_jsx(DayNum, { year: year, monthIndex: monthIndex, day: day }), day != null ? _jsx(DayMarks, { items: marksByDay.get(`${monthIndex}-${day}`), compact: false }) : null] }, `${monthIndex}-${index}`));
                    })] })] }));
}
export function VacationYearCalendar({ year = new Date().getFullYear(), marksByDay = new Map(), openToken = 0, requestedMonth = null, onMonthChange, selectedPeriod = null, onSelectDay, focusMonth = null, onOpenMonth, }) {
    const stageRef = useRef(null);
    const cardRefs = useRef([]);
    const frameRef = useRef(0);
    const [monthIndex, setMonthIndex] = useState(null);
    const [motion, setMotion] = useState(null);
    const [box, setBox] = useState(null);
    const [anim, setAnim] = useState(false);
    const motionRef = useRef(null);
    motionRef.current = motion;
    const onMonthChangeRef = useRef(onMonthChange);
    onMonthChangeRef.current = onMonthChange;
    const requestedMonthRef = useRef(requestedMonth);
    requestedMonthRef.current = requestedMonth;
    const openTokenSeen = useRef(openToken);
    const now = new Date();
    const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
    const yearRecede = motion === 'enter' || motion === 'opening' || motion === 'open';
    const [tip, setTip] = useState(null);
    const showDayTip = (month, day, anchor) => {
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
    const stepMonth = (delta) => {
        if (monthIndex == null)
            return;
        const next = (monthIndex + delta + 12) % 12;
        onMonthChangeRef.current?.(next);
        setMonthIndex(next);
    };
    const openMonth = (index) => {
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
    const onFlyEnd = (event) => {
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
    return (_jsxs("div", { className: "vac-cal-stage", ref: stageRef, children: [_jsx("section", { className: `vac-cal${yearRecede ? ' vac-cal--recede' : ''}`, "aria-label": `Календарь ${year}`, "aria-hidden": yearRecede, children: VACATION_MONTH_NAMES.map((name, index) => {
                    const cells = monthCells(year, index);
                    const source = monthIndex === index;
                    return (_jsxs("article", { ref: (node) => { cardRefs.current[index] = node; }, className: `vac-cal__month${index === currentMonth ? ' vac-cal__month--now' : ''}${index === focusMonth ? ' vac-cal__month--focus' : ''}${source ? ' is-source' : ''}`, onDoubleClick: () => (onOpenMonth ? onOpenMonth(index) : openMonth(index)), children: [_jsx("h2", { className: "vac-cal__name", children: name }), _jsxs("div", { className: "vac-cal__mini", children: [WEEKDAYS.map((label, weekday) => (_jsx("div", { className: `vac-cal__wd${weekday >= 5 ? ' vac-cal__wd--end' : ''}`, children: label }, label))), cells.map((day, cellIndex) => {
                                        const today = day != null && isToday(year, index, day);
                                        const away = day == null
                                            ? []
                                            : (marksByDay.get(`${index}-${day}`) ?? []).filter((mark) => !mark.kindLabel.startsWith('Опоздание'));
                                        const ringColors = [...new Set(away.map((mark) => mark.color))];
                                        const awayLabel = away.length === 0
                                            ? ''
                                            : `. В отпуске: ${away.map((mark) => mark.label).join(', ')}`;
                                        return (_jsx(DayCell, { className: `vac-cal__cell${today ? ' is-today' : ''}`, day: day, picked: day != null && periodEdge(index, day, selectedPeriod) === 'end', ranged: day != null && periodEdge(index, day, selectedPeriod) === 'mid', label: day == null ? '' : `${day} ${name} ${year}${awayLabel}`, onHover: day == null ? undefined : (anchor) => showDayTip(index, day, anchor), onSelect: () => {
                                                if (day != null)
                                                    onSelectDay?.(index, day);
                                            }, children: _jsx(DayNum, { year: year, monthIndex: index, day: day, colors: ringColors }) }, `${index}-${cellIndex}`));
                                    })] })] }, name));
                }) }), monthIndex != null && box ? (_jsx("section", { className: flyClass, style: { left: box.left, top: box.top, width: box.width, height: box.height }, "aria-label": `${VACATION_MONTH_NAMES[monthIndex]} ${year}`, onTransitionEnd: onFlyEnd, children: _jsx(MonthSheet, { year: year, monthIndex: monthIndex, marksByDay: marksByDay, selectedPeriod: selectedPeriod, onSelectDay: (month, day) => onSelectDay?.(month, day), onStep: stepMonth, onBack: closeMonth }) })) : null, tip ? (_jsxs("div", { className: `vac-cal__tip${tip.below ? ' vac-cal__tip--below' : ''}`, style: { left: tip.left, top: tip.top }, role: "tooltip", children: [_jsx("p", { className: "vac-cal__tip-date", children: tip.date }), _jsx("ul", { children: tip.people.map((person) => (_jsxs("li", { children: [_jsx("i", { style: { background: person.color }, "aria-hidden": true }), _jsx("span", { children: person.label }), _jsx("em", { children: person.kindLabel })] }, `${person.employeeId}-${person.kindLabel}`))) })] })) : null] }));
}
