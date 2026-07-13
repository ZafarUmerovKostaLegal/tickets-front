import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT) || 5173;
const baseURL = `http://127.0.0.1:${PORT}`;


function resolveWorkers(): number | undefined {
    if (process.env.PW_WORKERS) {
        const n = Number(process.env.PW_WORKERS);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    const cpus = typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    if (process.env.CI)
        return Math.max(2, Math.min(4, cpus));
    return Math.max(2, Math.min(Math.floor(cpus * 0.5), 4));
}

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: resolveWorkers(),
    testIgnore: process.env.PW_REAL_BACKEND ? undefined : ['**/real-backend/**'],
    reporter: process.env.CI
        ? [
            ['blob', { outputDir: 'blob-report' }],
            ['github'],
            ['list'],
        ]
        : [
            ['list'],
            ['html', { open: 'never' }],
        ],
    timeout: 60_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL,
        trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        locale: 'ru-RU',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        ...(process.env.PW_REAL_BACKEND
            ? [{
                name: 'real-backend',
                testMatch: /real-backend\/.*\.spec\.ts/,
                use: {
                    ...devices['Desktop Chrome'],
                    baseURL: process.env.PW_STAGING_URL || process.env.E2E_GATEWAY_URL || 'http://127.0.0.1:1234',
                },
            }]
            : []),
    ],
    webServer: {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            ...process.env,
            VITE_USE_SESSION_COOKIE: 'false',
            VITE_PROXY_TARGET: 'http://127.0.0.1:65535',
        },
    },
});
