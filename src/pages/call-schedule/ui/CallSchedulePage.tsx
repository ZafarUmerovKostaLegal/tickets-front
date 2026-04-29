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
import { AppBackButton, AppPageSettings } from '@shared/ui';
import { sanitizeHttpsWebUrl } from '@shared/lib/safeWebLink';
import { CallScheduleCalendarSelect, CschedCalendarBlockSkeleton, isKostaCalendarName } from './CallScheduleCalendarSelect';
import './CallSchedulePage.css';
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
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
function fmtDurationRu(min: number): string {
    if (!Number.isFinite(min) || min <= 0)
        return '—';
    if (min < 60)
        return `${min} мин`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (m === 0)
        return `${h} ч`;
    return `${h} ч ${m} мин`;
}
function formatDateLongRu(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m)
        return iso;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const s = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function monthTitleRu(anchorMonth: Date): string {
    const s = anchorMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const MONTH_CELL_EVENT_CAP = 2;
function ruEventCountLabel(n: number): string {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11)
        return `${n} событие`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20))
        return `${n} события`;
    return `${n} событий`;
}
function CallEventDetailModal({ event, onClose }: {
    event: CallEvent;
    onClose: () => void;
}) {
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
          <button type="button" className="csched-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="csched-modal__body">
          <dl className="csched-modal__dl">
            <div className="csched-modal__row">
              <dt>Дата</dt>
              <dd>{formatDateLongRu(event.date)}</dd>
            </div>
            <div className="csched-modal__row">
              <dt>Время</dt>
              <dd>
                {event.time} <span className="csched-modal__muted">({fmtDurationRu(event.durationMin)})</span>
              </dd>
            </div>
            {event.client ? (<div className="csched-modal__row">
                <dt>Клиент / проект</dt>
                <dd>{event.client}</dd>
              </div>) : null}
            {event.participants && event.participants.length > 0 ? (<div className="csched-modal__row">
                <dt>Участники</dt>
                <dd>
                  <ul className="csched-modal__list">
                    {event.participants.map((p) => (<li key={p}>{p}</li>))}
                  </ul>
                </dd>
              </div>) : null}
            {event.description ? (<div className="csched-modal__row csched-modal__row--block">
                <dt>Описание</dt>
                <dd className="csched-modal__desc">{event.description}</dd>
              </div>) : null}
            {hasAnyJoinLink(event) ? (<div className="csched-modal__row csched-modal__row--block">
                <dt>Ссылки на встречу</dt>
                <dd className="csched-modal__joins">
                  {buildCallJoinLinkList(event).map((row) => {
                const safe = sanitizeHttpsWebUrl(row.url);
                return safe ? (<a key={row.key} className={`csched-modal__join ${row.className}`} href={safe} target="_blank" rel="noopener noreferrer">
                        {row.label}
                      </a>) : (<span key={row.key} className="csched-modal__join csched-modal__join--unsafe" title="Ссылка не HTTPS или некорректна">
                        {row.label.replace(/^Открыть /, '')}
                        {' '}
                        (ссылка недоступна)
                      </span>);
            })}
                </dd>
              </div>) : null}
            {event.dialIn ? (<div className="csched-modal__row">
                <dt>Телефон</dt>
                <dd>{event.dialIn}</dd>
              </div>) : null}
          </dl>
        </div>
        <div className="csched-modal__foot">
          <button type="button" className="csched-modal__btn csched-modal__btn--primary" onClick={onClose}>
            Закрыть
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
            {formatDateLongRu(dateIso)}
          </h2>
          <button type="button" className="csched-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="csched-modal__body csched-daylist__body">
          <p className="csched-daylist__meta">{ruEventCountLabel(events.length)}</p>
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
            Закрыть
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
            setFormError('Укажите тему встречи');
            return;
        }
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
        if (!m) {
            setFormError('Некорректная дата');
            return;
        }
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const [fh, fm] = timeFrom.split(':').map((x) => Number(x));
        const [th, tm] = timeTo.split(':').map((x) => Number(x));
        if (![fh, fm, th, tm].every((n) => Number.isFinite(n))) {
            setFormError('Некорректное время');
            return;
        }
        const start = new Date(y, mo - 1, d, fh, fm, 0, 0);
        const end = new Date(y, mo - 1, d, th, tm, 0, 0);
        if (end.getTime() <= start.getTime()) {
            setFormError('Время окончания должно быть позже начала');
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
            const msg = err instanceof CallScheduleApiError ? err.message : 'Не удалось создать событие';
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
              Новый слот звонка
            </h2>
            <button type="button" className="csched-modal__close" onClick={onClose} aria-label="Закрыть" disabled={saving}>
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
              <span className="csched-form__label">Тема</span>
              <input className="csched-form__input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500} required disabled={saving} placeholder="Напр., Звонок с клиентом"/>
            </label>
            <label className="csched-form__field">
              <span className="csched-form__label">Дата</span>
              <input className="csched-form__input" type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} required disabled={saving}/>
            </label>
            <div className="csched-form__row2">
              <label className="csched-form__field">
                <span className="csched-form__label">С</span>
                <input className="csched-form__input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} required disabled={saving}/>
              </label>
              <label className="csched-form__field">
                <span className="csched-form__label">По</span>
                <input className="csched-form__input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} required disabled={saving}/>
              </label>
            </div>
            <label className="csched-form__field">
              <span className="csched-form__label">Текст приглашения (по желанию)</span>
              <textarea className="csched-form__textarea" value={body} onChange={(e) => setBody(e.target.value)} rows={3} disabled={saving} placeholder="Заметка для участников"/>
            </label>
          </div>
          <div className="csched-modal__foot">
            <button type="button" className="csched-modal__btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="csched-modal__btn csched-modal__btn--primary" disabled={saving}>
              {saving ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>, document.body);
}
export function CallSchedulePage() {
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
                const msg = e instanceof CallScheduleApiError ? e.message : 'Не удалось загрузить календари';
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
        if (calendarsLoading)
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
                const msg = e instanceof CallScheduleApiError ? e.message : 'Не удалось загрузить события';
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
    }, [viewY, viewM, calendarId, retryKey, calendarsLoading]);
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
            <div className="csched-page__header-text">
              <h1 className="csched-page__title">Расписание звонков</h1>
              <p className="csched-page__subtitle">
                {mailbox
                ? (<>Календари ящика <span className="csched-page__mono">{mailbox}</span></>)
                : 'Календарь: события из Microsoft 365'}</p>
            </div>
          </div>
          <AppPageSettings />
        </header>

        {eventsError || calendarsError ? (<div className="csched-page__alert" role="status">
            {calendarsError ? (<p>
                <strong>Календари.</strong> {calendarsError}
              </p>) : null}
            {eventsError ? (<p>
                <strong>События.</strong> {eventsError}
              </p>) : null}
            <button type="button" className="csched-page__alert-btn" onClick={() => setRetryKey((k) => k + 1)}>
              Повторить запрос
            </button>
          </div>) : null}

        <div className={`csched-page__workspace${eventsLoading ? ' csched-page__workspace--loading' : ''}`}>
          <aside className="csched-page__rail" aria-label="Навигация по календарю">
            <div className="csched-rail__block">
              <div className="csched-rail__mini-head">
                <button type="button" className="csched-rail__icon-btn" onClick={goPrevMonth} aria-label="Предыдущий месяц">
                  ‹
                </button>
                <span className="csched-rail__mini-title">{monthTitleRu(anchorMonth)}</span>
                <button type="button" className="csched-rail__icon-btn" onClick={goNextMonth} aria-label="Следующий месяц">
                  ›
                </button>
              </div>
              <div className="csched-mini-cal" role="grid" aria-label="Мини-календарь">
                <div className="csched-mini-cal__dow" role="row">
                  {WEEKDAYS.map((d) => (<span key={d} className="csched-mini-cal__dow-cell" role="columnheader">
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
              <p className="csched-rail__section-title">Календарь</p>
              <CallScheduleCalendarSelect value={calendarId} onChange={setCalendarId} calendars={calendars} disabled={!!calendarsError}/>
              <p className="csched-rail__hint">Данные: gateway <code className="csched-rail__code">/api/v1/call-schedule</code></p>
            </div>)}
          </aside>

          <section className="csched-page__calendar" aria-label="Месячный календарь">
            <div className="csched-cal__toolbar">
              <button type="button" className="csched-cal__btn csched-cal__btn--primary" onClick={goToday}>
                Сегодня
              </button>
              <button type="button" className="csched-cal__btn" onClick={() => setCreateOpen(true)}>
                Новый слот
              </button>
              <div className="csched-cal__nav">
                <button type="button" className="csched-cal__icon-btn" onClick={goPrevMonth} aria-label="Предыдущий месяц">
                  ‹
                </button>
                <button type="button" className="csched-cal__icon-btn" onClick={goNextMonth} aria-label="Следующий месяц">
                  ›
                </button>
              </div>
              <h2 className="csched-cal__month-label">{monthTitleRu(anchorMonth)}</h2>
              <div className="csched-cal__toolbar-spacer"/>
              {eventsLoading ? (<span className="csched-cal__view-badge" aria-live="polite">Загрузка…</span>) : null}
              <span className="csched-cal__view-badge">Месяц</span>
            </div>

            <div className="csched-cal__grid-wrap">
              <div className="csched-cal__dow-row" role="row">
                {WEEKDAYS.map((d) => (<div key={d} className="csched-cal__dow-cell" role="columnheader">
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
                          {dayEvents.length > 0 ? (<button type="button" className="csched-cal__cell-num csched-cal__date-open" title="Все события дня" aria-label={`Все ${ruEventCountLabel(dayEvents.length)}`} onClick={(e) => {
                        e.stopPropagation();
                        setSelected(new Date(d));
                        setAgendaForDay({ dateIso: iso, events: dayEvents });
                    }}>
                              {d.getDate()}
                            </button>) : (<span className="csched-cal__cell-num">{d.getDate()}</span>)}
                          {!inMonth && (<span className="csched-cal__cell-month">{d.toLocaleDateString('ru-RU', { month: 'short' })}</span>)}
                        </div>
                        <div className="csched-cal__events">
                          {visibleDayEvents.map((ev) => (<button key={ev.id} type="button" className="csched-cal__event" title={`${ev.time} · ${ev.title} — подробнее`} onClick={(e) => {
                        e.stopPropagation();
                        setDetailEvent(ev);
                    }}>
                              <span className="csched-cal__event-time">{ev.time}</span>
                              <span className="csched-cal__event-title">{ev.title}</span>
                            </button>))}
                          {moreCount > 0 ? (<button type="button" className="csched-cal__more" title={`Всего в дне: ${dayEvents.length}. Нажмите, чтобы открыть список.`} aria-label={`Показать скрытые: ${ruEventCountLabel(moreCount)}`} onClick={(e) => {
                        e.stopPropagation();
                        setSelected(new Date(d));
                        setAgendaForDay({ dateIso: iso, events: dayEvents });
                    }}>
                              Ещё {moreCount}
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
