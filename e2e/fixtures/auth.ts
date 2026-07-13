import type { Page } from '@playwright/test';
import { installApiMocks, type ApiMockOptions } from './api-mock';
import { USERS, type UserPersona } from './users';

const TOKEN = 'e2e-test-access-token';

async function seedAuthStorage(page: Page): Promise<void> {
    await page.addInitScript((token) => {
        localStorage.setItem('access_token', token);
        localStorage.removeItem('kl_session_cookie_ok');
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('statuses') || key.startsWith('priorities') || key.startsWith('users:') || key.startsWith('boards-list'))
                localStorage.removeItem(key);
        }
    }, TOKEN);
}

export async function loginAs(page: Page, persona: UserPersona, overrides?: ApiMockOptions['overrides']): Promise<void> {
    const user = USERS[persona];
    await installApiMocks(page, { user, overrides });
    await seedAuthStorage(page);
    await page.goto('/home', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForURL('**/home', { timeout: 60_000 });
}

export async function loginAsUser(page: Page, options: ApiMockOptions): Promise<void> {
    await installApiMocks(page, options);
    await seedAuthStorage(page);
    await page.goto('/home', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForURL('**/home', { timeout: 60_000 });
}

export async function clearAuth(page: Page): Promise<void> {
    await page.addInitScript(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('kl_session_cookie_ok');
        sessionStorage.clear();
    });
}

export { TOKEN };
