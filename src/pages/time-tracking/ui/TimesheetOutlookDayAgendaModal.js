import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { calendarEventStartMs, formatCalendarEventCellLabel, formatCalendarEventTime, } from '@entities/todo/lib/calendarEventHelpers';
import { displayOutlookCalendarLabel } from '@shared/ui/outlookCalendarSelectUtils';
import { outlookCalendarAccentColor, outlookCalendarAccentStyle } from '@shared/ui/outlookCalendarColors';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
export function TimesheetOutlookDayAgendaModal({ day, events, isAllCalendars, calendarColorOrder, calendarNameFor, onClose, onSelectEvent, }) {
    const { t, locale } = useI18n();
    const titleId = useId();
    const dayLabel = day.toLocaleDateString(localeTag(locale), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const sorted = [...events].sort((a, b) => calendarEventStartMs(a) - calendarEventStartMs(b));
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);
    if (typeof document === 'undefined')
        return null;
    return createPortal(_jsx("div", { className: "tsp-ov", onClick: onClose, children: _jsxs("div", { className: "tsp-m tsp-m--outlook-agenda", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tsp-m__head", children: [_jsx("h3", { id: titleId, className: "tsp-m__title", children: dayLabel }), _jsx("button", { type: "button", className: "tsp-m__x", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tsp-m__body tsp-m__body--outlook-agenda", children: [_jsx("p", { className: "tsp-outlook-agenda__meta", children: t('timeTrackingPage.timesheet.outlookDayAgendaCount').replace('{count}', String(sorted.length)) }), _jsx("ul", { className: "tsp-outlook-agenda__list", children: sorted.map((ev) => {
                                const { time, subject } = formatCalendarEventCellLabel(ev);
                                const fullTime = formatCalendarEventTime(ev);
                                const tinted = isAllCalendars;
                                const accent = tinted
                                    ? outlookCalendarAccentColor(ev.calendarId ?? 'default', calendarColorOrder)
                                    : null;
                                const calLabel = tinted && ev.calendarId
                                    ? calendarNameFor(ev.calendarId)
                                    : '';
                                return (_jsx("li", { children: _jsxs("button", { type: "button", className: `tsp-outlook-agenda__row${tinted ? ' tsp-outlook-agenda__row--tinted' : ''}`, style: accent ? outlookCalendarAccentStyle(accent) : undefined, onClick: () => onSelectEvent(ev), children: [_jsx("span", { className: "tsp-outlook-agenda__time", children: time || fullTime || t('timeTrackingPage.timesheet.outlookAllDay') }), _jsxs("span", { className: "tsp-outlook-agenda__main", children: [_jsx("span", { className: "tsp-outlook-agenda__subject", children: subject }), calLabel ? (_jsx("span", { className: "tsp-outlook-agenda__cal", children: calLabel })) : null] })] }) }, `${ev.calendarId ?? 'default'}-${ev.id}`));
                            }) })] }), _jsx("div", { className: "tsp-m__foot", children: _jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--ok", onClick: onClose, children: t('timeTrackingPage.close') }) })] }) }), document.body);
}
export function resolveOutlookCalendarDisplayName(calendarId, calendars, defaultLabel) {
    if (calendarId === 'default')
        return defaultLabel;
    const match = calendars.find((c) => c.id === calendarId);
    return match ? displayOutlookCalendarLabel(match.name) : calendarId;
}
