import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ token: 'tok-1' as string | null, removed: 0 }));

vi.mock('@shared/config', () => ({
    getApiBaseUrl: () => 'https://api.test',
    getAzureLoginUrl: () => '',
    upgradeUrlToPageSecurity: (url: string) => url,
    isSessionCookieOnly: () => false,
}));
vi.mock('@shared/lib/auth', () => ({
    getAccessToken: () => auth.token,
    removeAccessToken: () => {
        auth.removed += 1;
        auth.token = null;
    },
    setSessionCookieHint: vi.fn(),
}));
vi.mock('@shared/lib/authSessionCleanup', () => ({ clearClientSessionSecrets: vi.fn() }));
vi.mock('@shared/lib/trustedApiFetchUrl', () => ({
    assertSafeRelativeApiPath: vi.fn(),
    assertTrustedApiFetchPathOrUrl: vi.fn(),
}));

import { apiFetch, resetSessionCheckForTests } from './client';

function stubServer(statusFor: (url: string) => number) {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        calls.push(url);
        return new Response('{}', { status: statusFor(url) });
    }));
    return calls;
}

describe('apiFetch 401 handling (desktop token sessions)', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
        resetSessionCheckForTests();
        auth.token = 'tok-1';
        auth.removed = 0;
    });

    it('keeps the sign-in when one endpoint says 401 but the session is alive', async () => {
        const calls = stubServer((url) => (url.endsWith('/users/me') ? 200 : 401));
        const [a, b] = await Promise.all([
            apiFetch('/api/v1/attendance/report/daily', { skipAuthRedirectOn401: true, skipGetDedupe: true }),
            apiFetch('/api/v1/expenses/cash', { skipGetDedupe: true }),
        ]);
        expect(a.status).toBe(401);
        expect(b.status).toBe(401);
        expect(auth.token).toBe('tok-1');
        expect(auth.removed).toBe(0);
        expect(calls.filter((url) => url.endsWith('/users/me'))).toHaveLength(1);
    });

    it('signs out only when /users/me confirms the session is gone', async () => {
        stubServer(() => 401);
        await apiFetch('/api/v1/tickets', { skipAuthRedirectOn401: true, skipGetDedupe: true });
        expect(auth.removed).toBe(1);
        expect(auth.token).toBeNull();
    });

    it('a network failure during the check never signs anybody out', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (url.endsWith('/users/me'))
                throw new TypeError('Failed to fetch');
            return new Response('{}', { status: 401 });
        }));
        await apiFetch('/api/v1/tickets', { skipAuthRedirectOn401: true, skipGetDedupe: true });
        expect(auth.token).toBe('tok-1');
    });

    it('does not drop a token that was replaced by a fresh sign-in meanwhile', async () => {
        stubServer((url) => {
            if (url.endsWith('/users/me'))
                auth.token = 'tok-2';
            return 401;
        });
        await apiFetch('/api/v1/tickets', { skipAuthRedirectOn401: true, skipGetDedupe: true });
        expect(auth.token).toBe('tok-2');
        expect(auth.removed).toBe(0);
    });
});
