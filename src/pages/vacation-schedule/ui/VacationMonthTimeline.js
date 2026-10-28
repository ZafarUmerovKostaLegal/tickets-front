import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export function VacationMonthTimeline({ year, monthIndex, daysInMonth, todayDay, people, selectedIds, bars, outCounts, pickedStart, pickedEnd, onPickRange, onToggle }) {
    const groups = [];
    for (const person of people) {
        const last = groups[groups.length - 1];
        if (!last || last.name !== person.teamName)
            groups.push({ name: person.teamName, people: [person] });
        else
            last.people.push(person);
    }
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    const selected = selectedIds.size > 0;
    const picked = (day) => pickedStart != null && pickedEnd != null && day >= pickedStart && day <= pickedEnd;
    return (_jsxs("div", { className: "vac-gantt", children: [_jsx("div", { className: "vac-gantt__scroll", children: _jsxs("div", { className: "vac-gantt__sheet", style: { ['--vac-days']: daysInMonth }, children: [_jsxs("div", { className: "vac-gantt__row vac-gantt__row--head", children: [_jsx("div", { className: "vac-gantt__name vac-gantt__name--head", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438" }), _jsxs("div", { className: "vac-gantt__track", children: [days.map((day) => (_jsxs("button", { type: "button", className: `vac-gantt__head-day${todayDay === day ? ' is-today' : ''}${picked(day) ? ' is-picked' : ''}`, onClick: () => onPickRange(day, day), children: [_jsx("b", { children: day }), _jsx("span", { children: WEEK[(new Date(year, monthIndex, day).getDay() + 6) % 7] })] }, day))), todayDay != null ? (_jsx("i", { className: "vac-gantt__today", style: { left: `${((todayDay - 0.5) / daysInMonth) * 100}%` } })) : null] })] }), groups.map((group) => (_jsxs("section", { children: [_jsxs("h3", { className: "vac-gantt__team", children: [group.name, " \u00B7 ", group.people.length] }), group.people.map((person) => {
                                    const on = !selected || selectedIds.has(person.id);
                                    const personBars = bars.filter((bar) => bar.employeeId === person.id);
                                    return (_jsxs("div", { className: `vac-gantt__row${on ? '' : ' is-off'}`, children: [_jsxs("button", { type: "button", className: "vac-gantt__name", "aria-pressed": selectedIds.has(person.id), onClick: () => onToggle(person), children: [_jsx("span", { className: `vac-gantt__check${selectedIds.has(person.id) || !selected ? ' is-on' : ''}`, "aria-hidden": true }), _jsx("span", { children: person.label })] }), _jsxs("div", { className: "vac-gantt__track", children: [days.map((day) => (_jsx("button", { type: "button", className: `vac-gantt__cell${todayDay === day ? ' is-today' : ''}${picked(day) ? ' is-picked' : ''}`, "aria-label": `${day}`, onClick: () => onPickRange(day, day) }, day))), personBars.map((bar) => (_jsx("span", { className: `vac-gantt__bar${bar.pending ? ' is-pending' : ''}${bar.remote ? ' is-remote' : ''}${bar.unpaid ? ' is-unpaid' : ''}${picked(bar.startDay) && picked(bar.endDay) ? ' is-picked' : ''}`, role: "button", tabIndex: 0, onClick: () => onPickRange(bar.startDay, bar.endDay), style: {
                                                            left: `${((bar.startDay - 1) / daysInMonth) * 100}%`,
                                                            width: `${((bar.endDay - bar.startDay + 1) / daysInMonth) * 100}%`,
                                                            background: bar.pending || bar.remote ? 'transparent' : bar.color,
                                                            color: bar.pending || bar.remote ? bar.color : '#fff',
                                                            borderColor: bar.color,
                                                        }, title: `${person.label}: ${bar.label}`, children: bar.label }, `${bar.employeeId}-${bar.startDay}-${bar.label}-${bar.pending}`))), todayDay != null ? (_jsx("i", { className: "vac-gantt__today", style: { left: `${((todayDay - 0.5) / daysInMonth) * 100}%` } })) : null] })] }, person.id));
                                })] }, group.name))), _jsxs("div", { className: "vac-gantt__row vac-gantt__row--sum", children: [_jsx("div", { className: "vac-gantt__name", children: "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442" }), _jsx("div", { className: "vac-gantt__track", children: days.map((day) => {
                                        const count = outCounts[day] ?? 0;
                                        return (_jsx("div", { className: `vac-gantt__sum${count >= 4 ? ' is-hot' : ''}${count === 0 ? ' is-empty' : ''}`, children: count > 0 ? count : '' }, day));
                                    }) })] })] }) }), _jsx("p", { className: "vac-gantt__note", children: "\u0421\u043F\u043B\u043E\u0448\u043D\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430 \u2014 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043E. \u041F\u0443\u043D\u043A\u0442\u0438\u0440 \u2014 \u0436\u0434\u0451\u0442 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F. \u041A\u0440\u0430\u0441\u043D\u0430\u044F \u0446\u0438\u0444\u0440\u0430 \u2014 \u0432 \u044D\u0442\u043E\u0442 \u0434\u0435\u043D\u044C \u043D\u0435\u0442 \u0447\u0435\u0442\u044B\u0440\u0451\u0445 \u0438 \u0431\u043E\u043B\u044C\u0448\u0435 \u0447\u0435\u043B\u043E\u0432\u0435\u043A." })] }));
}
