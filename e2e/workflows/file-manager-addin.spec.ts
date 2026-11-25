import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';

function ago(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function mockAddin(page: Page, quiet = false) {
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: {
        viewer: { userId: 1, name: 'Partner P', canManage: true }, clients: [], requestable: [],
    } }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
    const base = { officeVersion: '16.0.20625.20108', ssoStatus: 'unknown', ssoError: '', ip: '192.168.230.235', firstSeen: ago(9000) };
    const clients = [
        { ...base, clientId: 'outlook-a1b2c3d4', userId: 1, userName: 'Zafar Umerov', host: 'outlook', platform: 'web', officeVersion: '0.0.0.0', addinVersion: '1.3.0', authMethod: 'token', lastSeen: ago(2), online: true },
        { ...base, clientId: 'word-a1b2c3d4', userId: 1, userName: 'Zafar Umerov', host: 'word', platform: 'windows', addinVersion: '1.2.5', authMethod: 'token', lastSeen: ago(1500), online: false },
        { ...base, clientId: 'outlook-e5f6g7h8', userId: 2, userName: 'Iroda Tursunova', host: 'outlook', platform: 'windows', addinVersion: '1.3.0', authMethod: 'sso', lastSeen: ago(4), online: true },
        { ...base, clientId: 'excel-e5f6g7h8', userId: 3, userName: 'Bekzod Karimov', host: 'excel', platform: 'mac', addinVersion: '1.3.0', authMethod: 'dialog', ssoStatus: 'failed', ssoError: 'AADSTS50011 redirect mismatch', lastSeen: ago(300), online: false },
    ];
    const failures = quiet ? [] : [
        { id: 2, clientId: 'outlook-mob1', email: 'zumerov@kostalegal.com', host: 'outlook', platform: 'ios', officeVersion: '4.2547.0', addinVersion: '1.3.0', error: 'Не удалось открыть окно входа (12011)\nУстройство: outlook · ios · Office 4.2547.0 · Kosta File 1.3.0\nOffice SSO: 13012: API is not supported\nNAA: timeout', ip: '10.0.0.8', at: ago(12) },
        { id: 1, clientId: '', email: '', host: 'outlook', platform: 'android', officeVersion: '', addinVersion: '1.3.0', error: 'Окно входа закрыто.', ip: '10.0.0.9', at: ago(200) },
    ];
    await page.route('**/api/v1/files/admin/addin-clients**', (route) => route.fulfill({ json: {
        clients: quiet ? clients.slice(0, 1) : clients,
        failures,
        summary: { online: 2, onlineUsers: 2, users: 3, installs: 4, ssoProblems: 1, signinFailures: failures.length },
    } }));
}

test.describe('@e2e Файловый менеджер: Kosta File', () => {
    test('сотрудники с устройствами, старые версии и неудачные входы', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await loginAs('admin');
        await mockAddin(page);
        await page.goto('/files?view=addin');
        await expect(page.locator('.fm-kf-person')).toHaveCount(3, { timeout: 30_000 });
        await expect(page.locator('.fm-kf-fail')).toHaveCount(2);
        await expect(page.locator('.fm-kf-fail').first()).toContainText('zumerov@kostalegal.com');
        await expect(page.locator('.fm-kf-badge.is-warn')).toContainText('1.2.5');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/kf-1440.png`, fullPage: true });
        await page.locator('.fm-mon-kpi', { hasText: 'Старая версия' }).click();
        await expect(page.locator('.fm-kf-person')).toHaveCount(1);
        await page.locator('.fm-kf__tab', { hasText: 'Все' }).click();
        await page.getByRole('searchbox').fill('Iroda');
        await expect(page.locator('.fm-kf-person')).toHaveCount(1);
    });

    test('390 и тёмная тема', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 390, height: 860 });
        await page.addInitScript(() => {
            try {
                localStorage.setItem('appTheme', 'dark');
            }
            catch {
                return;
            }
        });
        await loginAs('admin');
        await mockAddin(page);
        await page.goto('/files?view=addin');
        await expect(page.locator('.fm-kf-person').first()).toBeVisible({ timeout: 30_000 });
        if (SHOTS)
        {
            await page.screenshot({ path: `${SHOTS}/kf-390.png`, fullPage: true });
            await page.locator('.fm-kf__split').screenshot({ path: `${SHOTS}/kf-390-fails.png` });
            await page.locator('.fm-kf-people').screenshot({ path: `${SHOTS}/kf-390-people.png` });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
});
