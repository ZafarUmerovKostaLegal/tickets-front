const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES_PER_KIND = 20;
const caches = {
    clients: new Map(),
    projects: new Map(),
    picker: new Map(),
};
function readSlot(cache, key) {
    const slot = cache.get(key);
    if (!slot)
        return null;
    if (Date.now() >= slot.expiresAt) {
        cache.delete(key);
        return null;
    }
    // Touch the entry so the map iteration order acts as a small LRU.
    cache.delete(key);
    cache.set(key, slot);
    return slot.data;
}
function writeSlot(cache, data, key, ttlMs) {
    cache.delete(key);
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    while (cache.size > MAX_ENTRIES_PER_KIND) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined)
            break;
        cache.delete(oldestKey);
    }
}
export function getTimeTrackingCached(kind, key) {
    return readSlot(caches[kind], key);
}
export function setTimeTrackingCached(kind, key, data, ttlMs = DEFAULT_TTL_MS) {
    writeSlot(caches[kind], data, key, ttlMs);
}
export function invalidateTimeTrackingListCache() {
    caches.clients.clear();
    caches.projects.clear();
    caches.picker.clear();
}
