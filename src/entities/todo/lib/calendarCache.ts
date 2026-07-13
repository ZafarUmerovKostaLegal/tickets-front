import type { CalendarEvent } from '@entities/todo/lib/calendarApi';
type CacheData = {
    events: CalendarEvent[];
    connected: boolean;
    updatedAt: number;
};
const cache: CacheData = {
    events: [],
    connected: false,
    updatedAt: 0,
};
const listeners = new Set<() => void>();
export function setCalendarCache(events: CalendarEvent[], connected: boolean) {
    cache.events = events;
    cache.connected = connected;
    cache.updatedAt = Date.now();
    listeners.forEach(fn => fn());
}
export function getCalendarCache(): CacheData {
    return { ...cache };
}
export function isCacheFresh(maxAgeMs = 120000): boolean {
    return cache.updatedAt > 0 && (Date.now() - cache.updatedAt) < maxAgeMs;
}
export function onCacheUpdate(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
