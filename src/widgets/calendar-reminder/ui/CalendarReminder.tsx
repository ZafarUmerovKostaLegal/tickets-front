import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCalendarStatus, getCalendarEvents, type CalendarEvent } from '@entities/todo/lib/calendarApi';
import { getCalendarCache, isCacheFresh, onCacheUpdate } from '@entities/todo/lib/calendarCache';
import { isAuthenticated } from '@shared/lib';
import './CalendarReminder.css';
type Reminder = {
    id: string;
    eventId: string;
    subject: string;
    timeLabel: string;
    untilLabel: string;
    isAllDay: boolean;
    startMs: number;
};
const REMINDER_MINUTES = 15;
const BASE_POLL_INTERVAL = 5 * 60000;
const MAX_POLL_INTERVAL = 15 * 60000;
const SNOOZE_OPTIONS = [5, 10, 15, 30, 60];
function parseMsDate(dateTime: string, timeZone?: string): Date | null {
    let dt = dateTime;
    if (timeZone === 'UTC' && !dt.endsWith('Z') && !dt.includes('+'))
        dt += 'Z';
    const d = new Date(dt);
    return isNaN(d.getTime()) ? null : d;
}
function pad2(n: number) {
    return n.toString().padStart(2, '0');
}
function formatTime(d: Date) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function isAllDayEvent(ev: CalendarEvent): boolean {
    if (!ev.start?.dateTime || !ev.end?.dateTime)
        return false;
    const s = parseMsDate(ev.start.dateTime, ev.start.timeZone);
    const e = parseMsDate(ev.end.dateTime, ev.end.timeZone);
    if (!s || !e)
        return false;
    return s.getHours() === 0 && s.getMinutes() === 0 &&
        e.getHours() === 0 && e.getMinutes() === 0 &&
        (e.getTime() - s.getTime()) >= 86400000;
}
function playNotificationSound() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime);
        const notes = [880, 1108.73, 1318.51];
        const noteLen = 0.12;
        const gap = 0.06;
        notes.forEach((freq, i) => {
            const t = ctx.currentTime + i * (noteLen + gap);
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
            gain.gain.linearRampToValueAtTime(0, t + noteLen);
        });
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + notes.length * (noteLen + gap) + 0.1);
        osc.onended = () => ctx.close();
    }
    catch {
    }
}
function computeUntilLabel(startMs: number, now: number, allDay: boolean): string {
    if (allDay)
        return 'Сегодня';
    const diff = Math.max(0, Math.round((startMs - now) / 60000));
    if (diff <= 0)
        return 'Сейчас';
    if (diff < 60)
        return `${diff} мин`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}
function getOrCreateContainer(): HTMLElement {
    const id = 'cal-reminder-root';
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
    return el;
}
function buildReminders(events: CalendarEvent[]): Reminder[] {
    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;
    const result: Reminder[] = [];
    for (const ev of events) {
        if (!ev.start?.dateTime || !ev.id)
            continue;
        const d = parseMsDate(ev.start.dateTime, ev.start.timeZone);
        if (!d)
            continue;
        const startMs = d.getTime();
        const allDay = isAllDayEvent(ev);
        if (allDay) {
            if (startMs < todayStart || startMs >= todayEnd)
                continue;
        }
        else {
            if (startMs - nowMs > REMINDER_MINUTES * 60000)
                continue;
            if (nowMs - startMs > 30 * 60000)
                continue;
        }
        result.push({
            id: ev.id,
            eventId: ev.id,
            subject: ev.subject ?? 'Событие',
            timeLabel: allDay ? 'Весь день' : formatTime(d),
            untilLabel: computeUntilLabel(startMs, nowMs, allDay),
            isAllDay: allDay,
            startMs,
        });
    }
    result.sort((a, b) => a.startMs - b.startMs);
    return result;
}
export function CalendarReminder() {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const dismissedRef = useRef<Set<string>>(new Set());
    const [, forceRender] = useState(0);
    const [snoozed, setSnoozed] = useState<Record<string, number>>({});
    const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const snoozeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const prevReminderIds = useRef<Set<string>>(new Set());
    const menuRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLElement | null>(null);
    const errorCountRef = useRef(0);
    const snoozedRef = useRef(snoozed);
    snoozedRef.current = snoozed;
    useEffect(() => {
        try {
            const raw = localStorage.getItem('cal-reminder-dismissed');
            if (raw)
                dismissedRef.current = new Set<string>(JSON.parse(raw));
        }
        catch { }
    }, []);
    useEffect(() => {
        const timers = snoozeTimersRef.current;
        return () => {
            for (const t of timers.values())
                clearTimeout(t);
            timers.clear();
        };
    }, []);
    if (!containerRef.current) {
        containerRef.current = getOrCreateContainer();
    }
    const dismissed = dismissedRef.current;
    const saveDismissed = useCallback((next: Set<string>) => {
        dismissedRef.current = next;
        try {
            localStorage.setItem('cal-reminder-dismissed', JSON.stringify(Array.from(next)));
        }
        catch { }
        forceRender(v => v + 1);
    }, []);
    useEffect(() => {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const ms = midnight.getTime() - Date.now();
        const timer = setTimeout(() => saveDismissed(new Set()), ms);
        return () => clearTimeout(timer);
    }, [saveDismissed]);
    const processEvents = useCallback((events: CalendarEvent[], isConnected: boolean) => {
        setConnected(isConnected);
        if (!isConnected || events.length === 0) {
            setReminders([]);
            return;
        }
        const currentDismissed = dismissedRef.current;
        const currentSnoozed = snoozedRef.current;
        const nowMs = Date.now();
        let filtered = events;
        if (Object.keys(currentSnoozed).length > 0) {
            filtered = events.filter(ev => {
                const snoozeUntil = currentSnoozed[ev.id];
                return !snoozeUntil || nowMs >= snoozeUntil;
            });
        }
        const newReminders = buildReminders(filtered);
        const brandNew = newReminders.filter(r => !prevReminderIds.current.has(r.id) && !currentDismissed.has(r.id));
        if (brandNew.length > 0) {
            playNotificationSound();
        }
        prevReminderIds.current = new Set(newReminders.map(r => r.id));
        setReminders(newReminders);
    }, []);
    useEffect(() => {
        const unsub = onCacheUpdate(() => {
            const { events, connected: c } = getCalendarCache();
            errorCountRef.current = 0;
            processEvents(events, c);
        });
        return unsub;
    }, [processEvents]);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        let cancelled = false;
        async function poll() {
            if (cancelled)
                return;
            if (isCacheFresh()) {
                const { events, connected: c } = getCalendarCache();
                processEvents(events, c);
                errorCountRef.current = 0;
                schedulePoll(BASE_POLL_INTERVAL);
                return;
            }
            if (!isAuthenticated()) {
                schedulePoll(BASE_POLL_INTERVAL);
                return;
            }
            try {
                const { connected: c } = await getCalendarStatus();
                if (cancelled)
                    return;
                if (!c) {
                    setConnected(false);
                    setReminders([]);
                    errorCountRef.current = 0;
                    schedulePoll(BASE_POLL_INTERVAL);
                    return;
                }
                const now = new Date();
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setDate(end.getDate() + 2);
                const events = await getCalendarEvents(start.toISOString(), end.toISOString());
                if (cancelled)
                    return;
                errorCountRef.current = 0;
                processEvents(events, true);
                schedulePoll(BASE_POLL_INTERVAL);
            }
            catch {
                errorCountRef.current += 1;
                const backoff = Math.min(BASE_POLL_INTERVAL * Math.pow(2, errorCountRef.current), MAX_POLL_INTERVAL);
                schedulePoll(backoff);
            }
        }
        function schedulePoll(ms: number) {
            if (cancelled)
                return;
            timer = setTimeout(poll, ms);
        }
        timer = setTimeout(poll, 3000);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [processEvents]);
    useEffect(() => {
        const interval = setInterval(() => {
            if (reminders.length === 0)
                return;
            const { events, connected: c } = getCalendarCache();
            if (events.length > 0) {
                processEvents(events, c);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [reminders.length, processEvents]);
    useEffect(() => {
        if (!snoozeMenuId)
            return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setSnoozeMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [snoozeMenuId]);
    const handleDismiss = useCallback((id: string) => {
        const next = new Set(dismissedRef.current);
        next.add(id);
        saveDismissed(next);
        setSnoozeMenuId(null);
    }, [saveDismissed]);
    const handleDismissAll = useCallback(() => {
        const next = new Set(dismissedRef.current);
        reminders.forEach(r => next.add(r.id));
        saveDismissed(next);
        setSnoozeMenuId(null);
    }, [reminders, saveDismissed]);
    const handleSnooze = useCallback((id: string, minutes: number) => {
        setSnoozed(prev => ({ ...prev, [id]: Date.now() + minutes * 60000 }));
        const next = new Set(dismissedRef.current);
        next.add(id);
        saveDismissed(next);
        setSnoozeMenuId(null);
        const prev = snoozeTimersRef.current.get(id);
        if (prev)
            clearTimeout(prev);
        const timer = setTimeout(() => {
            snoozeTimersRef.current.delete(id);
            const restored = new Set(dismissedRef.current);
            restored.delete(id);
            saveDismissed(restored);
            setSnoozed(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
        }, minutes * 60000);
        snoozeTimersRef.current.set(id, timer);
    }, [saveDismissed]);
    const visible = useMemo(() => reminders.filter(r => !dismissed.has(r.id)), [reminders, dismissed]);
    if (!connected || visible.length === 0)
        return null;
    return createPortal(<div className="cal-remind">
      <div className="cal-remind__header">
        <span className="cal-remind__title">Напоминания</span>
        <button type="button" className="cal-remind__dismiss-all" onClick={handleDismissAll}>
          Прекратить все
        </button>
        <button type="button" className="cal-remind__close" onClick={handleDismissAll} aria-label="Закрыть">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="cal-remind__list">
        {visible.map(r => (<div key={r.id} className="cal-remind__item">
            <div className="cal-remind__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="cal-remind__body">
              <div className="cal-remind__subject">{r.subject}</div>
              <div className="cal-remind__time">{r.timeLabel}</div>
            </div>
            <div className="cal-remind__until">{r.untilLabel}</div>
            <div className="cal-remind__actions">
              <button type="button" className="cal-remind__btn" onClick={() => handleDismiss(r.id)} title="Прекратить">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button type="button" className="cal-remind__btn cal-remind__btn--snooze" onClick={() => setSnoozeMenuId(prev => prev === r.id ? null : r.id)} title="Отложить">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>
              {snoozeMenuId === r.id && (<div ref={menuRef} className="cal-remind__snooze-menu">
                  {SNOOZE_OPTIONS.map(m => (<button key={m} type="button" className="cal-remind__snooze-opt" onClick={() => handleSnooze(r.id, m)}>
                      {m < 60 ? `${m} мин` : `${m / 60} ч`}
                    </button>))}
                </div>)}
            </div>
          </div>))}
      </div>
    </div>, containerRef.current!);
}
