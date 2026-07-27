

export type QueryCacheOptions = {
    ttlMs: number;
    storageKey?: string;
    maxEntries?: number;
    staleWhileRevalidateMs?: number;
    maxPersistedStaleMs?: number;
};

export type QueryCacheFetchOptions = {
    signal?: AbortSignal;
};

type Entry<T> = {
    value: T;
    expiresAt: number;
};

function readStorage<T>(storageKey: string): Entry<T> | null {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Entry<T>;
        if (typeof parsed.expiresAt !== 'number' || !('value' in parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeStorage<T>(storageKey: string, entry: Entry<T>): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch {
    }
}

function removeStorage(storageKey: string): void {
    try {
        localStorage.removeItem(storageKey);
    } catch {  }
}

export type QueryCache<T> = {
    get(key: string): T | undefined;
    fetch(key: string, loader: (signal?: AbortSignal) => Promise<T>, options?: QueryCacheFetchOptions): Promise<T>;
    prime(key: string, value: T): void;
    invalidate(key?: string): void;
};

type InflightEntry<T> = {
    promise: Promise<T>;
    controller: AbortController;
    consumers: number;
    keepAlive: boolean;
    settled: boolean;
    abortTimer?: ReturnType<typeof setTimeout>;
};

export function createQueryCache<T>(options: QueryCacheOptions): QueryCache<T> {
    const {
        ttlMs,
        storageKey,
        maxEntries = 100,
        staleWhileRevalidateMs = 0,
        maxPersistedStaleMs = 24 * 60 * 60_000,
    } = options;
    const abortGraceMs = 75;
    const store = new Map<string, Entry<T>>();
    const inflight = new Map<string, InflightEntry<T>>();
    const keyVersions = new Map<string, number>();
    let globalVersion = 0;

    function now(): number {
        return Date.now();
    }

    function isFresh(entry: Entry<T>): boolean {
        return entry.expiresAt > now();
    }

    function canUseStale(entry: Entry<T>, staleWindowMs: number): boolean {
        return staleWindowMs > 0 && now() - entry.expiresAt <= staleWindowMs;
    }

    function touchEntry(key: string, entry: Entry<T>): void {
        store.delete(key);
        store.set(key, entry);
    }

    function trimStore(): void {
        while (store.size > Math.max(1, maxEntries)) {
            const oldestKey = store.keys().next().value as string | undefined;
            if (oldestKey === undefined)
                break;
            store.delete(oldestKey);
        }
    }

    function setEntry(key: string, value: T): void {
        const entry = { value, expiresAt: now() + ttlMs };
        touchEntry(key, entry);
        trimStore();
        if (storageKey && key === storageKey)
            writeStorage(storageKey, entry);
    }

    function abortReason(signal?: AbortSignal): unknown {
        if (signal?.reason !== undefined)
            return signal.reason;
        return new DOMException('The operation was aborted.', 'AbortError');
    }

    function scheduleUnusedAbort(key: string, entry: InflightEntry<T>): void {
        if (entry.keepAlive || entry.settled || entry.consumers !== 0 || entry.abortTimer !== undefined)
            return;
        entry.abortTimer = setTimeout(() => {
            entry.abortTimer = undefined;
            if (entry.keepAlive || entry.settled || entry.consumers !== 0)
                return;
            if (inflight.get(key) === entry)
                inflight.delete(key);
            entry.controller.abort();
        }, abortGraceMs);
    }

    function startLoad(
        key: string,
        loader: (signal?: AbortSignal) => Promise<T>,
        keepAlive = false,
    ): InflightEntry<T> {
        const existing = inflight.get(key);
        if (existing) {
            if (keepAlive)
                existing.keepAlive = true;
            return existing;
        }

        const controller = new AbortController();
        const loadGlobalVersion = globalVersion;
        const loadKeyVersion = keyVersions.get(key) ?? 0;
        let loadPromise: Promise<T>;
        try {
            loadPromise = loader(controller.signal);
        }
        catch (error) {
            loadPromise = Promise.reject(error);
        }
        const promise = loadPromise.then((value) => {
                if (globalVersion === loadGlobalVersion && (keyVersions.get(key) ?? 0) === loadKeyVersion)
                    setEntry(key, value);
                return value;
            });
        const entry: InflightEntry<T> = {
            promise,
            controller,
            consumers: 0,
            keepAlive,
            settled: false,
        };
        inflight.set(key, entry);
        const clearInflight = () => {
            entry.settled = true;
            if (entry.abortTimer !== undefined) {
                clearTimeout(entry.abortTimer);
                entry.abortTimer = undefined;
            }
            if (inflight.get(key) === entry)
                inflight.delete(key);
        };
        void promise.then(clearInflight, clearInflight);
        return entry;
    }

    function subscribeLoad(key: string, entry: InflightEntry<T>, signal?: AbortSignal): Promise<T> {
        if (signal?.aborted)
            return Promise.reject(abortReason(signal));
        entry.consumers += 1;
        if (entry.abortTimer !== undefined) {
            clearTimeout(entry.abortTimer);
            entry.abortTimer = undefined;
        }

        return new Promise<T>((resolve, reject) => {
            let finished = false;
            const release = () => {
                if (finished)
                    return false;
                finished = true;
                signal?.removeEventListener('abort', onAbort);
                entry.consumers = Math.max(0, entry.consumers - 1);
                scheduleUnusedAbort(key, entry);
                return true;
            };
            const onAbort = () => {
                if (release())
                    reject(abortReason(signal));
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            entry.promise.then(
                (value) => {
                    if (release())
                        resolve(value);
                },
                (error) => {
                    if (release())
                        reject(error);
                },
            );
        });
    }

    function refreshInBackground(key: string, loader: (signal?: AbortSignal) => Promise<T>): void {
        const entry = startLoad(key, loader, true);
        void entry.promise.catch(() => { });
    }

    function invalidateInflight(key: string): void {
        const entry = inflight.get(key);
        if (!entry)
            return;
        inflight.delete(key);
        entry.controller.abort();
    }

    return {
        get(key: string): T | undefined {
            const entry = store.get(key);
            if (!entry)
                return undefined;
            if (!isFresh(entry)) {
                if (!canUseStale(entry, staleWhileRevalidateMs))
                    store.delete(key);
                return undefined;
            }
            touchEntry(key, entry);
            return entry.value;
        },

        async fetch(
            key: string,
            loader: (signal?: AbortSignal) => Promise<T>,
            fetchOptions: QueryCacheFetchOptions = {},
        ): Promise<T> {
            const { signal } = fetchOptions;
            if (signal?.aborted)
                throw abortReason(signal);

            const inMem = store.get(key);
            if (inMem && isFresh(inMem)) {
                touchEntry(key, inMem);
                return inMem.value;
            }
            if (inMem && canUseStale(inMem, staleWhileRevalidateMs)) {
                touchEntry(key, inMem);
                refreshInBackground(key, loader);
                return inMem.value;
            }
            if (inMem)
                store.delete(key);

            if (storageKey && key === storageKey) {
                const stored = readStorage<T>(storageKey);
                if (stored) {
                    if (isFresh(stored)) {
                        touchEntry(key, stored);
                        trimStore();
                        return stored.value;
                    }
                    if (canUseStale(stored, maxPersistedStaleMs)) {
                        touchEntry(key, stored);
                        trimStore();
                        refreshInBackground(key, loader);
                        return stored.value;
                    }
                    removeStorage(storageKey);
                }
            }

            return subscribeLoad(key, startLoad(key, loader), signal);
        },

        prime(key: string, value: T): void {
            keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
            invalidateInflight(key);
            setEntry(key, value);
        },

        invalidate(key?: string): void {
            if (key !== undefined) {
                store.delete(key);
                keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
                invalidateInflight(key);
                if (storageKey === key)
                    removeStorage(storageKey);
                return;
            }

            store.clear();
            globalVersion += 1;
            keyVersions.clear();
            for (const entry of inflight.values())
                entry.controller.abort();
            inflight.clear();
            if (storageKey)
                removeStorage(storageKey);
        },
    };
}
