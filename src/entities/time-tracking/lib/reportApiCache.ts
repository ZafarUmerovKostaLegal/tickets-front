

type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const REPORT_CACHE_TTL_MS = 90_000;

const _store = new Map<string, CacheEntry<any>>();

function _now(): number {
    return Date.now();
}

export function reportCacheGet<T>(key: string): T | undefined {
    const entry = _store.get(key);
    if (!entry) return undefined;
    if (_now() > entry.expiresAt) {
        _store.delete(key);
        return undefined;
    }
    return entry.value as T;
}

export function reportCacheSet<T>(key: string, value: T): void {
    _store.set(key, { value, expiresAt: _now() + REPORT_CACHE_TTL_MS });
}

export function reportCacheDelete(key: string): void {
    _store.delete(key);
}

export function reportCacheInvalidateAll(): void {
    _store.clear();
}


export function reportCacheInvalidatePrefix(prefix: string): void {
    for (const key of _store.keys()) {
        if (key.startsWith(prefix)) _store.delete(key);
    }
}

export function reportCacheEvictExpired(): number {
    const now = _now();
    let count = 0;
    for (const [key, entry] of _store.entries()) {
        if (now > entry.expiresAt) {
            _store.delete(key);
            count++;
        }
    }
    return count;
}

export function reportCacheSize(): number {
    return _store.size;
}
