const cache = {
    events: [],
    connected: false,
    updatedAt: 0,
};
const listeners = new Set();
export function setCalendarCache(events, connected) {
    cache.events = events;
    cache.connected = connected;
    cache.updatedAt = Date.now();
    listeners.forEach(fn => fn());
}
export function getCalendarCache() {
    return { ...cache };
}
export function isCacheFresh(maxAgeMs = 120000) {
    return cache.updatedAt > 0 && (Date.now() - cache.updatedAt) < maxAgeMs;
}
export function onCacheUpdate(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
