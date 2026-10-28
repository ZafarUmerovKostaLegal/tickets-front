import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { entryBaseDurationSeconds, useRunningTimerLiveSeconds, } from './timesheetLiveTimer';
function formatClockFromMs(totalMs) {
    if (!Number.isFinite(totalMs) || totalMs < 0)
        return '0:00:00';
    const s = Math.max(0, Math.floor(totalMs / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function TimesheetEntryRowTime({ entry, isRunning, runningTimer, fmtHours, }) {
    const liveExtraSec = useRunningTimerLiveSeconds(isRunning ? runningTimer : null);
    if (isRunning) {
        const liveSec = entryBaseDurationSeconds(entry) + liveExtraSec;
        return _jsx("span", { className: "tsp__row-h", children: formatClockFromMs(liveSec * 1000) });
    }
    return _jsx("span", { className: "tsp__row-h", children: fmtHours(entry.hours) });
}
export const TimesheetEntryRow = memo(function TimesheetEntryRow({ entry: e, runningTimer, rowReportingBlocked, isColleagueTimesheetView, fmtHours, t, onStart, onEdit, onCopy, onDelete, }) {
    const isRun = runningTimer?.entryId === e.id;
    const voidLocked = Boolean(e.isVoided);
    const voidRowClass = e.isVoided
        ? (e.voidKind === 'reallocated' ? ' tsp__row--void-realloc' : ' tsp__row--void-reject')
        : '';
    const weekClosedTitle = t('timeTrackingPage.timesheet.weekClosedRow');
    return (_jsxs("div", { className: `tsp__row${isRun ? ' tsp__row--run' : ''}${rowReportingBlocked ? ' tsp__row--week-closed' : ''}${voidRowClass}`, children: [_jsx("span", { className: "tsp__row-bar", style: { background: e.color } }), _jsxs("div", { className: "tsp__row-txt", children: [_jsxs("p", { className: "tsp__row-proj", children: [_jsx("strong", { children: e.project.trim() || e.task.trim() || t('timeTrackingPage.timesheet.noProject') }), e.client.trim() ? _jsxs("span", { className: "tsp__row-client", children: ["(", e.client, ")"] }) : null, !e.billable && _jsx("span", { className: "tsp__row-nb", children: "Non-billable" }), e.isVoided
                                ? (_jsx("span", { className: "tsp__row-void-badge", title: t('timeTrackingPage.timesheet.voidLocked'), children: e.voidKind === 'reallocated' ? t('timeTrackingPage.timesheet.voidBadgeRealloc') : t('timeTrackingPage.timesheet.voidBadgeReject') }))
                                : null] }), e.project.trim() && e.task.trim() ? _jsx("p", { className: "tsp__row-task", children: e.task }) : null, e.notes && _jsx("p", { className: "tsp__row-notes", children: e.notes })] }), _jsxs("div", { className: "tsp__row-acts", children: [_jsx(TimesheetEntryRowTime, { entry: e, isRunning: isRun, runningTimer: runningTimer, fmtHours: fmtHours }), _jsx("button", { type: "button", className: `tsp__row-start${isRun ? ' tsp__row-start--stop' : ''}`, disabled: isColleagueTimesheetView || rowReportingBlocked || voidLocked, title: isColleagueTimesheetView
                            ? t('timeTrackingPage.timesheet.timerOwnSheetOnly')
                            : voidLocked
                                ? t('timeTrackingPage.timesheet.voidLocked')
                                : rowReportingBlocked
                                    ? t('timeTrackingPage.timesheet.weekClosedTimer')
                                    : undefined, onClick: () => void onStart(e), children: isRun
                            ? _jsxs(_Fragment, { children: [_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2" }) }), t('timeTrackingPage.timesheet.timerStop')] })
                            : _jsxs(_Fragment, { children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M10 9l5 3-5 3V9z", fill: "currentColor", stroke: "none" })] }), t('timeTrackingPage.timesheet.timerStart')] }) }), _jsx("button", { type: "button", className: "tsp__row-edit", onClick: () => void onEdit(e), title: voidLocked ? t('timeTrackingPage.timesheet.voidEditBlocked') : rowReportingBlocked ? weekClosedTitle : t('timeTrackingPage.timesheet.editEntry'), disabled: rowReportingBlocked || voidLocked, children: t('timeTrackingPage.edit') }), _jsx("button", { type: "button", className: "tsp__row-copy", onClick: () => void onCopy(e), "aria-label": t('timeTrackingPage.timesheet.copyEntry'), title: e.notes.trim() ? t('timeTrackingPage.timesheet.copyEntry') : t('timeTrackingPage.timesheet.copyEntryEmpty'), disabled: !e.notes.trim(), children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }), _jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })] }) }), _jsx("button", { className: "tsp__row-del", onClick: () => onDelete(e), "aria-label": t('timeTrackingPage.delete'), title: voidLocked ? t('timeTrackingPage.timesheet.voidLocked') : rowReportingBlocked ? t('timeTrackingPage.timesheet.weekClosedDelete') : t('timeTrackingPage.timesheet.deleteEntry'), disabled: rowReportingBlocked || voidLocked, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" })] }) })] })] }));
});
