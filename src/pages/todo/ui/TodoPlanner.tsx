import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight } from './TodoIcons';
import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
import { useI18n, formatTodoPlannerHour, todoLocaleTag, todoWeekdayLabels } from '@shared/i18n';
type TodoPlannerProps = {
    plannerCollapsed: boolean;
    setPlannerCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
    currentMonth: Date;
    monthDays: Date[];
    monthLabel: string;
    today: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    calendarConnected: boolean;
    calendarEvents: CalendarEvent[];
    calendarConnectError?: string | null;
    onConnectCalendar: () => void;
    onAddEvent?: (date: Date) => void;
    onEditEvent?: (event: CalendarEvent) => void;
    loading?: boolean;

    onMobileClose?: () => void;
};
const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i);
function pad2(n: number) { return n.toString().padStart(2, '0'); }
function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseMsDate(dateTime: string, timeZone?: string): Date | null {
    let dt = dateTime;
    if (timeZone === 'UTC' && !dt.endsWith('Z') && !dt.includes('+')) {
        dt += 'Z';
    }
    const d = new Date(dt);
    return isNaN(d.getTime()) ? null : d;
}
function dayBounds(d: Date): {
    start: Date;
    end: Date;
} {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}
function eventOverlapsDay(ev: CalendarEvent, day: Date): boolean {
    if (!ev.start?.dateTime)
        return false;
    const start = parseMsDate(ev.start.dateTime, ev.start.timeZone);
    if (!start)
        return false;
    const end = ev.end?.dateTime
        ? parseMsDate(ev.end.dateTime, ev.end.timeZone)
        : new Date(start.getTime() + 60 * 60 * 1000);
    if (!end)
        return false;
    const { start: dayStart, end: dayEnd } = dayBounds(day);
    return start < dayEnd && end > dayStart;
}
function eventIntervalOnDay(ev: CalendarEvent, day: Date): {
    startH: number;
    endH: number;
} | null {
    if (!ev.start?.dateTime)
        return null;
    const start = parseMsDate(ev.start.dateTime, ev.start.timeZone);
    if (!start)
        return null;
    const rawEnd = ev.end?.dateTime
        ? parseMsDate(ev.end.dateTime, ev.end.timeZone)
        : new Date(start.getTime() + 60 * 60 * 1000);
    if (!rawEnd)
        return null;
    const { start: dayStart, end: dayEnd } = dayBounds(day);
    const clipStart = start < dayStart ? dayStart : start;
    const clipEnd = rawEnd > dayEnd ? dayEnd : rawEnd;
    if (clipStart >= clipEnd)
        return null;
    const toHours = (d: Date) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    return { startH: toHours(clipStart), endH: toHours(clipEnd) };
}
function formatEventTime(ev: CalendarEvent): string {
    if (!ev.start?.dateTime)
        return '';
    const s = parseMsDate(ev.start.dateTime, ev.start.timeZone);
    if (!s)
        return '';
    const parts = [pad2(s.getHours()) + ':' + pad2(s.getMinutes())];
    if (ev.end?.dateTime) {
        const e = parseMsDate(ev.end.dateTime, ev.end.timeZone);
        if (e)
            parts.push(pad2(e.getHours()) + ':' + pad2(e.getMinutes()));
    }
    return parts.join(' – ');
}
export const TodoPlanner = memo(function TodoPlanner({ plannerCollapsed, setPlannerCollapsed, currentMonth, monthDays, monthLabel, today, onPrevMonth, onNextMonth, calendarConnected, calendarEvents, calendarConnectError, onConnectCalendar, onAddEvent, onEditEvent, loading, onMobileClose, }: TodoPlannerProps) {
    const { t, locale } = useI18n();
    const weekdayShort = todoWeekdayLabels(t);
    const dateLocale = todoLocaleTag(locale);
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    const nowSecond = now.getSeconds();
    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        for (const ev of calendarEvents) {
            if (!ev.start?.dateTime)
                continue;
            const d = parseMsDate(ev.start.dateTime, ev.start.timeZone);
            if (!d)
                continue;
            const key = toDateKey(d);
            (map[key] ??= []).push(ev);
        }
        return map;
    }, [calendarEvents]);
    const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    const selectedKey = toDateKey(selectedDate);
    const selectedEvents = useMemo(() => calendarEvents.filter((ev) => eventOverlapsDay(ev, selectedDate)), [calendarEvents, selectedDate]);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const handleDayEnter = useCallback((dayKey: string, e: React.MouseEvent<HTMLButtonElement>) => {
        if (hoverTimerRef.current)
            clearTimeout(hoverTimerRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        const gridRect = gridRef.current?.getBoundingClientRect();
        if (gridRect) {
            setTooltipPos({
                top: rect.bottom - gridRect.top + 4,
                left: Math.max(0, rect.left - gridRect.left + rect.width / 2 - 90),
            });
        }
        hoverTimerRef.current = setTimeout(() => setHoveredDay(dayKey), 200);
    }, []);
    const handleDayLeave = useCallback(() => {
        if (hoverTimerRef.current)
            clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHoveredDay(null), 150);
    }, []);
    const handleTooltipEnter = useCallback(() => {
        if (hoverTimerRef.current)
            clearTimeout(hoverTimerRef.current);
    }, []);
    const handleTooltipLeave = useCallback(() => {
        if (hoverTimerRef.current)
            clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHoveredDay(null), 150);
    }, []);
    const handleAddEvent = useCallback(() => {
        onAddEvent?.(selectedDate);
    }, [onAddEvent, selectedDate]);
    const handleDayClick = useCallback((d: Date) => {
        setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }, []);
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const handleHourRowClick = useCallback((h: number) => {
        setSelectedHour((prev) => (prev === h ? null : h));
    }, []);
    const hoursScrollRef = useRef<HTMLDivElement>(null);
    const isSelectedToday = selectedDate.getFullYear() === today.getFullYear()
        && selectedDate.getMonth() === today.getMonth()
        && selectedDate.getDate() === today.getDate();
    useEffect(() => {
        if (plannerCollapsed || loading || !calendarConnected || !isSelectedToday)
            return;
        const el = hoursScrollRef.current;
        if (!el)
            return;
        const row = el.querySelector<HTMLElement>(`.todo-planner__hour-row--now`);
        row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [plannerCollapsed, loading, calendarConnected, isSelectedToday, selectedKey]);
    return (<aside className={`todo-planner${plannerCollapsed ? ' todo-planner--collapsed' : ''}`}>
      <div className="todo-planner__header">
        <button type="button" className="todo-planner__collapse-btn" onClick={() => setPlannerCollapsed((v) => !v)} aria-label={plannerCollapsed ? t('todoPage.planner.expand') : t('todoPage.planner.collapse')}>
          {plannerCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
        {onMobileClose && (
          <button type="button" className="todo-planner__mobile-close" onClick={onMobileClose} aria-label={t('todoPage.planner.closeMobile')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
        {!plannerCollapsed && (loading ? (<div className="todo-planner__month-nav todo-planner__month-nav--skeleton">
              <div className="todo-skel todo-skel--month-btn"/>
              <div className="todo-skel todo-skel--month-label"/>
              <div className="todo-skel todo-skel--month-btn"/>
            </div>) : (<div className="todo-planner__month-nav">
              <button type="button" className="todo-planner__month-btn" onClick={onPrevMonth} aria-label={t('todoPage.prevMonth')}>
                <IconChevronLeft />
              </button>
              <span className="todo-planner__month-label">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>
              <button type="button" className="todo-planner__month-btn" onClick={onNextMonth} aria-label={t('todoPage.nextMonth')}>
                <IconChevronRight />
              </button>
            </div>))}
      </div>

      {plannerCollapsed ? (<div className="todo-planner__collapsed-content">
          <div className="todo-planner__collapsed-icon"><IconCalendar /></div>
          <div className="todo-planner__collapsed-day-big">{selectedDate.getDate().toString().padStart(2, '0')}</div>
          <span className="todo-planner__collapsed-weekday">{selectedDate.toLocaleDateString(dateLocale, { weekday: 'short' })}</span>
          {selectedEvents.length > 0 && (<span className="todo-planner__collapsed-badge">{selectedEvents.length}</span>)}
        </div>) : (<div className="todo-planner__content">
          {loading ? (<div className="todo-planner__today todo-planner__today--skeleton">
              <div className="todo-skel todo-skel--title"/>
              <div className="todo-skel todo-skel--line-short"/>
            </div>) : (<div className="todo-planner__today">
              <span className="todo-planner__today-label">
                {selectedDate.getTime() === today.getTime() ? t('todoPage.today') : t('todoPage.selected')}
              </span>
              <span className="todo-planner__today-date">
                {selectedDate.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>)}

          <div className="todo-planner__calendar">
            <div className="todo-planner__weekdays">
              {weekdayShort.map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="todo-planner__grid" ref={gridRef} style={{ position: 'relative' }}>
              {loading ? (Array.from({ length: 42 }).map((_, i) => (<div key={i} className="todo-skel todo-skel--day"/>))) : monthDays.map((d) => {
                const inCurrentMonth = d.getMonth() === currentMonth.getMonth();
                const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                const isSelected = d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth() && d.getDate() === selectedDate.getDate();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const dayKey = toDateKey(d);
                const dayEvents = eventsByDate[dayKey];
                const hasEvents = !!dayEvents && dayEvents.length > 0;
                return (<button key={d.toISOString()} type="button" className={[
                        'todo-planner__day',
                        !inCurrentMonth && 'todo-planner__day--muted',
                        isToday && 'todo-planner__day--today',
                        isSelected && 'todo-planner__day--selected',
                        isWeekend && inCurrentMonth && !isToday && !isSelected && 'todo-planner__day--weekend',
                        hasEvents && 'todo-planner__day--has-event',
                    ].filter(Boolean).join(' ')} onClick={() => handleDayClick(d)} onMouseEnter={hasEvents ? (e) => handleDayEnter(dayKey, e) : undefined} onMouseLeave={hasEvents ? handleDayLeave : undefined}>
                    {d.getDate()}
                    {hasEvents && <span className="todo-planner__day-dot"/>}
                  </button>);
            })}
              {hoveredDay && eventsByDate[hoveredDay] && tooltipPos && (<div className="todo-planner__day-tooltip" style={{ top: tooltipPos.top, left: tooltipPos.left }} onMouseEnter={handleTooltipEnter} onMouseLeave={handleTooltipLeave}>
                  <div className="todo-planner__day-tooltip-date">
                    {(() => {
                    const [y, m, dd] = hoveredDay.split('-').map(Number);
                    return new Date(y, m - 1, dd).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', weekday: 'short' });
                })()}
                  </div>
                  {eventsByDate[hoveredDay].map((ev) => (<div key={ev.id} className="todo-planner__day-tooltip-ev">
                      <span className="todo-planner__day-tooltip-time">{formatEventTime(ev)}</span>
                      <span className="todo-planner__day-tooltip-subj">{ev.subject ?? t('todoPage.eventDefault')}</span>
                    </div>))}
                </div>)}
            </div>
          </div>

          {loading ? (<div className="todo-planner__schedule todo-planner__schedule--skeleton">
              <div className="todo-planner__schedule-head">
                <div className="todo-skel todo-skel--title"/>
                <div className="todo-skel todo-skel--badge"/>
              </div>
              <div className="todo-planner__hours">
                {Array.from({ length: SCHEDULE_HOURS.length }).map((_, i) => (<div key={i} className="todo-planner__hour-row">
                    <div className="todo-skel todo-skel--hour-label"/>
                    <span className="todo-planner__hour-line">
                      {i % 3 === 0 && <div className="todo-skel todo-skel--event-chip"/>}
                    </span>
                  </div>))}
              </div>
              <div className="todo-skel todo-skel--add-event-btn"/>
            </div>) : !calendarConnected ? (<div className="todo-planner__connect">
              <div className="todo-planner__connect-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span className="todo-planner__connect-text">{t('todoPage.planner.outlookCalendar')}</span>
              <button type="button" className="todo-planner__connect-btn" onClick={onConnectCalendar}>
                {t('todoPage.planner.connect')}
              </button>
              {calendarConnectError && (<p className="todo-planner__connect-error" role="alert">
                  {calendarConnectError}
                </p>)}
            </div>) : (<div className="todo-planner__schedule">
              <div className="todo-planner__schedule-head">
                <span className="todo-planner__schedule-title">{t('todoPage.planner.schedule')}</span>
                <span className="todo-planner__schedule-now">
                  <span className="todo-planner__schedule-hm">
                    {pad2(nowHour)}:{pad2(nowMinute)}
                  </span>
                  <span className="todo-planner__schedule-sec">:{pad2(nowSecond)}</span>
                </span>
              </div>
              <div className="todo-planner__hours" ref={hoursScrollRef}>
                {SCHEDULE_HOURS.map((h) => {
                    const hourStart = h;
                    const hourEnd = h + 1;
                    const hourEvents = selectedEvents.filter((ev) => {
                        const interval = eventIntervalOnDay(ev, selectedDate);
                        if (!interval)
                            return false;
                        return interval.startH < hourEnd && interval.endH > hourStart;
                    });
                    return (<div key={h} role="button" tabIndex={0} className={[
                            'todo-planner__hour-row',
                            h === nowHour && 'todo-planner__hour-row--now',
                            selectedHour === h && 'todo-planner__hour-row--selected',
                        ].filter(Boolean).join(' ')} onClick={() => handleHourRowClick(h)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHourRowClick(h);
                    } }} aria-label={formatTodoPlannerHour(h, pad2, selectedHour === h, t)}>
                      <div className="todo-planner__hour-row-inner">
                        <span className="todo-planner__hour-label">{pad2(h)}:00</span>
                        <span className="todo-planner__hour-line">
                          {hourEvents.length > 0 ? (hourEvents.map((ev) => (<span key={ev.id} className="todo-planner__event-chip-wrap">
                                <span className="todo-planner__event-chip" title={`${ev.subject ?? ''}\n${formatEventTime(ev)}`}>
                                  {ev.subject ?? t('todoPage.eventDefault')}
                                </span>
                                <button type="button" className="todo-planner__event-edit-btn" onClick={(e) => { e.stopPropagation(); onEditEvent?.(ev); }} aria-label={t('todoPage.planner.editEvent')} title={t('todoPage.planner.editEvent')}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                </button>
                              </span>))) : null}
                        </span>
                      </div>
                    </div>);
                })}
              </div>
              <button type="button" className="todo-planner__add-event-btn" onClick={handleAddEvent}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {t('todoPage.planner.addEvent')}
              </button>
            </div>)}
        </div>)}
    </aside>);
});
