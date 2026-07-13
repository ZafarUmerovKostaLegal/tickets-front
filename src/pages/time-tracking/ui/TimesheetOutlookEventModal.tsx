import { useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    buildCallJoinLinkList,
    hasAnyJoinLink,
    mapGraphEventToCallEvent,
} from '@entities/call-schedule';
import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
import {
    calendarEventDurationHours,
    formatCalendarEventTime,
} from '@entities/todo/lib/calendarEventHelpers';
import { joinLabelWithoutOpenPrefix, translateJoinLabel } from '@pages/call-schedule/lib/callJoinLabels';
import { formatHoursClockFromDecimalHours } from '@shared/lib/formatTrackingHours';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';

type TimesheetOutlookEventModalProps = {
    event: CalendarEvent;
    day: Date;
    addBlocked?: boolean;
    addBlockedTitle?: string;
    onClose: () => void;
    onAddTime: () => void;
};

export function TimesheetOutlookEventModal({
    event,
    day,
    addBlocked = false,
    addBlockedTitle,
    onClose,
    onAddTime,
}: TimesheetOutlookEventModalProps) {
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
                className="tsp-m tsp-m--outlook-ev"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="tsp-m__head">
                    <h3 id={titleId} className="tsp-m__title">{subject}</h3>
                    <button type="button" className="tsp-m__x" onClick={onClose} aria-label={t('timeTrackingPage.close')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="tsp-m__body tsp-m__body--outlook-ev">
                    <dl className="tsp-outlook-ev__meta">
                        <div className="tsp-outlook-ev__row">
                            <dt>{t('timeTrackingPage.timesheet.outlookEventDate')}</dt>
                            <dd>{dayLabel}</dd>
                        </div>
                        {timeRange ? (
                            <div className="tsp-outlook-ev__row">
                                <dt>{t('timeTrackingPage.timesheet.outlookEventTime')}</dt>
                                <dd>{timeRange}</dd>
                            </div>
                        ) : null}
                        <div className="tsp-outlook-ev__row">
                            <dt>{t('timeTrackingPage.timesheet.outlookEventDuration')}</dt>
                            <dd>{durationLabel}</dd>
                        </div>
                        <div className="tsp-outlook-ev__row">
                            <dt>{t('timeTrackingPage.timesheet.outlookEventTask')}</dt>
                            <dd>{t('timeTrackingPage.timesheet.outlookEventTaskValue')}</dd>
                        </div>
                        {joinRows.length > 0 ? (
                            <div className="tsp-outlook-ev__row tsp-outlook-ev__row--block">
                                <dt>{t('callSchedulePage.labelJoinLinks')}</dt>
                                <dd className="tsp-outlook-ev__joins">
                                    {joinRows.map((row) => {
                                        const safe = sanitizeHttpsWebUrl(row.url);
                                        return safe ? (
                                            <a
                                                key={row.key}
                                                className={`csched-modal__join ${row.className}`}
                                                href={safe}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {translateJoinLabel(row, t)}
                                            </a>
                                        ) : (
                                            <span
                                                key={row.key}
                                                className="csched-modal__join csched-modal__join--unsafe"
                                                title={t('callSchedulePage.linkUnsafeTitle')}
                                            >
                                                {joinLabelWithoutOpenPrefix(row, t)}
                                                {' '}
                                                {t('callSchedulePage.linkUnavailable')}
                                            </span>
                                        );
                                    })}
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                    {bodyText ? (
                        <p className="tsp-outlook-ev__body">{bodyText}</p>
                    ) : null}
                    <p className="tsp-m__hint tsp-m__hint--outlook">
                        {t('timeTrackingPage.timesheet.outlookEventAddHint')}
                    </p>
                </div>
                <div className="tsp-m__foot">
                    <button type="button" className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>
                        {t('timeTrackingPage.close')}
                    </button>
                    <button
                        type="button"
                        className="tsp-m__btn tsp-m__btn--ok"
                        onClick={onAddTime}
                        disabled={addBlocked}
                        title={addBlocked ? addBlockedTitle : undefined}
                    >
                        {t('timeTrackingPage.timesheet.addTime')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
