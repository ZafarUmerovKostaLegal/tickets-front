import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
function weekdayLabel(year, monthIndex, day) {
    return WEEKDAYS[(new Date(year, monthIndex, day).getDay() + 6) % 7];
}
export function VacationDayDetails({ year, monthIndex, day, endMonthIndex = monthIndex, endDay = day, rows, onClose, onOpenCard, onOpenDocs, showDocs }) {
    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const startSerial = monthIndex * 40 + day;
    const endSerial = endMonthIndex * 40 + endDay;
    const fromMonth = startSerial <= endSerial ? monthIndex : endMonthIndex;
    const fromDay = startSerial <= endSerial ? day : endDay;
    const toMonth = startSerial <= endSerial ? endMonthIndex : monthIndex;
    const toDay = startSerial <= endSerial ? endDay : day;
    const sameDay = fromMonth === toMonth && fromDay === toDay;
    const title = sameDay
        ? `${day} ${VACATION_MONTH_NAMES[monthIndex]} ${year}`
        : fromMonth === toMonth
            ? `${fromDay}–${toDay} ${VACATION_MONTH_NAMES[fromMonth]} ${year}`
            : `${fromDay} ${VACATION_MONTH_NAMES[fromMonth]} – ${toDay} ${VACATION_MONTH_NAMES[toMonth]} ${year}`;
    return (_jsxs("section", { className: "vac-day", "aria-label": "\u0414\u0435\u0442\u0430\u043B\u0438 \u0434\u043D\u044F", children: [_jsxs("header", { className: "vac-day__head", children: [_jsxs("div", { children: [_jsx("p", { className: "vac-day__kicker", children: sameDay ? weekdayLabel(year, fromMonth, fromDay) : 'Период' }), _jsx("h2", { className: "vac-day__title", children: title }), sameDay ? _jsx("p", { className: "vac-day__hint", children: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0432\u0442\u043E\u0440\u043E\u0439 \u0434\u0435\u043D\u044C, \u0447\u0442\u043E\u0431\u044B \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u0435\u0440\u0438\u043E\u0434" }) : null] }), _jsx("button", { type: "button", className: "vac-day__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), rows.length === 0 ? (_jsx("p", { className: "vac-day__empty", children: "\u0412 \u044D\u0442\u043E\u0442 \u0434\u0435\u043D\u044C \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0439 \u043D\u0435\u0442." })) : (_jsxs(_Fragment, { children: [_jsx("h3", { className: "vac-day__events", children: "\u0421\u043E\u0431\u044B\u0442\u0438\u044F" }), _jsx("ul", { className: "vac-day__list", children: rows.map((row) => (_jsxs("li", { className: "vac-day__item", children: [_jsx("span", { className: "vac-day__dot", style: { background: row.color }, "aria-hidden": true }), _jsxs("div", { className: "vac-day__copy", children: [_jsx("strong", { children: row.label }), _jsx("span", { children: row.rangeLabel }), row.canOpenCard ? (_jsxs("span", { className: "vac-day__links", children: [_jsx("button", { type: "button", onClick: () => onOpenCard(row.employeeId), children: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430" }), showDocs && row.allowDocs !== false ? (_jsx("button", { type: "button", onClick: () => onOpenDocs(row.employeeId, row.label), children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B" })) : null] })) : null] }), _jsx("span", { className: "vac-day__badge", style: { color: row.color, background: `color-mix(in srgb, ${row.color} 14%, #fff)` }, children: row.kindLabel })] }, `${row.employeeId}-${row.kindLabel}`))) })] }))] }));
}
