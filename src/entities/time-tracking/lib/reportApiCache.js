const REPORT_CACHE_TTL_MS = 90_000;
const _store = new Map();
function _now() {
    return Date.now();
}
export function reportCacheGet(key) {
    const entry = _store.get(key);
    if (!entry)
        return undefined;
    if (_now() > entry.expiresAt) {
        _store.delete(key);
        return undefined;
    }
    return entry.value;
}
export function reportCacheSet(key, value) {
    _store.set(key, { value, expiresAt: _now() + REPORT_CACHE_TTL_MS });
}
export function reportCacheDelete(key) {
    _store.delete(key);
}
export function reportCacheInvalidateAll() {
    _store.clear();
}
export function reportCacheInvalidatePrefix(prefix) {
    for (const key of _store.keys()) {
        if (key.startsWith(prefix))
            _store.delete(key);
    }
}
export function reportCacheEvictExpired() {
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
export function reportCacheSize() {
    return _store.size;
}
