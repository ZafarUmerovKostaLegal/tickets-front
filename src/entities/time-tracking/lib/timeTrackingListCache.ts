const DEFAULT_TTL_MS = 60_000;

type CacheSlot<T> = {
    data: T;
    expiresAt: number;
};

type CacheKind = 'clients' | 'projects' | 'picker';

const MAX_ENTRIES_PER_KIND = 20;
const caches: Record<CacheKind, Map<string, CacheSlot<unknown>>> = {
    clients: new Map(),
    projects: new Map(),
    picker: new Map(),
};

function readSlot<T>(cache: Map<string, CacheSlot<unknown>>, key: string): T | null {
    const slot = cache.get(key) as CacheSlot<T> | undefined;
    if (!slot)
        return null;
    if (Date.now() >= slot.expiresAt) {
        cache.delete(key);
        return null;
    }
    // Touch the entry so the map iteration order acts as a small LRU.
    cache.delete(key);
    cache.set(key, slot as CacheSlot<unknown>);
    return slot.data;
}

function writeSlot<T>(cache: Map<string, CacheSlot<unknown>>, data: T, key: string, ttlMs: number): void {
    cache.delete(key);
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    while (cache.size > MAX_ENTRIES_PER_KIND) {
        const oldestKey = cache.keys().next().value as string | undefined;
        if (oldestKey === undefined)
            break;
        cache.delete(oldestKey);
    }
}

export function getTimeTrackingCached<T>(kind: CacheKind, key: string): T | null {
    return readSlot<T>(caches[kind], key);
}

export function setTimeTrackingCached<T>(
    kind: CacheKind,
    key: string,
    data: T,
    ttlMs = DEFAULT_TTL_MS,
): void {
    writeSlot(caches[kind], data, key, ttlMs);
}

export function invalidateTimeTrackingListCache(): void {
    caches.clients.clear();
    caches.projects.clear();
    caches.picker.clear();
}
