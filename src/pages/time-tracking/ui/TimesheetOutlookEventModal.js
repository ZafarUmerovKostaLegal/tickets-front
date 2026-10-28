import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { buildCallJoinLinkList, hasAnyJoinLink, mapGraphEventToCallEvent, } from '@entities/call-schedule';
import { calendarEventDurationHours, formatCalendarEventTime, } from '@entities/todo/lib/calendarEventHelpers';
import { joinLabelWithoutOpenPrefix, translateJoinLabel } from '@pages/call-schedule/lib/callJoinLabels';
import { formatHoursClockFromDecimalHours } from '@shared/lib/formatTrackingHours';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
export function TimesheetOutlookEventModal({ event, day, addBlocked = false, addBlockedTitle, onClose, onAddTime, }) {
    const { t, locale } = useI18n();
    const titleId = useId();
    const subject = event.subject?.trim() || t('timeTrackingPage.timesheet.outlookEventFallback');
    const timeRange = formatCalendarEventTime(event);
    const durationHours = calendarEventDurationHours(event, day);
    const durationLabel = durationHours > 0
        ? formatHoursClockFromDecimalHours(durationHours)
        : '—';
    const dayLabel = day.toLocaleDateString(localeTag(locale), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    const callEvent = useMemo(() => mapGraphEventToCallEvent(event), [event]);
    const bodyText = callEvent?.description ?? '';
    const joinRows = callEvent && hasAnyJoinLink(callEvent) ? buildCallJoinLinkList(callEvent) : [];
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
    return createPortal(_jsx("div", { className: "tsp-ov", onClick: onClose, children: _jsxs("div", { className: "tsp-m tsp-m--outlook-ev", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tsp-m__head", children: [_jsx("h3", { id: titleId, className: "tsp-m__title", children: subject }), _jsx("button", { type: "button", className: "tsp-m__x", onClick: onClose, "aria-label": t('timeTrackingPage.close'), children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "tsp-m__body tsp-m__body--outlook-ev", children: [_jsxs("dl", { className: "tsp-outlook-ev__meta", children: [_jsxs("div", { className: "tsp-outlook-ev__row", children: [_jsx("dt", { children: t('timeTrackingPage.timesheet.outlookEventDate') }), _jsx("dd", { children: dayLabel })] }), timeRange ? (_jsxs("div", { className: "tsp-outlook-ev__row", children: [_jsx("dt", { children: t('timeTrackingPage.timesheet.outlookEventTime') }), _jsx("dd", { children: timeRange })] })) : null, _jsxs("div", { className: "tsp-outlook-ev__row", children: [_jsx("dt", { children: t('timeTrackingPage.timesheet.outlookEventDuration') }), _jsx("dd", { children: durationLabel })] }), _jsxs("div", { className: "tsp-outlook-ev__row", children: [_jsx("dt", { children: t('timeTrackingPage.timesheet.outlookEventTask') }), _jsx("dd", { children: t('timeTrackingPage.timesheet.outlookEventTaskValue') })] }), joinRows.length > 0 ? (_jsxs("div", { className: "tsp-outlook-ev__row tsp-outlook-ev__row--block", children: [_jsx("dt", { children: t('callSchedulePage.labelJoinLinks') }), _jsx("dd", { className: "tsp-outlook-ev__joins", children: joinRows.map((row) => {
                                                const safe = sanitizeHttpsWebUrl(row.url);
                                                return safe ? (_jsx("a", { className: `csched-modal__join ${row.className}`, href: safe, target: "_blank", rel: "noopener noreferrer", children: translateJoinLabel(row, t) }, row.key)) : (_jsxs("span", { className: "csched-modal__join csched-modal__join--unsafe", title: t('callSchedulePage.linkUnsafeTitle'), children: [joinLabelWithoutOpenPrefix(row, t), ' ', t('callSchedulePage.linkUnavailable')] }, row.key));
                                            }) })] })) : null] }), bodyText ? (_jsx("p", { className: "tsp-outlook-ev__body", children: bodyText })) : null, _jsx("p", { className: "tsp-m__hint tsp-m__hint--outlook", children: t('timeTrackingPage.timesheet.outlookEventAddHint') })] }), _jsxs("div", { className: "tsp-m__foot", children: [_jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--cancel", onClick: onClose, children: t('timeTrackingPage.close') }), _jsx("button", { type: "button", className: "tsp-m__btn tsp-m__btn--ok", onClick: onAddTime, disabled: addBlocked, title: addBlocked ? addBlockedTitle : undefined, children: t('timeTrackingPage.timesheet.addTime') })] })] }) }), document.body);
}
