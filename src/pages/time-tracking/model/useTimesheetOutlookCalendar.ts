import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CALENDAR_NOT_CONNECTED_MSG,
    connectOutlookCalendar,
    getCalendarEvents,
    getCalendarStatus,
    getOutlookCalendars,
    type CalendarEvent,
    type OutlookCalendarItem,
} from '@entities/todo/lib/calendarApi';
import { calendarDateKey, calendarEventStartMs, indexCalendarEventsByDays } from '@entities/todo/lib/calendarEventHelpers';
import {
    buildOutlookCalendarColorOrder,
    OUTLOOK_CALENDAR_ALL_ID,
} from '@shared/ui/outlookCalendarColors';

const OUTLOOK_CALENDAR_ID_STORAGE_KEY = 'tt-timesheet-outlook-calendar-id-v1';

function readStoredOutlookCalendarId(): string {
    if (typeof window === 'undefined')
        return 'default';
    try {
        const raw = window.localStorage.getItem(OUTLOOK_CALENDAR_ID_STORAGE_KEY)?.trim();
        return raw || 'default';
    }
    catch {
        return 'default';
    }
}

function writeStoredOutlookCalendarId(id: string): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(OUTLOOK_CALENDAR_ID_STORAGE_KEY, id || 'default');
    }
    catch {
    }
}

type UseTimesheetOutlookCalendarArgs = {
    enabled: boolean;
    calendarAnchor: Date;
    calendarDays: readonly Date[];
};

export function useTimesheetOutlookCalendar({
    enabled,
    calendarAnchor,
    calendarDays,
}: UseTimesheetOutlookCalendarArgs) {
    const [connected, setConnected] = useState(false);
    const [statusChecked, setStatusChecked] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);
    const [calendars, setCalendars] = useState<OutlookCalendarItem[]>([]);
    const [calendarId, setCalendarIdState] = useState(readStoredOutlookCalendarId);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const [calendarsLoaded, setCalendarsLoaded] = useState(false);
    const eventsFetchLock = useRef(false);
    const calendarsFetchLock = useRef(false);

    const isAllCalendars = calendarId === OUTLOOK_CALENDAR_ALL_ID;

    const setCalendarId = useCallback((id: string) => {
        const next = id.trim() || 'default';
        setCalendarIdState(next);
        writeStoredOutlookCalendarId(next);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const calendar = params.get('calendar');
        if (calendar === 'connected') {
            setConnected(true);
            setConnectError(null);
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }
        if (calendar === 'error') {
            setConnectError('Не удалось подключить календарь');
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }
    }, []);

    useEffect(() => {
        let live = true;
        getCalendarStatus()
            .then(({ connected: isConnected }) => {
                if (!live)
                    return;
                setConnected(isConnected);
                if (isConnected)
                    setConnectError(null);
            })
            .catch(() => {
                if (!live)
                    return;
                setConnected(false);
            })
            .finally(() => {
                if (live)
                    setStatusChecked(true);
            });
        return () => {
            live = false;
        };
    }, []);

    const loadCalendars = useCallback(async () => {
        if (!connected || calendarsFetchLock.current)
            return;
        calendarsFetchLock.current = true;
        try {
            const list = await getOutlookCalendars();
            setCalendars(list);
            if (list.length > 1) {
                const stored = readStoredOutlookCalendarId();
                const validIds = new Set(['default', OUTLOOK_CALENDAR_ALL_ID, ...list.map((c) => c.id)]);
                if (!validIds.has(stored))
                    setCalendarId('default');
            }
            else if (list.length === 1) {
                const stored = readStoredOutlookCalendarId();
                const validIds = new Set(['default', OUTLOOK_CALENDAR_ALL_ID, list[0]!.id]);
                if (!validIds.has(stored))
                    setCalendarId(list[0]!.id);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg === CALENDAR_NOT_CONNECTED_MSG)
                setConnected(false);
        }
        finally {
            calendarsFetchLock.current = false;
            setCalendarsLoaded(true);
        }
    }, [connected, setCalendarId]);

    const resolveEventSources = useCallback((): string[] => {
        if (isAllCalendars) {
            const ids = calendars.map((c) => c.id).filter((id) => id && id !== 'default');
            return ['default', ...ids];
        }
        if (calendarId === OUTLOOK_CALENDAR_ALL_ID)
            return ['default'];
        return [calendarId];
    }, [isAllCalendars, calendars, calendarId]);

    const fetchEventsForSource = useCallback(async (
        rangeStart: string,
        rangeEnd: string,
        sourceId: string,
    ): Promise<CalendarEvent[]> => {
        let lastErr: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const list = await getCalendarEvents(rangeStart, rangeEnd, sourceId);
                return list.map((ev) => ({ ...ev, calendarId: sourceId }));
            }
            catch (err) {
                lastErr = err;
                if (attempt === 0)
                    await new Promise((r) => setTimeout(r, 400));
            }
        }
        throw lastErr;
    }, []);

    const loadEvents = useCallback(async () => {
        if (!enabled || !connected || eventsFetchLock.current)
            return;
        if (isAllCalendars && !calendarsLoaded)
            return;
        eventsFetchLock.current = true;
        setLoading(true);
        const sm = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth(), 1, 0, 0, 0, 0);
        const em = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + 1, 0, 23, 59, 59, 999);
        const rangeStart = sm.toISOString();
        const rangeEnd = em.toISOString();
        const sources = resolveEventSources();
        try {
            const merged: CalendarEvent[] = [];
            const seen = new Set<string>();
            let failed = 0;
            for (const sourceId of sources) {
                try {
                    const batch = await fetchEventsForSource(rangeStart, rangeEnd, sourceId);
                    for (const ev of batch) {
                        const dedupeKey = `${sourceId}::${ev.id}`;
                        if (seen.has(dedupeKey))
                            continue;
                        seen.add(dedupeKey);
                        merged.push(ev);
                    }
                }
                catch {
                    failed += 1;
                }
                if (sources.length > 1)
                    await new Promise((r) => setTimeout(r, 200));
            }
            merged.sort((a, b) => calendarEventStartMs(a) - calendarEventStartMs(b));
            setEvents(merged);
            if (failed > 0 && merged.length === 0) {
                setEventsError('events_all_failed');
            }
            else if (failed > 0) {
                setEventsError('events_partial_failed');
            }
            else {
                setEventsError(null);
                setConnectError(null);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg === CALENDAR_NOT_CONNECTED_MSG) {
                setConnected(false);
                setEvents([]);
                setEventsError(null);
            }
            else {
                setEventsError('events_all_failed');
            }
        }
        finally {
            eventsFetchLock.current = false;
            setLoading(false);
        }
    }, [enabled, connected, calendarAnchor, isAllCalendars, calendarsLoaded, resolveEventSources, fetchEventsForSource]);

    useEffect(() => {
        if (!enabled || !connected) {
            setCalendars([]);
            setCalendarsLoaded(false);
            return;
        }
        void loadCalendars();
    }, [enabled, connected, loadCalendars]);

    useEffect(() => {
        if (!enabled || !connected) {
            setEvents([]);
            setEventsError(null);
            return;
        }
        void loadEvents();
    }, [enabled, connected, loadEvents]);

    const eventsByDateKey = useMemo(() => indexCalendarEventsByDays(events, calendarDays), [events, calendarDays]);

    const calendarColorOrder = useMemo(
        () => buildOutlookCalendarColorOrder(
            [...calendars]
                .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
                .map((c) => c.id),
        ),
        [calendars],
    );

    const connect = useCallback(() => {
        setConnectError(null);
        connectOutlookCalendar().catch((err) => {
            const msg = err instanceof Error ? err.message : 'Не удалось подключить календарь';
            setConnectError(msg);
        });
    }, []);

    const getEventsForDateKey = useCallback((key: string) => eventsByDateKey.get(key) ?? [], [eventsByDateKey]);

    return {
        connected,
        statusChecked,
        connectError,
        eventsError,
        calendars,
        calendarId,
        setCalendarId,
        isAllCalendars,
        calendarColorOrder,
        events,
        getEventsForDateKey,
        loading,
        connect,
        refreshEvents: loadEvents,
        dateKey: calendarDateKey,
        allCalendarsId: OUTLOOK_CALENDAR_ALL_ID,
    };
}
