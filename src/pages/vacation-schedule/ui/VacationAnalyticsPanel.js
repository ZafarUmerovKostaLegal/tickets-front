import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { listTimeTrackingTeams } from '@entities/time-tracking';
import { getVacationRosterHidden, listVacationAbsenceDays, listVacationLeaveRequests, listVacationScheduleEmployees, } from '@entities/vacation';
import { buildVacationAnalytics, formatAnalyticsRange, } from '../lib/vacationAnalytics';
import { absenceKindToUi } from '../lib/vacationScheduleModel';
import './VacationAnalyticsPanel.css';
function ruCount(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11)
        return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return few;
    return many;
}
function todayIso() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}
function todayLabel() {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date());
}
function teamMemberIds(team) {
    return new Set([team.partner_auth_user_id, ...team.member_auth_user_ids].filter((id) => id > 0));
}
function toPeople(employees, teams, hiddenUsers, hiddenEmployees) {
    const active = teams
        .filter((team) => !team.is_archived)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    const people = [];
    for (const employee of employees) {
        if (employee.id <= 0)
            continue;
        const authId = employee.auth_user_id;
        if (authId != null && hiddenUsers.has(authId))
            continue;
        if (authId == null && hiddenEmployees.has(employee.id))
            continue;
        const team = authId == null ? undefined : active.find((item) => teamMemberIds(item).has(authId));
        people.push({
            id: employee.id,
            name: employee.full_name.trim() || 'Сотрудник',
            teamId: team?.id ?? 'none',
            teamName: team?.name ?? 'Без команды',
            authUserId: authId,
        });
    }
    return people;
}
function toAbsences(days) {
    const out = [];
    for (const day of days) {
        const kind = absenceKindToUi(day.kind, day.kind_code);
        if (kind !== 'annual' && kind !== 'sick' && kind !== 'dayoff')
            continue;
        out.push({
            personId: day.employee_id,
            iso: day.absence_on.slice(0, 10),
            kind,
        });
    }
    return out;
}
const BOOKED_LEAVE_STATUSES = new Set(['pending', 'pending_final', 'approved']);
function toBookedLeaves(requests) {
    return requests
        .filter((request) => request.kind === 'annual_vacation' && BOOKED_LEAVE_STATUSES.has(request.status))
        .map((request) => ({
        authUserId: request.employee_user_id,
        from: request.date_from.slice(0, 10),
        to: request.date_to.slice(0, 10),
    }));
}
function heatStyle(percent, over) {
    if (percent <= 0)
        return undefined;
    const mix = Math.min(100, Math.round(percent * 300) + 12);
    const tone = over ? '#e11d48' : 'var(--app-accent, #4f46e5)';
    return {
        background: `color-mix(in srgb, ${tone} ${mix}%, var(--app-surface, #fff))`,
        color: percent > 0.18 || over ? '#fff' : 'var(--app-text, #0f172a)',
    };
}
export function VacationAnalyticsPanel({ year, onYearChange }) {
    const [people, setPeople] = useState(null);
    const [days, setDays] = useState([]);
    const [bookedLeaves, setBookedLeaves] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setPeople(null);
        setError(null);
        void Promise.all([
            listVacationScheduleEmployees(year),
            listTimeTrackingTeams().catch(() => []),
            listVacationAbsenceDays(year),
            getVacationRosterHidden().catch(() => ({ authUserIds: [], employeeIds: [] })),
            listVacationLeaveRequests({ scope: 'all', status: 'any' }).catch(() => []),
        ])
            .then(([employees, teams, absences, hidden, requests]) => {
            if (cancelled)
                return;
            setPeople(toPeople(employees, teams, new Set(hidden.authUserIds), new Set(hidden.employeeIds)));
            setDays(toAbsences(absences));
            setBookedLeaves(toBookedLeaves(requests));
        })
            .catch((err) => {
            if (cancelled)
                return;
            setPeople([]);
            setDays([]);
            setError(err instanceof Error ? err.message : 'Не удалось собрать анализ');
        });
        return () => {
            cancelled = true;
        };
    }, [year]);
    const report = useMemo(() => {
        if (!people)
            return null;
        return buildVacationAnalytics({
            year,
            todayIso: todayIso(),
            people,
            days,
            teamLimitPercent: 40,
            quotaWorkingDays: 21,
            bookedLeaves,
        });
    }, [bookedLeaves, days, people, year]);
    const stepYear = (delta) => {
        onYearChange(Math.min(2100, Math.max(2000, year + delta)));
    };
    return (_jsxs("section", { className: "vac-an", "aria-label": `Анализ отпусков ${year}`, children: [_jsxs("div", { className: "vac-an__head", children: [_jsxs("div", { children: [_jsxs("h2", { children: ["\u0410\u043D\u0430\u043B\u0438\u0437 \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432 ", year] }), _jsx("p", { children: report
                                    ? `${report.employeeCount} ${ruCount(report.employeeCount, 'сотрудник', 'сотрудника', 'сотрудников')} · ${report.teamCount} ${ruCount(report.teamCount, 'команда', 'команды', 'команд')} · данные на ${todayLabel()}`
                                    : 'Собираем график и команды…' })] }), _jsxs("div", { className: "vac-an__year", children: [_jsx("button", { type: "button", onClick: () => stepYear(-1), "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u0433\u043E\u0434", children: "\u2039" }), _jsx("span", { children: year }), _jsx("button", { type: "button", onClick: () => stepYear(1), "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0433\u043E\u0434", children: "\u203A" })] })] }), error ? _jsx("p", { className: "vac-an__error", children: error }) : null, !report ? _jsx("p", { className: "vac-an__wait", children: "\u0421\u0447\u0438\u0442\u0430\u0435\u043C \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C\u2026" }) : _jsx(AnalyticsBody, { report: report })] }));
}
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function formatConflictRange(range) {
    const span = formatAnalyticsRange(range.from, range.to);
    if (range.kind === 'sick')
        return `больничный ${span}`;
    if (range.kind === 'dayoff')
        return `неоплачиваемый ${span}`;
    return span;
}
const VACATION_QUOTA_DAYS = 21;
function AnalyticsBody({ report }) {
    const [employeeQuery, setEmployeeQuery] = useState('');
    const conflictPreview = report.conflicts.slice(0, 8);
    const needle = employeeQuery.trim().toLocaleLowerCase('ru');
    const employees = needle
        ? report.employees.filter((row) => row.name.toLocaleLowerCase('ru').includes(needle))
        : report.employees;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "vac-an__kpis", children: [_jsxs("article", { children: [_jsx("b", { children: report.vacationWorkingDays }), _jsx("span", { children: "\u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u043E\u0442\u043F\u0443\u0441\u043A\u0430" })] }), _jsxs("article", { children: [_jsx("b", { children: report.averageVacation.toFixed(1) }), _jsxs("span", { children: ["\u0432 \u0441\u0440\u0435\u0434\u043D\u0435\u043C \u043D\u0430 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430, \u043D\u043E\u0440\u043C\u0430 ", VACATION_QUOTA_DAYS, " \u0434\u043D."] })] }), _jsxs("article", { children: [_jsx("b", { className: report.conflicts.length > 0 ? 'is-bad' : undefined, children: report.conflicts.length }), _jsxs("span", { children: [ruCount(report.conflicts.length, 'период', 'периода', 'периодов'), " \u0432\u044B\u0448\u0435 \u043B\u0438\u043C\u0438\u0442\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u044B"] })] }), _jsxs("article", { children: [_jsx("b", { children: report.withoutVacation }), _jsxs("span", { children: [ruCount(report.withoutVacation, 'сотрудник', 'сотрудника', 'сотрудников'), " \u0431\u0435\u0437 \u043E\u0442\u043F\u0443\u0441\u043A\u0430"] })] }), _jsxs("article", { children: [_jsx("b", { children: report.sickWorkingDays }), _jsx("span", { children: "\u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u0431\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u044B\u0445" })] })] }), _jsxs("section", { className: "vac-an__card", children: [_jsx("h3", { children: "\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u043E \u043C\u0435\u0441\u044F\u0446\u0430\u043C" }), _jsx("p", { children: "\u0414\u043E\u043B\u044F \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u0432\u043D\u0435 \u043E\u0444\u0438\u0441\u0430: \u043E\u0442\u043F\u0443\u0441\u043A, \u0431\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u044B\u0439 \u0438 \u043D\u0435\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0439. \u041A\u0440\u0430\u0441\u043D\u044B\u043C \u2014 \u043C\u0435\u0441\u044F\u0446, \u0433\u0434\u0435 \u0432 \u0441\u0440\u0435\u0434\u043D\u0435\u043C \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 40% \u043A\u043E\u043C\u0430\u043D\u0434\u044B." }), _jsx("div", { className: "vac-an__heat-scroll", children: _jsxs("div", { className: "vac-an__heat", children: [_jsx("div", {}), MONTHS.map((month) => _jsx("div", { className: "vac-an__heat-h", children: month }, month)), report.heatmap.map((row) => (_jsxs("div", { className: "vac-an__heat-row", children: [_jsx("div", { className: "vac-an__heat-name", children: row.teamName }), row.months.map((cell, index) => (_jsx("div", { className: "vac-an__heat-cell", style: heatStyle(cell.percent, cell.over), children: cell.percent > 0 ? `${Math.round(cell.percent * 100)}%` : '' }, MONTHS[index])))] }, row.teamId)))] }) })] }), _jsxs("div", { className: "vac-an__split", children: [_jsxs("section", { className: "vac-an__card", children: [_jsx("h3", { children: "\u041A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u044B \u043F\u043E \u043B\u0438\u043C\u0438\u0442\u0443" }), _jsx("p", { children: "\u0412 \u043A\u043E\u043C\u0430\u043D\u0434\u0435 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043B\u044E\u0434\u0435\u0439, \u0447\u0435\u043C \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u0435\u0442 \u043B\u0438\u043C\u0438\u0442." }), _jsx("ul", { children: conflictPreview.length === 0 ? _jsx("li", { children: _jsx("span", { children: "\u0422\u0430\u043A\u0438\u0445 \u043F\u0435\u0440\u0438\u043E\u0434\u043E\u0432 \u043D\u0435\u0442" }) }) : conflictPreview.map((conflict) => (_jsxs("li", { className: "vac-an__conflict", children: [_jsxs("div", { className: "vac-an__conflict-top", children: [_jsxs("span", { children: [conflict.teamName, ": ", formatAnalyticsRange(conflict.from, conflict.to)] }), _jsxs("b", { children: [conflict.max, " \u0438\u0437 ", conflict.size] })] }), _jsx("ul", { className: "vac-an__people", children: conflict.people.map((person) => (_jsxs("li", { children: [_jsx("span", { children: person.name }), _jsx("span", { children: person.ranges.map(formatConflictRange).join(', ') })] }, person.id))) })] }, `${conflict.teamId}-${conflict.from}`))) })] }), _jsxs("section", { className: "vac-an__card", children: [_jsx("h3", { children: "\u0413\u0434\u0435 \u043C\u043E\u0436\u043D\u043E \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043E\u0442\u043F\u0443\u0441\u043A" }), _jsx("p", { children: report.looksAhead ? 'Пять самых свободных недель до конца года.' : 'Пять самых свободных недель этого года.' }), _jsx("ul", { children: report.freeWeeks.length === 0 ? _jsx("li", { children: _jsx("span", { children: "\u0412 \u044D\u0442\u043E\u043C \u0433\u043E\u0434\u0443 \u043D\u0435\u0434\u0435\u043B\u044C \u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0435 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C" }) }) : report.freeWeeks.map((week) => (_jsxs("li", { children: [_jsx("span", { children: formatAnalyticsRange(week.from, week.to) }), _jsx("span", { children: week.personDays === 0 ? 'никто не отсутствует' : `${week.personDays} чел.-дн.` })] }, week.from))) })] })] }), _jsxs("section", { className: "vac-an__card", children: [_jsxs("div", { className: "vac-an__card-head", children: [_jsx("h3", { children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438" }), _jsxs("label", { className: "vac-an__search", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("line", { x1: "16.5", y1: "16.5", x2: "21", y2: "21" })] }), _jsx("input", { type: "search", value: employeeQuery, placeholder: "\u041D\u0430\u0439\u0442\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0443", onChange: (event) => setEmployeeQuery(event.target.value) })] })] }), _jsx("div", { className: "vac-an__table-scroll", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), _jsx("th", { children: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430" }), _jsx("th", { children: "\u041E\u0442\u043F\u0443\u0441\u043A" }), _jsx("th", { children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A" }), _jsx("th", { children: "\u0411\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u044B\u0439" }), _jsx("th", { children: "\u041D\u0435\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0439" }), _jsx("th", { children: "\u0417\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F" })] }) }), _jsxs("tbody", { children: [employees.length === 0 ? (_jsx("tr", { children: _jsx("td", { className: "vac-an__empty", colSpan: 7, children: "\u041D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" }) })) : null, employees.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.name }), _jsx("td", { children: row.teamName }), _jsxs("td", { children: [_jsx("span", { className: "vac-an__bar", "aria-hidden": true, children: _jsx("i", { style: { width: `${Math.min(100, row.vacationDays / VACATION_QUOTA_DAYS * 100)}%` } }) }), row.vacationDays, " \u0434\u043D."] }), _jsx("td", { className: row.remaining < 0 ? 'is-bad' : undefined, children: row.remaining }), _jsx("td", { children: row.sickDays }), _jsx("td", { children: row.dayOffDays }), _jsxs("td", { children: [row.noVacation ? _jsx("em", { className: "vac-an__tag is-warn", children: "\u043D\u0435 \u0437\u0430\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D" }) : null, row.shortBlock ? _jsx("em", { className: "vac-an__tag", children: "\u043D\u0435\u0442 14 \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u044B\u0445 \u0434\u043D." }) : null, row.overQuota ? _jsx("em", { className: "vac-an__tag is-warn", children: "\u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u043E\u0440\u043C\u044B" }) : null] })] }, row.id)))] })] }) })] })] }));
}
