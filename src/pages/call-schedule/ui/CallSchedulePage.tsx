import { useState, useCallback, useMemo, useEffect, useRef, useId, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    buildCallJoinLinkList,
    createCallScheduleEvent,
    getCallScheduleCalendars,
    getCallScheduleEvents,
    hasAnyJoinLink,
    CallScheduleApiError,
    type CallEvent,
} from '@entities/call-schedule';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import {
    eventCountLabel,
    fmtDuration,
    formatDateLong,
    localeTag,
    monthTitle,
    weekdayLabels,
} from '../lib/callScheduleFormat';
import { joinLabelWithoutOpenPrefix, translateJoinLabel } from '../lib/callJoinLabels';
import { CallScheduleCalendarSelect, CschedCalendarBlockSkeleton, isKostaCalendarName } from './CallScheduleCalendarSelect';
import './CallSchedulePage.css';
function pad2(n: number): string {
    return String(n).padStart(2, '0');
}
function toIso(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function sameYmd(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date): boolean {
    return sameYmd(d, new Date());
}
function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function buildMonthWeeks(anchorMonth: Date): {
    d: Date;
    inMonth: boolean;
}[][] {
    const viewY = anchorMonth.getFullYear();
    const viewM = anchorMonth.getMonth();
    const first = new Date(viewY, viewM, 1);
    const padStart = (first.getDay() + 6) % 7;
    const start = new Date(viewY, viewM, 1 - padStart);
    const weeks: {
        d: Date;
        inMonth: boolean;
    }[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 6; w++) {
        const row: {
            d: Date;
            inMonth: boolean;
        }[] = [];
        for (let i = 0; i < 7; i++) {
            row.push({ d: new Date(cur), inMonth: cur.getMonth() === viewM });
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(row);
    }
    return weeks;
}
const MONTH_CELL_EVENT_CAP = 2;
function CallEventDetailModal({ event, onClose }: {
    event: CallEvent;
    onClose: () => void;
}) {
    const { t, locale } = useI18n();
    const uid = useId();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(<div className="csched-modal-overlay" role="presentation">
      <div className="csched-modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-call-title`} onClick={(e) => e.stopPropagation()}>
        <div className="csched-modal__head">
          <h2 id={`${uid}-call-title`} className="csched-modal__title">
            {event.title}
          </h2>
          <button type="button" className="csched-modal__close" onClick={onClose} aria-label={t('callSchedulePage.closeAria')}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="csched-modal__body">
          <dl className="csched-modal__dl">
            <div className="csched-modal__row">
              <dt>{t('callSchedulePage.labelDate')}</dt>
              <dd>{formatDateLong(event.date, locale)}</dd>
            </div>
            <div className="csched-modal__row">
              <dt>{t('callSchedulePage.labelTime')}</dt>
              <dd>
                {event.time} <span className="csched-modal__muted">({fmtDuration(event.durationMin, t)})</span>
              </dd>
            </div>
            {event.client ? (<div className="csched-modal__row">
                <dt>{t('callSchedulePage.labelClient')}</dt>
                <dd>{event.client}</dd>
              </div>) : null}
            {event.participants && event.participants.length > 0 ? (<div className="csched-modal__row">
                <dt>{t('callSchedulePage.labelParticipants')}</dt>
                <dd>
                  <ul className="csched-modal__list">
                    {event.participants.map((p) => (<li key={p}>{p}</li>))}
                  </ul>
                </dd>
              </div>) : null}
            {event.description ? (<div className="csched-modal__row csched-modal__row--block">
                <dt>{t('callSchedulePage.labelDescription')}</dt>
                <dd className="csched-modal__desc">{event.description}</dd>
              </div>) : null}
            {hasAnyJoinLink(event) ? (<div className="csched-modal__row csched-modal__row--block">
                <dt>{t('callSchedulePage.labelJoinLinks')}</dt>
                <dd className="csched-modal__joins">
                  {buildCallJoinLinkList(event).map((row) => {
                const safe = sanitizeHttpsWebUrl(row.url);
                return safe ? (<a key={row.key} className={`csched-modal__join ${row.className}`} href={safe} target="_blank" rel="noopener noreferrer">
                        {translateJoinLabel(row, t)}
                      </a>) : (<span key={row.key} className="csched-modal__join csched-modal__join--unsafe" title={t('callSchedulePage.linkUnsafeTitle')}>
                        {joinLabelWithoutOpenPrefix(row, t)}
                        {' '}
                        {t('callSchedulePage.linkUnavailable')}
                      </span>);
            })}
                </dd>
              </div>) : null}
            {event.dialIn ? (<div className="csched-modal__row">
                <dt>{t('callSchedulePage.labelPhone')}</dt>
                <dd>{event.dialIn}</dd>
              </div>) : null}
          </dl>
        </div>
        <div className="csched-modal__foot">
          <button type="button" className="csched-modal__btn csched-modal__btn--primary" onClick={onClose}>
            {t('callSchedulePage.close')}
          </button>
        </div>
      </div>
    </div>, document.body);
}
function CallDayListModal({ dateIso, events, onClose, onSelectEvent, }: {
    dateIso: string;
    events: CallEvent[];
    onClose: () => void;
    onSelectEvent: (ev: CallEvent) => void;
}) {
    const { t, locale } = useI18n();
    const uid = useId();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(<div className="csched-modal-overlay" role="presentation">
      <div className="csched-modal csched-daylist" role="dialog" aria-modal="true" aria-labelledby={`${uid}-daylist`} onClick={(e) => e.stopPropagation()}>
        <div className="csched-modal__head">
          <h2 id={`${uid}-daylist`} className="csched-modal__title csched-daylist__title">
            {formatDateLong(dateIso, locale)}
          </h2>
          <button type="button" className="csched-modal__close" onClick={onClose} aria-label={t('callSchedulePage.closeAria')}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="csched-modal__body csched-daylist__body">
          <p className="csched-daylist__meta">{eventCountLabel(events.length, locale, t)}</p>
          <ul className="csched-daylist__list" role="list">
            {events.map((ev) => (<li key={ev.id} className="csched-daylist__item">
                <button type="button" className="csched-daylist__row" onClick={() => onSelectEvent(ev)}>
                  <span className="csched-daylist__time">{ev.time}</span>
                  <span className="csched-daylist__etitle">{ev.title}</span>
                </button>
              </li>))}
          </ul>
        </div>
        <div className="csched-modal__foot">
          <button type="button" className="csched-modal__btn csched-modal__btn--primary" onClick={onClose}>
            {t('callSchedulePage.close')}
          </button>
        </div>
      </div>
    </div>, document.body);
}
function CreateCallEventModal({ open, onClose, onCreated, initialDateIso, calendarId, }: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
    initialDateIso: string;
    calendarId: string;
}) {
    const { t } = useI18n();
    const formId = useId();
    const [subject, setSubject] = useState('');
    const [dateIso, setDateIso] = useState(initialDateIso);
    const [timeFrom, setTimeFrom] = useState('10:00');
    const [timeTo, setTimeTo] = useState('10:30');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    useEffect(() => {
        if (open) {
            setDateIso(initialDateIso);
            setFormError(null);
        }
    }, [open, initialDateIso]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving)
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, saving]);
    if (!open)
        return null;
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        const subj = subject.trim();
        if (!subj) {
            setFormError(t('callSchedulePage.errSubject'));
            return;
        }
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
        if (!m) {
            setFormError(t('callSchedulePage.errDate'));
            return;
        }
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const [fh, fm] = timeFrom.split(':').map((x) => Number(x));
        const [th, tm] = timeTo.split(':').map((x) => Number(x));
        if (![fh, fm, th, tm].every((n) => Number.isFinite(n))) {
            setFormError(t('callSchedulePage.errTime'));
            return;
        }
        const start = new Date(y, mo - 1, d, fh, fm, 0, 0);
        const end = new Date(y, mo - 1, d, th, tm, 0, 0);
        if (end.getTime() <= start.getTime()) {
            setFormError(t('callSchedulePage.errEndBeforeStart'));
            return;
        }
        setSaving(true);
        try {
            await createCallScheduleEvent({
                subject: subj,
                start: start.toISOString(),
                end: end.toISOString(),
                body: body.trim() || null,
                calendarId: calendarId === 'default' ? null : calendarId,
                timeZone: 'UTC',
            });
            onCreated();
            onClose();
        }
        catch (err) {
            const msg = err instanceof CallScheduleApiError ? err.message : t('callSchedulePage.errCreateEvent');
            setFormError(msg);
        }
        finally {
            setSaving(false);
        }
    };
    return createPortal(<div className="csched-modal-overlay" role="presentation">
      <div className="csched-modal csched-modal--form" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="csched-modal__head">
            <h2 id={`${formId}-title`} className="csched-modal__title">
              {t('callSchedulePage.newCallSlot')}
            </h2>
            <button type="button" className="csched-modal__close" onClick={onClose} aria-label={t('callSchedulePage.closeAria')} disabled={saving}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="csched-modal__body csched-form">
            {formError ? (<p className="csched-form__err" role="alert">
                {formError}
              </p>) : null}
            <label className="csched-form__field">
              <span className="csched-form__label">{t('callSchedulePage.formSubject')}</span>
              <input className="csched-form__input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500} required disabled={saving} placeholder={t('callSchedulePage.formSubjectPlaceholder')}/>
            </label>
            <label className="csched-form__field">
              <span className="csched-form__label">{t('callSchedulePage.formDate')}</span>
              <input className="csched-form__input" type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} required disabled={saving}/>
            </label>
            <div className="csched-form__row2">
              <label className="csched-form__field">
                <span className="csched-form__label">{t('callSchedulePage.formFrom')}</span>
                <input className="csched-form__input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} required disabled={saving}/>
              </label>
              <label className="csched-form__field">
                <span className="csched-form__label">{t('callSchedulePage.formTo')}</span>
                <input className="csched-form__input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} required disabled={saving}/>
              </label>
            </div>
            <label className="csched-form__field">
              <span className="csched-form__label">{t('callSchedulePage.formBody')}</span>
              <textarea className="csched-form__textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={3} disabled={saving} placeholder={t('callSchedulePage.formBodyPlaceholder')}/>
            </label>
          </div>
          <div className="csched-modal__foot">
            <button type="button" className="csched-modal__btn" onClick={onClose} disabled={saving}>
              {t('callSchedulePage.cancel')}
            </button>
            <button type="submit" className="csched-modal__btn csched-modal__btn--primary" disabled={saving}>
              {saving ? t('callSchedulePage.creating') : t('callSchedulePage.create')}
            </button>
          </div>
        </form>
      </div>
    </div>, document.body);
}
export function CallSchedulePage() {
    const { t, locale } = useI18n();
    const weekdays = useMemo(() => weekdayLabels(t), [t]);
    const now = new Date();
    const [anchorMonth, setAnchorMonth] = useState(() => startOfMonth(now));
    const [selected, setSelected] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const [detailEvent, setDetailEvent] = useState<CallEvent | null>(null);
    const [agendaForDay, setAgendaForDay] = useState<{
        dateIso: string;
        events: CallEvent[];
    } | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [calendarId, setCalendarId] = useState('default');
    const [calendars, setCalendars] = useState<{ id: string; name: string }[]>([]);
    const [calendarsLoading, setCalendarsLoading] = useState(true);
    const [calendarsError, setCalendarsError] = useState<string | null>(null);
    const [mailbox, setMailbox] = useState<string | null>(null);
    const [events, setEvents] = useState<CallEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    
    const applyKostaAsPrimaryOnceRef = useRef(true);
    const viewY = anchorMonth.getFullYear();
    const viewM = anchorMonth.getMonth();
    const weeks = useMemo(() => buildMonthWeeks(anchorMonth), [anchorMonth]);
    useEffect(() => {
        let live = true;
        setCalendarsLoading(true);
        (async () => {
            try {
                const c = await getCallScheduleCalendars();
                if (!live)
                    return;
                setMailbox(c.mailbox);
                const mapped = c.calendars.map((cal) => ({
                    id: String(cal.id),
                    name: (cal.name && String(cal.name).trim()) || String(cal.id),
                }));
                setCalendars(mapped);
                if (applyKostaAsPrimaryOnceRef.current) {
                    applyKostaAsPrimaryOnceRef.current = false;
                    const kosta = mapped.find((cal) => isKostaCalendarName(cal.name));
                    if (kosta)
                        setCalendarId(kosta.id);
                }
                setCalendarsError(null);
            }
            catch (e) {
                if (!live)
                    return;
                const msg = e instanceof CallScheduleApiError ? e.message : t('callSchedulePage.errLoadCalendars');
                setCalendarsError(msg);
            }
            finally {
                if (live)
                    setCalendarsLoading(false);
            }
        })();
        return () => {
            live = false;
        };
    }, [retryKey]);
    useEffect(() => {
        if (calendarsLoading || calendarsError)
            return;
        let live = true;
        (async () => {
            setEventsLoading(true);
            setEventsError(null);
            const start = new Date(viewY, viewM, 1, 0, 0, 0, 0);
            const end = new Date(viewY, viewM + 1, 1, 0, 0, 0, 0);
            try {
                const list = await getCallScheduleEvents({
                    start: start.toISOString(),
                    end: end.toISOString(),
                    calendarId,
                });
                if (!live)
                    return;
                setEvents(list);
            }
            catch (e) {
                if (!live)
                    return;
                const msg = e instanceof CallScheduleApiError ? e.message : t('callSchedulePage.errLoadEvents');
                setEvents([]);
                setEventsError(msg);
            }
            finally {
                if (live)
                    setEventsLoading(false);
            }
        })();
        return () => {
            live = false;
        };
    }, [viewY, viewM, calendarId, retryKey, calendarsLoading, calendarsError, t]);
    const eventsByDate = useMemo(() => {
        const m = new Map<string, CallEvent[]>();
        for (const e of events) {
            const list = m.get(e.date) ?? [];
            list.push(e);
            m.set(e.date, list);
        }
        for (const list of m.values()) {
            list.sort((a, b) => a.startMs - b.startMs);
        }
        return m;
    }, [events]);
    const goPrevMonth = useCallback(() => {
        setAnchorMonth((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
    }, []);
    const goNextMonth = useCallback(() => {
        setAnchorMonth((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
    }, []);
    const goToday = useCallback(() => {
        const t = new Date();
        setAnchorMonth(startOfMonth(t));
        setSelected(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    }, []);
    const miniWeeks = weeks;
    return (<div className="csched-page">
      <main className="csched-page__main">
        <header className="csched-page__header">
          <div className="csched-page__header-start">
            <AppBackButton className="app-back-btn" />
            <AppHomeLogo withSeparator />
            <div className="csched-page__header-text">
              <h1 className="csched-page__title">{t('callSchedulePage.title')}</h1>
              <p className="csched-page__subtitle">
                {mailbox
                ? (<>{t('callSchedulePage.subtitleMailboxPrefix')} <span className="csched-page__mono">{mailbox}</span></>)
                : t('callSchedulePage.subtitleDefault')}</p>
            </div>
          </div>
          <AppPageSettings />
        </header>

        {eventsError || calendarsError ? (<div className="csched-page__alert" role="status">
            {calendarsError ? (<p>
                <strong>{t('callSchedulePage.alertCalendars')}</strong> {calendarsError}
              </p>) : null}
            {eventsError ? (<p>
                <strong>{t('callSchedulePage.alertEvents')}</strong> {eventsError}
              </p>) : null}
            <button type="button" className="csched-page__alert-btn" onClick={() => setRetryKey((k) => k + 1)}>
              {t('callSchedulePage.retry')}
            </button>
          </div>) : null}

        <div className={`csched-page__workspace${eventsLoading ? ' csched-page__workspace--loading' : ''}`}>
          <aside className="csched-page__rail" aria-label={t('callSchedulePage.railNavAria')}>
            <div className="csched-rail__block">
              <div className="csched-rail__mini-head">
                <button type="button" className="csched-rail__icon-btn" onClick={goPrevMonth} aria-label={t('callSchedulePage.prevMonth')}>
                  ‹
                </button>
                <span className="csched-rail__mini-title">{monthTitle(anchorMonth, locale)}</span>
                <button type="button" className="csched-rail__icon-btn" onClick={goNextMonth} aria-label={t('callSchedulePage.nextMonth')}>
                  ›
                </button>
              </div>
              <div className="csched-mini-cal" role="grid" aria-label={t('callSchedulePage.miniCalendarAria')}>
                <div className="csched-mini-cal__dow" role="row">
                  {weekdays.map((d) => (<span key={d} className="csched-mini-cal__dow-cell" role="columnheader">
                      {d}
                    </span>))}
                </div>
                {miniWeeks.map((row, wi) => (<div key={wi} className="csched-mini-cal__row" role="row">
                    {row.map(({ d, inMonth }, di) => {
                const sel = sameYmd(d, selected);
                const today = isToday(d);
                return (<button key={`${wi}-${di}`} type="button" role="gridcell" className={`csched-mini-cal__cell${!inMonth ? ' csched-mini-cal__cell--muted' : ''}${today ? ' csched-mini-cal__cell--today' : ''}${sel ? ' csched-mini-cal__cell--selected' : ''}`} onClick={() => {
                        setSelected(new Date(d));
                        setAnchorMonth(startOfMonth(d));
                    }}>
                          {d.getDate()}
                        </button>);
            })}
                  </div>))}
              </div>
            </div>
            {calendarsLoading && !calendarsError ? (<CschedCalendarBlockSkeleton />) : (<div className="csched-rail__block csched-rail__block--muted">
              <p className="csched-rail__section-title">{t('callSchedulePage.calendarSection')}</p>
              <CallScheduleCalendarSelect value={calendarId} onChange={setCalendarId} calendars={calendars} disabled={!!calendarsError}/>
              <p className="csched-rail__hint">{t('callSchedulePage.dataHint')} <code className="csched-rail__code">/api/v1/call-schedule</code></p>
            </div>)}
          </aside>

          <section className="csched-page__calendar" aria-label={t('callSchedulePage.mainCalendarAria')}>
            <div className="csched-cal__toolbar">
              <button type="button" className="csched-cal__btn csched-cal__btn--primary" onClick={goToday}>
                {t('callSchedulePage.today')}
              </button>
              <button type="button" className="csched-cal__btn" onClick={() => setCreateOpen(true)}>
                {t('callSchedulePage.newSlot')}
              </button>
              <div className="csched-cal__nav">
                <button type="button" className="csched-cal__icon-btn" onClick={goPrevMonth} aria-label={t('callSchedulePage.prevMonth')}>
                  ‹
                </button>
                <button type="button" className="csched-cal__icon-btn" onClick={goNextMonth} aria-label={t('callSchedulePage.nextMonth')}>
                  ›
                </button>
              </div>
              <h2 className="csched-cal__month-label">{monthTitle(anchorMonth, locale)}</h2>
              <div className="csched-cal__toolbar-spacer"/>
              {eventsLoading ? (<span className="csched-cal__view-badge" aria-live="polite">{t('callSchedulePage.loading')}</span>) : null}
              <span className="csched-cal__view-badge">{t('callSchedulePage.monthView')}</span>
            </div>

            <div className="csched-cal__grid-wrap">
              <div className="csched-cal__dow-row" role="row">
                {weekdays.map((d) => (<div key={d} className="csched-cal__dow-cell" role="columnheader">
                    {d}
                  </div>))}
              </div>
              <div className="csched-cal__grid" role="grid">
                {weeks.flatMap((row, wi) => row.map(({ d, inMonth }, di) => {
            const iso = toIso(d);
            const dayEvents = eventsByDate.get(iso) ?? [];
            const visibleDayEvents = dayEvents.slice(0, MONTH_CELL_EVENT_CAP);
            const moreCount = dayEvents.length > MONTH_CELL_EVENT_CAP
                ? dayEvents.length - MONTH_CELL_EVENT_CAP
                : 0;
            const sel = sameYmd(d, selected);
            const today = isToday(d);
            return (<div key={`${wi}-${di}`} role="gridcell" tabIndex={0} className={`csched-cal__cell${!inMonth ? ' csched-cal__cell--muted' : ''}${today ? ' csched-cal__cell--today' : ''}${sel ? ' csched-cal__cell--selected' : ''}`} onClick={() => setSelected(new Date(d))} onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(new Date(d));
                    }
                }}>
                        <div className="csched-cal__cell-head">
                          {dayEvents.length > 0 ? (<button type="button" className="csched-cal__cell-num csched-cal__date-open" title={t('callSchedulePage.allDayEventsTitle')} aria-label={`${t('callSchedulePage.allDayEventsAria')} ${eventCountLabel(dayEvents.length, locale, t)}`} onClick={(e) => {
                        e.stopPropagation();
                        setSelected(new Date(d));
                        setAgendaForDay({ dateIso: iso, events: dayEvents });
                    }}>
                              {d.getDate()}
                            </button>) : (<span className="csched-cal__cell-num">{d.getDate()}</span>)}
                          {!inMonth && (<span className="csched-cal__cell-month">{d.toLocaleDateString(localeTag(locale), { month: 'short' })}</span>)}
                        </div>
                        <div className="csched-cal__events">
                          {visibleDayEvents.map((ev) => (<button key={ev.id} type="button" className="csched-cal__event" title={`${ev.time} · ${ev.title} — ${t('callSchedulePage.eventDetailsTitle')}`} onClick={(e) => {
                        e.stopPropagation();
                        setDetailEvent(ev);
                    }}>
                              <span className="csched-cal__event-time">{ev.time}</span>
                              <span className="csched-cal__event-title">{ev.title}</span>
                            </button>))}
                          {moreCount > 0 ? (<button type="button" className="csched-cal__more" title={`${t('callSchedulePage.moreInDayTitle')} ${dayEvents.length}. ${t('callSchedulePage.moreInDayTitleSuffix')}`} aria-label={`${t('callSchedulePage.showHiddenAria')} ${eventCountLabel(moreCount, locale, t)}`} onClick={(e) => {
                        e.stopPropagation();
                        setSelected(new Date(d));
                        setAgendaForDay({ dateIso: iso, events: dayEvents });
                    }}>
                              {t('callSchedulePage.moreCount')} {moreCount}
                            </button>) : null}
                        </div>
                      </div>);
        }))}
              </div>
            </div>
          </section>
        </div>
      </main>
      {agendaForDay ? (<CallDayListModal dateIso={agendaForDay.dateIso} events={agendaForDay.events} onClose={() => setAgendaForDay(null)} onSelectEvent={(ev) => {
        setDetailEvent(ev);
        setAgendaForDay(null);
    }}/>) : null}
      {detailEvent ? <CallEventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)}/> : null}
      <CreateCallEventModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => setRetryKey((k) => k + 1)} initialDateIso={toIso(selected)} calendarId={calendarId}/>
    </div>);
}
