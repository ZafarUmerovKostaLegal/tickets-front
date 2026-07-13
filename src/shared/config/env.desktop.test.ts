import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
    isTauri: vi.fn(() => true),
}));

vi.mock('@shared/config/tauriPlatform', () => ({
    isTauriMobileBuild: vi.fn(() => false),
}));

describe('desktop auth env', () => {
    beforeEach(() => {
        vi.stubGlobal('window', {
            location: {
                origin: 'http://localhost:5173',
                protocol: 'http:',
                host: 'localhost:5173',
            },
        });
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('useSessionCookieOnly returns false for Tauri desktop even when env prefers cookies', async () => {
        vi.stubEnv('VITE_USE_SESSION_COOKIE', 'true');
        const { useSessionCookieOnly } = await import('./env');
        expect(useSessionCookieOnly()).toBe(false);
    });

    it('getAzureLoginUrl adds redirect_uri for the app callback', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'https://ticketsback.kostalegal.com');
        const { getAzureLoginUrl } = await import('./env');
        const url = getAzureLoginUrl();
        expect(url).toContain('redirect_uri=');
        expect(decodeURIComponent(url)).toContain('http://localhost:5173/auth/callback');
    });
});
