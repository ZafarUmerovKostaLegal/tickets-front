import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
import {
    calendarEventStartMs,
    formatCalendarEventCellLabel,
    formatCalendarEventTime,
} from '@entities/todo/lib/calendarEventHelpers';
import { displayOutlookCalendarLabel } from '@shared/ui/outlookCalendarSelectUtils';
import { outlookCalendarAccentColor, outlookCalendarAccentStyle } from '@shared/ui/outlookCalendarColors';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';

type CalendarNameLookup = (calendarId: string | undefined) => string;

type TimesheetOutlookDayAgendaModalProps = {
    day: Date;
    events: CalendarEvent[];
    isAllCalendars: boolean;
    calendarColorOrder: readonly string[];
    calendarNameFor: CalendarNameLookup;
    onClose: () => void;
    onSelectEvent: (event: CalendarEvent) => void;
};

export function TimesheetOutlookDayAgendaModal({
    day,
    events,
    isAllCalendars,
    calendarColorOrder,
    calendarNameFor,
    onClose,
    onSelectEvent,
}: TimesheetOutlookDayAgendaModalProps) {
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
        const onKey = (e: KeyboardEvent) => {
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

    return createPortal(
        <div className="tsp-ov" onClick={onClose}>
            <div
                className="tsp-m tsp-m--outlook-agenda"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="tsp-m__head">
                    <h3 id={titleId} className="tsp-m__title">{dayLabel}</h3>
                    <button type="button" className="tsp-m__x" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="tsp-m__body tsp-m__body--outlook-agenda">
                    <p className="tsp-outlook-agenda__meta">
                        {t('timeTrackingPage.timesheet.outlookDayAgendaCount').replace('{count}', String(sorted.length))}
                    </p>
                    <ul className="tsp-outlook-agenda__list">
                        {sorted.map((ev) => {
                            const { time, subject } = formatCalendarEventCellLabel(ev);
                            const fullTime = formatCalendarEventTime(ev);
                            const tinted = isAllCalendars;
                            const accent = tinted
                                ? outlookCalendarAccentColor(ev.calendarId ?? 'default', calendarColorOrder)
                                : null;
                            const calLabel = tinted && ev.calendarId
                                ? calendarNameFor(ev.calendarId)
                                : '';
                            return (
                                <li key={`${ev.calendarId ?? 'default'}-${ev.id}`}>
                                    <button
                                        type="button"
                                        className={`tsp-outlook-agenda__row${tinted ? ' tsp-outlook-agenda__row--tinted' : ''}`}
                                        style={accent ? outlookCalendarAccentStyle(accent) : undefined}
                                        onClick={() => onSelectEvent(ev)}
                                    >
                                        <span className="tsp-outlook-agenda__time">
                                            {time || fullTime || t('timeTrackingPage.timesheet.outlookAllDay')}
                                        </span>
                                        <span className="tsp-outlook-agenda__main">
                                            <span className="tsp-outlook-agenda__subject">{subject}</span>
                                            {calLabel ? (
                                                <span className="tsp-outlook-agenda__cal">{calLabel}</span>
                                            ) : null}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="tsp-m__foot">
                    <button type="button" className="tsp-m__btn tsp-m__btn--ok" onClick={onClose}>
                        {t('timeTrackingPage.close')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function resolveOutlookCalendarDisplayName(
    calendarId: string,
    calendars: readonly { id: string; name: string }[],
    defaultLabel: string,
): string {
    if (calendarId === 'default')
        return defaultLabel;
    const match = calendars.find((c) => c.id === calendarId);
    return match ? displayOutlookCalendarLabel(match.name) : calendarId;
}
