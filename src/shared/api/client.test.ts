import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/config', () => ({
    getApiBaseUrl: () => 'https://api.test',
    getAzureLoginUrl: () => '',
    upgradeUrlToPageSecurity: (url: string) => url,
    isSessionCookieOnly: () => true,
}));
vi.mock('@shared/lib/auth', () => ({
    getAccessToken: () => null,
    removeAccessToken: vi.fn(),
    setSessionCookieHint: vi.fn(),
}));
vi.mock('@shared/lib/authSessionCleanup', () => ({
    clearClientSessionSecrets: vi.fn(),
}));
vi.mock('@shared/lib/trustedApiFetchUrl', () => ({
    assertSafeRelativeApiPath: vi.fn(),
    assertTrustedApiFetchPathOrUrl: vi.fn(),
}));

import { apiFetch, invalidateApiGetReuse } from './client';

describe('apiFetch GET deduplication', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('performs one network request and gives every caller a readable response', async () => {
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolveFetch = done; }));
        vi.stubGlobal('fetch', fetchMock);

        const first = apiFetch('/api/v1/concurrent');
        const second = apiFetch('/api/v1/concurrent');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        resolveFetch(new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' },
        }));

        const [firstResponse, secondResponse] = await Promise.all([first, second]);
        await expect(firstResponse.json()).resolves.toEqual({ ok: true });
        await expect(secondResponse.json()).resolves.toEqual({ ok: true });
    });

    it('does not join a post-mutation GET to an older in-flight GET', async () => {
        const pendingGets: Array<(response: Response) => void> = [];
        const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
            if ((init?.method ?? 'GET').toUpperCase() === 'POST')
                return Promise.resolve(new Response(null, { status: 204 }));
            return new Promise<Response>((done) => pendingGets.push(done));
        });
        vi.stubGlobal('fetch', fetchMock);

        const beforeMutation = apiFetch('/api/v1/mutation');
        await apiFetch('/api/v1/mutation', { method: 'POST' });
        const afterMutation = apiFetch('/api/v1/mutation');

        expect(fetchMock).toHaveBeenCalledTimes(3);
        pendingGets[0](new Response('before'));
        pendingGets[1](new Response('after'));
        await expect((await beforeMutation).text()).resolves.toBe('before');
        await expect((await afterMutation).text()).resolves.toBe('after');
    });

    it('shares a GET between abortable callers without cancelling the remaining caller', async () => {
        let resolveFetch!: (response: Response) => void;
        let networkSignal: AbortSignal | undefined;
        const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
            networkSignal = init?.signal ?? undefined;
            return new Promise<Response>((done) => { resolveFetch = done; });
        });
        vi.stubGlobal('fetch', fetchMock);

        const firstController = new AbortController();
        const secondController = new AbortController();
        const first = apiFetch('/api/v1/abortable-shared', { signal: firstController.signal });
        const second = apiFetch('/api/v1/abortable-shared', { signal: secondController.signal });

        firstController.abort();
        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(networkSignal?.aborted).toBe(false);

        resolveFetch(new Response('shared'));
        await expect((await second).text()).resolves.toBe('shared');
    });

    it('reuses the same network request when a StrictMode-style remount follows an abort', async () => {
        vi.useFakeTimers();
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolveFetch = done; }));
        vi.stubGlobal('fetch', fetchMock);

        const firstController = new AbortController();
        const first = apiFetch('/api/v1/remount', { signal: firstController.signal });
        firstController.abort();
        await expect(first).rejects.toMatchObject({ name: 'AbortError' });

        await vi.advanceTimersByTimeAsync(50);
        const second = apiFetch('/api/v1/remount', { signal: new AbortController().signal });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        resolveFetch(new Response('remounted'));
        await expect((await second).text()).resolves.toBe('remounted');
        await vi.advanceTimersByTimeAsync(250);
    });

    it('reuses a just-completed successful GET during the short dedupe window', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(new Response('fresh')));
        vi.stubGlobal('fetch', fetchMock);

        await expect((await apiFetch('/api/v1/sequential')).text()).resolves.toBe('fresh');
        await expect((await apiFetch('/api/v1/sequential')).text()).resolves.toBe('fresh');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not reuse a completed GET after an external data invalidation', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('before-push'))
            .mockResolvedValueOnce(new Response('after-push'));
        vi.stubGlobal('fetch', fetchMock);

        await expect((await apiFetch('/api/v1/pushed')).text()).resolves.toBe('before-push');
        invalidateApiGetReuse();
        await expect((await apiFetch('/api/v1/pushed')).text()).resolves.toBe('after-push');

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent no-store GETs but never reuses them after completion', async () => {
        let resolveFetch!: (response: Response) => void;
        const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolveFetch = done; }));
        vi.stubGlobal('fetch', fetchMock);

        const first = apiFetch('/api/v1/no-store', { cache: 'no-store' });
        const second = apiFetch('/api/v1/no-store', { cache: 'no-store' });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        resolveFetch(new Response('shared'));
        await expect((await first).text()).resolves.toBe('shared');
        await expect((await second).text()).resolves.toBe('shared');

        const next = apiFetch('/api/v1/no-store', { cache: 'no-store' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        resolveFetch(new Response('new'));
        await expect((await next).text()).resolves.toBe('new');
    });
});
