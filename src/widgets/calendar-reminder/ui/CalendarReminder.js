import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCalendarStatus, getCalendarEvents } from '@entities/todo/lib/calendarApi';
import { queueOutlookAddTime } from '@entities/todo/lib/outlookAddTimeRequest';
import { routes } from '@shared/config';
import { getCalendarCache, isCacheFresh, onCacheUpdate } from '@entities/todo/lib/calendarCache';
import { isAuthenticated } from '@shared/lib/auth';
import './CalendarReminder.css';
const REMINDER_MINUTES = 15;
const BASE_POLL_INTERVAL = 5 * 60000;
const MAX_POLL_INTERVAL = 15 * 60000;
const SNOOZE_OPTIONS = [5, 10, 15, 30, 60];
const PREFS_KEY = 'cal-reminder-prefs';
const CORNERS = [
    { id: 'top-left', label: 'Слева сверху' },
    { id: 'top-right', label: 'Справа сверху' },
    { id: 'bottom-left', label: 'Слева снизу' },
    { id: 'bottom-right', label: 'Справа снизу' },
];
function readReminderPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw)
            return { corner: 'top-right', theme: 'dark' };
        const parsed = JSON.parse(raw);
        const corner = CORNERS.some((item) => item.id === parsed.corner) ? parsed.corner : 'top-right';
        const theme = parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'dark';
        return { corner, theme };
    }
    catch {
        return { corner: 'top-right', theme: 'dark' };
    }
}
function parseMsDate(dateTime, timeZone) {
    let dt = dateTime;
    if (timeZone === 'UTC' && !dt.endsWith('Z') && !dt.includes('+'))
        dt += 'Z';
    const d = new Date(dt);
    return isNaN(d.getTime()) ? null : d;
}
function pad2(n) {
    return n.toString().padStart(2, '0');
}
function formatTime(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function isAllDayEvent(ev) {
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
function computeUntilLabel(startMs, now, allDay) {
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
function getOrCreateContainer() {
    const id = 'cal-reminder-root';
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
    }
    return el;
}
function buildReminders(events) {
    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 86400000;
    const result = [];
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
            event: ev,
        });
    }
    result.sort((a, b) => a.startMs - b.startMs);
    return result;
}
export function CalendarReminder() {
    const [reminders, setReminders] = useState([]);
    const dismissedRef = useRef(new Set());
    const [, forceRender] = useState(0);
    const [snoozed, setSnoozed] = useState({});
    const [snoozeMenuId, setSnoozeMenuId] = useState(null);
    const [prefs, setPrefs] = useState(readReminderPrefs);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const snoozeTimersRef = useRef(new Map());
    const prevReminderIds = useRef(new Set());
    const menuRef = useRef(null);
    const containerRef = useRef(null);
    const errorCountRef = useRef(0);
    const snoozedRef = useRef(snoozed);
    snoozedRef.current = snoozed;
    useEffect(() => {
        try {
            const raw = localStorage.getItem('cal-reminder-dismissed');
            if (raw)
                dismissedRef.current = new Set(JSON.parse(raw));
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
    const saveDismissed = useCallback((next) => {
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
    const processEvents = useCallback((events, isConnected) => {
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
        let timer;
        let cancelled = false;
        const controller = new AbortController();
        async function poll() {
            if (cancelled)
                return;
            if (typeof document !== 'undefined' && document.hidden) {
                schedulePoll(BASE_POLL_INTERVAL);
                return;
            }
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
                const { connected: c } = await getCalendarStatus(controller.signal);
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
                const events = await getCalendarEvents(start.toISOString(), end.toISOString(), undefined, controller.signal);
                if (cancelled)
                    return;
                errorCountRef.current = 0;
                processEvents(events, true);
                schedulePoll(BASE_POLL_INTERVAL);
            }
            catch {
                if (cancelled || controller.signal.aborted)
                    return;
                errorCountRef.current += 1;
                const backoff = Math.min(BASE_POLL_INTERVAL * Math.pow(2, errorCountRef.current), MAX_POLL_INTERVAL);
                schedulePoll(backoff);
            }
        }
        function schedulePoll(ms) {
            if (cancelled)
                return;
            timer = setTimeout(poll, ms);
        }
        timer = setTimeout(poll, 3000);
        const onVisibility = () => {
            if (cancelled || document.hidden)
                return;
            clearTimeout(timer);
            timer = setTimeout(poll, 250);
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            cancelled = true;
            controller.abort();
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
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
        if (!settingsOpen)
            return;
        const handler = (e) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target))
                setSettingsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [settingsOpen]);
    const updatePrefs = useCallback((patch) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            try {
                localStorage.setItem(PREFS_KEY, JSON.stringify(next));
            }
            catch { }
            return next;
        });
    }, []);
    useEffect(() => {
        if (!snoozeMenuId)
            return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setSnoozeMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [snoozeMenuId]);
    const handleAddTime = useCallback((reminder) => {
        queueOutlookAddTime(reminder.event);
        const next = new Set(dismissedRef.current);
        next.add(reminder.id);
        saveDismissed(next);
        setSnoozeMenuId(null);
        const path = window.location.pathname;
        const onTimeTracking = path === routes.timeTracking || path.startsWith(`${routes.timeTracking}/`);
        if (!onTimeTracking) {
            const url = new URL(routes.timeTracking, window.location.origin);
            url.searchParams.set('tab', 'timesheet');
            window.location.assign(`${url.pathname}${url.search}`);
        }
    }, [saveDismissed]);
    const handleDismiss = useCallback((id) => {
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
    const handleSnooze = useCallback((id, minutes) => {
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
    return createPortal(_jsxs("div", { className: `cal-remind cal-remind--${prefs.corner} cal-remind--${prefs.theme}`, children: [_jsxs("div", { className: "cal-remind__header", children: [_jsx("span", { className: "cal-remind__title", children: "\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F" }), _jsxs("div", { className: "cal-remind__settings-wrap", ref: settingsRef, children: [_jsx("button", { type: "button", className: `cal-remind__settings-btn${settingsOpen ? ' cal-remind__settings-btn--on' : ''}`, "aria-expanded": settingsOpen, onClick: () => {
                                    setSnoozeMenuId(null);
                                    setSettingsOpen((open) => !open);
                                }, children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438" }), settingsOpen && (_jsxs("div", { className: "cal-remind__settings", role: "dialog", "aria-label": "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439", children: [_jsx("p", { className: "cal-remind__settings-label", children: "\u041E\u0442\u043A\u0443\u0434\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C" }), _jsx("div", { className: "cal-remind__choice-grid", children: CORNERS.map((corner) => (_jsx("button", { type: "button", className: `cal-remind__choice${prefs.corner === corner.id ? ' cal-remind__choice--on' : ''}`, onClick: () => updatePrefs({ corner: corner.id }), children: corner.label }, corner.id))) }), _jsx("p", { className: "cal-remind__settings-label", children: "\u0422\u0435\u043C\u0430" }), _jsxs("div", { className: "cal-remind__choice-row", children: [_jsx("button", { type: "button", className: `cal-remind__choice${prefs.theme === 'light' ? ' cal-remind__choice--on' : ''}`, onClick: () => updatePrefs({ theme: 'light' }), children: "\u0421\u0432\u0435\u0442\u043B\u0430\u044F" }), _jsx("button", { type: "button", className: `cal-remind__choice${prefs.theme === 'dark' ? ' cal-remind__choice--on' : ''}`, onClick: () => updatePrefs({ theme: 'dark' }), children: "\u0422\u0451\u043C\u043D\u0430\u044F" })] })] }))] }), _jsx("button", { type: "button", className: "cal-remind__dismiss-all", onClick: handleDismissAll, children: "\u041F\u0440\u0435\u043A\u0440\u0430\u0442\u0438\u0442\u044C \u0432\u0441\u0435" }), _jsx("button", { type: "button", className: "cal-remind__close", onClick: handleDismissAll, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsx("div", { className: "cal-remind__list", children: visible.map(r => (_jsxs("div", { className: "cal-remind__item", children: [_jsxs("div", { className: "cal-remind__main", children: [_jsx("div", { className: "cal-remind__icon", children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }) }), _jsxs("div", { className: "cal-remind__body", children: [_jsx("div", { className: "cal-remind__subject", children: r.subject }), _jsx("div", { className: "cal-remind__time", children: r.timeLabel })] }), _jsx("div", { className: "cal-remind__until", children: r.untilLabel }), _jsxs("div", { className: "cal-remind__actions", children: [_jsx("button", { type: "button", className: "cal-remind__btn", onClick: () => handleDismiss(r.id), title: "\u041F\u0440\u0435\u043A\u0440\u0430\u0442\u0438\u0442\u044C", children: _jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }), _jsx("button", { type: "button", className: "cal-remind__btn cal-remind__btn--snooze", onClick: () => setSnoozeMenuId(prev => prev === r.id ? null : r.id), title: "\u041E\u0442\u043B\u043E\u0436\u0438\u0442\u044C", children: _jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }) }), snoozeMenuId === r.id && (_jsx("div", { ref: menuRef, className: "cal-remind__snooze-menu", children: SNOOZE_OPTIONS.map(m => (_jsx("button", { type: "button", className: "cal-remind__snooze-opt", onClick: () => handleSnooze(r.id, m), children: m < 60 ? `${m} мин` : `${m / 60} ч` }, m))) }))] })] }), _jsx("button", { type: "button", className: "cal-remind__add", onClick: () => handleAddTime(r), children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0440\u0435\u043C\u044F" })] }, r.id))) })] }), containerRef.current);
}
