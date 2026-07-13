

export type QueryCacheOptions = {

    ttlMs: number;

    storageKey?: string;
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

    fetch(key: string, loader: () => Promise<T>): Promise<T>;

    prime(key: string, value: T): void;

    invalidate(key?: string): void;
};

export function createQueryCache<T>(options: QueryCacheOptions): QueryCache<T> {
    const { ttlMs, storageKey } = options;

    const store = new Map<string, Entry<T>>();
    const inflight = new Map<string, Promise<T>>();

    function now(): number {
        return Date.now();
    }

    function isFresh(entry: Entry<T>): boolean {
        return entry.expiresAt > now();
    }

    function makeEntry(value: T): Entry<T> {
        return { value, expiresAt: now() + ttlMs };
    }

    function setEntry(key: string, value: T): void {
        const entry = makeEntry(value);
        store.set(key, entry);
        if (storageKey && key === storageKey) {
            writeStorage(storageKey, entry);
        }
    }

    const cache: QueryCache<T> = {
        get(key: string): T | undefined {
            const entry = store.get(key);
            if (!entry) return undefined;
            if (!isFresh(entry)) {
                store.delete(key);
                return undefined;
            }
            return entry.value;
        },

        async fetch(key: string, loader: () => Promise<T>): Promise<T> {
            const inMem = store.get(key);
            if (inMem && isFresh(inMem)) {
                return inMem.value;
            }

            if (storageKey && key === storageKey) {
                const stored = readStorage<T>(storageKey);
                if (stored) {
                    if (isFresh(stored)) {
                        store.set(key, stored);
                        return stored.value;
                    }
                    store.set(key, stored);
                    void (async () => {
                        try {
                            const fresh = await loader();
                            setEntry(key, fresh);
                        } catch {
                        }
                    })();
                    return stored.value;
                }
            }

            const existing = inflight.get(key);
            if (existing) return existing;

            const promise = (async () => {
                try {
                    const value = await loader();
                    setEntry(key, value);
                    return value;
                } finally {
                    inflight.delete(key);
                }
            })();

            inflight.set(key, promise);
            return promise;
        },

        prime(key: string, value: T): void {
            setEntry(key, value);
        },

        invalidate(key?: string): void {
            if (key !== undefined) {
                store.delete(key);
                inflight.delete(key);
            } else {
                store.clear();
                inflight.clear();
                if (storageKey) {
                    removeStorage(storageKey);
                }
            }
        },
    };

    return cache;
}
