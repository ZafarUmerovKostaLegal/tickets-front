import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TimesheetEntryRow } from './TimesheetEntryRow';
export function TimesheetDayHeader({ group, isToday, dayTotal, addBlocked, dateTag, weekClosedTitle, fmtHours, t, onAdd, }) {
    return (_jsxs("div", { className: `tsp__ghd${isToday ? ' tsp__ghd--today' : ''}${addBlocked ? ' tsp__ghd--week-closed' : ''}`, children: [_jsxs("span", { className: "tsp__ghd-name", children: [group.date.toLocaleDateString(dateTag, { weekday: 'long', day: 'numeric', month: 'long' })
                        .replace(/^\w/, (c) => c.toUpperCase()), isToday ? _jsx("span", { className: "tsp__ghd-badge", children: t('timeTrackingPage.timesheet.today') }) : null] }), _jsx("span", { className: "tsp__ghd-total", children: fmtHours(dayTotal) }), _jsx("button", { type: "button", className: "tsp__ghd-add", onClick: () => onAdd(group.key), "aria-label": t('timeTrackingPage.add'), disabled: addBlocked, title: addBlocked ? weekClosedTitle : undefined, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }) })] }));
}
export function TimesheetDayFooter({ dayTotal, addBlocked, weekClosedTitle, fmtHours, t, onAdd, groupKey, }) {
    return (_jsxs("div", { className: "tsp__day-sum", children: [_jsxs("span", { className: "tsp__day-sum-r", children: [_jsx("span", { children: t('timeTrackingPage.timesheet.totalLabel') }), _jsx("span", { className: "tsp__day-sum-n", children: fmtHours(dayTotal) })] }), _jsxs("button", { type: "button", className: "tsp__day-sum-add", onClick: () => onAdd(groupKey), disabled: addBlocked, title: addBlocked ? weekClosedTitle : undefined, children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }), t('timeTrackingPage.timesheet.addTime')] })] }));
}
export function TimesheetEntryRowItem({ entry, handlers, }) {
    return (_jsx(TimesheetEntryRow, { entry: entry, runningTimer: handlers.runningTimer, rowReportingBlocked: handlers.rowReportingBlocked, isColleagueTimesheetView: handlers.isColleagueTimesheetView, fmtHours: handlers.fmtHours, t: handlers.t, onStart: handlers.onStart, onEdit: handlers.onEdit, onCopy: handlers.onCopy, onDelete: handlers.onDelete }));
}
export function TimesheetDayBlock({ group, isToday, dayTotal, addBlocked, showHeader, dateTag, weekClosedTitle, fmtHours, t, onAdd, entryRowHandlers, isRowBlocked, }) {
    const rowBlocked = isRowBlocked(group.key);
    return (_jsxs("div", { className: "tsp__day-block", "data-day": group.key, children: [showHeader ? (_jsx(TimesheetDayHeader, { group: group, isToday: isToday, dayTotal: dayTotal, addBlocked: addBlocked, dateTag: dateTag, weekClosedTitle: weekClosedTitle, fmtHours: fmtHours, t: t, onAdd: onAdd })) : null, group.rows.map((entry) => (_jsx(TimesheetEntryRowItem, { entry: entry, handlers: {
                    ...entryRowHandlers,
                    rowReportingBlocked: rowBlocked,
                } }, entry.id))), _jsx(TimesheetDayFooter, { dayTotal: dayTotal, addBlocked: addBlocked, weekClosedTitle: weekClosedTitle, fmtHours: fmtHours, t: t, onAdd: onAdd, groupKey: group.key })] }));
}
