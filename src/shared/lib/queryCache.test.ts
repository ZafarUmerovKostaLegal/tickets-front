import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryCache } from './queryCache';

function installMemoryStorage(): Map<string, string> {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
    });
    return values;
}

describe('createQueryCache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-27T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('shares one in-flight loader between concurrent callers', async () => {
        const cache = createQueryCache<string>({ ttlMs: 1_000 });
        let resolve!: (value: string) => void;
        const loader = vi.fn(() => new Promise<string>((done) => { resolve = done; }));

        const first = cache.fetch('same', loader);
        const second = cache.fetch('same', loader);

        expect(loader).toHaveBeenCalledTimes(1);
        resolve('loaded');
        await expect(Promise.all([first, second])).resolves.toEqual(['loaded', 'loaded']);
    });

    it('starts only one background refresh for stale persisted data', async () => {
        const storage = installMemoryStorage();
        storage.set('persisted', JSON.stringify({
            value: 'stale',
            expiresAt: Date.now() - 1,
        }));
        const cache = createQueryCache<string>({ ttlMs: 1_000, storageKey: 'persisted' });
        let resolve!: (value: string) => void;
        const loaderPromise = new Promise<string>((done) => { resolve = done; });
        const loader = vi.fn(() => loaderPromise);

        await expect(cache.fetch('persisted', loader)).resolves.toBe('stale');
        await expect(cache.fetch('persisted', loader)).resolves.toBe('stale');
        expect(loader).toHaveBeenCalledTimes(1);

        resolve('fresh');
        await loaderPromise;
        await Promise.resolve();
        expect(cache.get('persisted')).toBe('fresh');
    });

    it('does not let an invalidated request overwrite a newer result', async () => {
        const cache = createQueryCache<string>({ ttlMs: 1_000 });
        const resolvers: Array<(value: string) => void> = [];
        const loader = vi.fn(() => new Promise<string>((done) => resolvers.push(done)));

        const oldRequest = cache.fetch('same', loader);
        cache.invalidate('same');
        const freshRequest = cache.fetch('same', loader);

        expect(loader).toHaveBeenCalledTimes(2);
        resolvers[1]('fresh');
        await expect(freshRequest).resolves.toBe('fresh');
        resolvers[0]('stale');
        await expect(oldRequest).resolves.toBe('stale');
        expect(cache.get('same')).toBe('fresh');
    });

    it('lets one caller abort without cancelling a shared loader', async () => {
        const cache = createQueryCache<string>({ ttlMs: 1_000 });
        let resolve!: (value: string) => void;
        let sharedSignal: AbortSignal | undefined;
        const loader = vi.fn((signal?: AbortSignal) => {
            sharedSignal = signal;
            return new Promise<string>((done) => { resolve = done; });
        });
        const firstController = new AbortController();
        const secondController = new AbortController();

        const first = cache.fetch('shared-abort', loader, { signal: firstController.signal });
        const second = cache.fetch('shared-abort', loader, { signal: secondController.signal });
        firstController.abort();

        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        expect(sharedSignal?.aborted).toBe(false);
        resolve('loaded');
        await expect(second).resolves.toBe('loaded');
    });

    it('aborts an unused loader after the remount grace period', async () => {
        const cache = createQueryCache<string>({ ttlMs: 1_000 });
        let sharedSignal: AbortSignal | undefined;
        const loader = vi.fn((signal?: AbortSignal) => {
            sharedSignal = signal;
            return new Promise<string>(() => { });
        });
        const controller = new AbortController();

        const request = cache.fetch('unused', loader, { signal: controller.signal });
        controller.abort();
        await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        expect(sharedSignal?.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(75);
        expect(sharedSignal?.aborted).toBe(true);
    });

    it('bounds dynamic keys with LRU eviction', () => {
        const cache = createQueryCache<string>({ ttlMs: 1_000, maxEntries: 2 });
        cache.prime('first', '1');
        cache.prime('second', '2');
        cache.prime('third', '3');

        expect(cache.get('first')).toBeUndefined();
        expect(cache.get('second')).toBe('2');
        expect(cache.get('third')).toBe('3');
    });

    it('returns stale memory immediately while refreshing in the background', async () => {
        const cache = createQueryCache<string>({
            ttlMs: 1_000,
            staleWhileRevalidateMs: 5_000,
        });
        cache.prime('swr', 'stale');
        vi.advanceTimersByTime(1_001);
        let resolve!: (value: string) => void;
        const loader = vi.fn(() => new Promise<string>((done) => { resolve = done; }));

        await expect(cache.fetch('swr', loader)).resolves.toBe('stale');
        expect(loader).toHaveBeenCalledTimes(1);
        resolve('fresh');
        await Promise.resolve();
        await Promise.resolve();
        expect(cache.get('swr')).toBe('fresh');
    });
});
