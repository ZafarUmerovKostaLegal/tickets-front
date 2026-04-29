import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconChevronLeft, IconChevronRight } from './TodoIcons';
import { WEEKDAYS_SHORT } from '@entities/todo/lib/todoUtils';
import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
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
};
const SCHEDULE_HOUR_START = 10;
const SCHEDULE_HOUR_END = 22;
const SCHEDULE_HOURS = Array.from({ length: SCHEDULE_HOUR_END - SCHEDULE_HOUR_START + 1 }, (_, i) => SCHEDULE_HOUR_START + i);
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
function parseEventHour(ev: CalendarEvent): number | null {
    if (!ev.start?.dateTime)
        return null;
    const d = parseMsDate(ev.start.dateTime, ev.start.timeZone);
    return d ? d.getHours() : null;
}
function eventStartHours(ev: CalendarEvent): number | null {
    if (!ev.start?.dateTime)
        return null;
    const d = parseMsDate(ev.start.dateTime, ev.start.timeZone);
    return d ? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 : null;
}
function eventEndHours(ev: CalendarEvent): number | null {
    if (!ev.end?.dateTime)
        return null;
    const d = parseMsDate(ev.end.dateTime, ev.end.timeZone);
    return d ? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 : null;
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
export const TodoPlanner = memo(function TodoPlanner({ plannerCollapsed, setPlannerCollapsed, currentMonth, monthDays, monthLabel, today, onPrevMonth, onNextMonth, calendarConnected, calendarEvents, calendarConnectError, onConnectCalendar, onAddEvent, onEditEvent, loading, }: TodoPlannerProps) {
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
    const selectedEvents = useMemo(() => eventsByDate[selectedKey] ?? [], [eventsByDate, selectedKey]);
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
    return (<aside className={`todo-planner${plannerCollapsed ? ' todo-planner--collapsed' : ''}`}>
      <div className="todo-planner__header">
        <button type="button" className="todo-planner__collapse-btn" onClick={() => setPlannerCollapsed((v) => !v)} aria-label={plannerCollapsed ? 'Развернуть планировщик' : 'Свернуть планировщик'}>
          {plannerCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
        {!plannerCollapsed && (loading ? (<div className="todo-planner__month-nav todo-planner__month-nav--skeleton">
              <div className="todo-skel todo-skel--month-btn"/>
              <div className="todo-skel todo-skel--month-label"/>
              <div className="todo-skel todo-skel--month-btn"/>
            </div>) : (<div className="todo-planner__month-nav">
              <button type="button" className="todo-planner__month-btn" onClick={onPrevMonth} aria-label="Предыдущий месяц">
                <IconChevronLeft />
              </button>
              <span className="todo-planner__month-label">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</span>
              <button type="button" className="todo-planner__month-btn" onClick={onNextMonth} aria-label="Следующий месяц">
                <IconChevronRight />
              </button>
            </div>))}
      </div>

      {plannerCollapsed ? (<div className="todo-planner__collapsed-content">
          <div className="todo-planner__collapsed-icon"><IconCalendar /></div>
          <div className="todo-planner__collapsed-day-big">{selectedDate.getDate().toString().padStart(2, '0')}</div>
          <span className="todo-planner__collapsed-weekday">{selectedDate.toLocaleDateString('ru-RU', { weekday: 'short' })}</span>
          {selectedEvents.length > 0 && (<span className="todo-planner__collapsed-badge">{selectedEvents.length}</span>)}
        </div>) : (<div className="todo-planner__content">
          {loading ? (<div className="todo-planner__today todo-planner__today--skeleton">
              <div className="todo-skel todo-skel--title"/>
              <div className="todo-skel todo-skel--line-short"/>
            </div>) : (<div className="todo-planner__today">
              <span className="todo-planner__today-label">
                {selectedDate.getTime() === today.getTime() ? 'Сегодня' : 'Выбрано'}
              </span>
              <span className="todo-planner__today-date">
                {selectedDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>)}

          <div className="todo-planner__calendar">
            <div className="todo-planner__weekdays">
              {WEEKDAYS_SHORT.map((d) => <span key={d}>{d}</span>)}
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
                    return new Date(y, m - 1, dd).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
                })()}
                  </div>
                  {eventsByDate[hoveredDay].map((ev) => (<div key={ev.id} className="todo-planner__day-tooltip-ev">
                      <span className="todo-planner__day-tooltip-time">{formatEventTime(ev)}</span>
                      <span className="todo-planner__day-tooltip-subj">{ev.subject ?? 'Событие'}</span>
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
              <span className="todo-planner__connect-text">Outlook календарь</span>
              <button type="button" className="todo-planner__connect-btn" onClick={onConnectCalendar}>
                Подключить
              </button>
              {calendarConnectError && (<p className="todo-planner__connect-error" role="alert">
                  {calendarConnectError}
                </p>)}
            </div>) : (<div className="todo-planner__schedule">
              <div className="todo-planner__schedule-head">
                <span className="todo-planner__schedule-title">Расписание</span>
                <span className="todo-planner__schedule-now">
                  <span className="todo-planner__schedule-hm">
                    {pad2(nowHour)}:{pad2(nowMinute)}
                  </span>
                  <span className="todo-planner__schedule-sec">:{pad2(nowSecond)}</span>
                </span>
              </div>
              <div className="todo-planner__hours">
                {SCHEDULE_HOURS.map((h) => {
                    const hourStart = h;
                    const hourEnd = h + 1;
                    const hourEvents = selectedEvents.filter((ev) => {
                        const startH = eventStartHours(ev);
                        const endH = eventEndHours(ev);
                        if (startH === null)
                            return false;
                        if (endH !== null)
                            return startH < hourEnd && endH > hourStart;
                        return parseEventHour(ev) === h;
                    });
                    return (<div key={h} role="button" tabIndex={0} className={[
                            'todo-planner__hour-row',
                            h === nowHour && 'todo-planner__hour-row--now',
                            selectedHour === h && 'todo-planner__hour-row--selected',
                        ].filter(Boolean).join(' ')} onClick={() => handleHourRowClick(h)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHourRowClick(h);
                    } }} aria-label={selectedHour === h ? `Снять выделение с ${pad2(h)}:00` : `Выбрать ${pad2(h)}:00`}>
                      <div className="todo-planner__hour-row-inner">
                        <span className="todo-planner__hour-label">{pad2(h)}:00</span>
                        <span className="todo-planner__hour-line">
                          {hourEvents.length > 0 ? (hourEvents.map((ev) => (<span key={ev.id} className="todo-planner__event-chip-wrap">
                                <span className="todo-planner__event-chip" title={`${ev.subject ?? ''}\n${formatEventTime(ev)}`}>
                                  {ev.subject ?? 'Событие'}
                                </span>
                                <button type="button" className="todo-planner__event-edit-btn" onClick={(e) => { e.stopPropagation(); onEditEvent?.(ev); }} aria-label="Редактировать событие" title="Редактировать">
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
                Добавить событие
              </button>
            </div>)}
        </div>)}
    </aside>);
});
