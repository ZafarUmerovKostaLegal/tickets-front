import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    listPartnerConfirmationHistory,
    type PartnerConfirmationHistoryEvent,
} from '@entities/time-tracking/api/domains/partnerConfirmations';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import './ForReviewHistoryModal.css';

type Props = {
    requestId: string;
    title: string;
    nameOf: (userId: number | null | undefined) => string;
    onClose: () => void;
};

type Units = { day: string; hour: string; min: string };

function durationLabel(fromIso: string, toIso: string, units: Units): string {
    const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts: string[] = [];
    if (days)
        parts.push(`${days} ${units.day}`);
    if (hours)
        parts.push(`${hours} ${units.hour}`);
    if (!days && (mins || !hours))
        parts.push(`${mins} ${units.min}`);
    return parts.join(' ');
}

export function ForReviewHistoryModal({ requestId, title, nameOf, onClose }: Props) {
    const { t, locale } = useI18n();
    const [events, setEvents] = useState<PartnerConfirmationHistoryEvent[] | null>(null);
    const [error, setError] = useState('');
    const closeRef = useRef<HTMLButtonElement>(null);
    const tag = localeTag(locale === 'en' ? 'en' : 'ru');
    const units: Units = {
        day: t('timeTrackingPage.reports.forReview.history.unitDay'),
        hour: t('timeTrackingPage.reports.forReview.history.unitHour'),
        min: t('timeTrackingPage.reports.forReview.history.unitMin'),
    };

    useEffect(() => {
        let alive = true;
        listPartnerConfirmationHistory(requestId)
            .then((rows) => {
                if (alive)
                    setEvents(rows);
            })
            .catch((e: unknown) => {
                if (alive)
                    setError(e instanceof Error ? e.message : String(e));
            });
        return () => {
            alive = false;
        };
    }, [requestId]);

    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const when = (iso: string) => new Date(iso).toLocaleString(tag, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const priority = (value: string) => (value === 'red' || value === 'yellow' || value === 'green'
        ? t(`timeTrackingPage.reports.forReview.priority.${value}`)
        : value);
    const text = (event: PartnerConfirmationHistoryEvent): string => {
        const label = t(`timeTrackingPage.reports.forReview.history.kinds.${event.kind}`);
        if (event.kind === 'priority')
            return label.replace('{from}', priority(event.from)).replace('{to}', priority(event.to));
        if (event.kind === 'signed' || event.kind === 'unsigned')
            return label.replace('{name}', nameOf(Number(event.to) || null));
        return label;
    };
    const submittedAt = events?.find((event) => event.kind === 'submitted')?.at ?? null;
    const confirmedAt = [...(events ?? [])].reverse().find((event) => event.kind === 'confirmed')?.at ?? null;

    return createPortal(
        <div className="tt-frh" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
            <div className="tt-frh__panel" role="dialog" aria-modal="true" aria-labelledby="tt-frh-title">
                <header className="tt-frh__head">
                    <div>
                        <h2 id="tt-frh-title">{t('timeTrackingPage.reports.forReview.history.title')}</h2>
                        <p>{title}</p>
                    </div>
                    <button ref={closeRef} type="button" className="tt-frh__close" onClick={onClose} aria-label={t('timeTrackingPage.reports.forReview.history.close')}>×</button>
                </header>
                {submittedAt ? (
                    <p className="tt-frh__summary">
                        {confirmedAt
                            ? t('timeTrackingPage.reports.forReview.history.reviewTook').replace('{time}', durationLabel(submittedAt, confirmedAt, units))
                            : t('timeTrackingPage.reports.forReview.history.waiting').replace('{time}', durationLabel(submittedAt, new Date().toISOString(), units))}
                    </p>
                ) : null}
                {error ? <p className="tt-frh__error">{error}</p> : null}
                {events === null && !error ? <p className="tt-frh__muted">{t('timeTrackingPage.reports.forReview.history.loading')}</p> : null}
                {events?.length ? (
                    <ol className="tt-frh__list">
                        {events.map((event, index) => (
                            <li key={event.id} className={`tt-frh__item tt-frh__item--${event.kind}${event.kind === 'priority' ? ` tt-frh__item--to-${event.to}` : ''}`}>
                                <span className="tt-frh__dot" aria-hidden />
                                <div className="tt-frh__body">
                                    <strong>{text(event)}</strong>
                                    <span>
                                        {when(event.at)}
                                        {event.actorAuthUserId ? ` · ${nameOf(event.actorAuthUserId)}` : ` · ${t('timeTrackingPage.reports.forReview.history.system')}`}
                                        {index > 0 ? ` · ${t('timeTrackingPage.reports.forReview.history.after').replace('{time}', durationLabel(events[index - 1]!.at, event.at, units))}` : ''}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : null}
                {events?.some((event) => event.legacy) ? (
                    <p className="tt-frh__muted">{t('timeTrackingPage.reports.forReview.history.legacyNote')}</p>
                ) : null}
            </div>
        </div>,
        document.body,
    );
}
