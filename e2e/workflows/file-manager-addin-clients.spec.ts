import { test, expect } from '../fixtures/test';

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const clients = [
  { clientId: 'a', userId: 1, userName: 'Zafar Umerov', host: 'outlook', platform: 'windows', officeVersion: '16.0.18129', addinVersion: '1.2.0', authMethod: 'sso', ssoStatus: 'ok', ssoError: '', ip: '192.168.230.41', firstSeen: ago(9000), lastSeen: ago(1), online: true },
  { clientId: 'b', userId: 1, userName: 'Zafar Umerov', host: 'word', platform: 'windows', officeVersion: '16.0.18129', addinVersion: '1.2.0', authMethod: 'sso', ssoStatus: 'ok', ssoError: '', ip: '192.168.230.41', firstSeen: ago(9000), lastSeen: ago(3), online: true },
  { clientId: 'c', userId: 2, userName: 'Iroda Tokhirova', host: 'excel', platform: 'mac', officeVersion: '16.89', addinVersion: '1.2.0', authMethod: 'dialog', ssoStatus: 'failed', ssoError: 'AADSTS50011: The redirect URI brk-multihub://tickets.kostalegal.com is not registered', ip: '192.168.230.57', firstSeen: ago(5000), lastSeen: ago(4), online: true },
  { clientId: 'd', userId: 3, userName: 'Nigina Begalieva', host: 'outlook', platform: 'ios', officeVersion: '4.2449', addinVersion: '1.1.2', authMethod: 'cookie', ssoStatus: 'unsupported', ssoError: 'NestedAppAuth 1.1 is not supported by this Office', ip: '85.9.12.4', firstSeen: ago(3000), lastSeen: ago(2900), online: false },
];

test.describe('@e2e Kosta File: подключения надстройки', () => {
for (const width of [1440, 390]) {
  test(`managers see who is connected and sign-in problems (${width})`, async ({ page, loginAs }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAs('admin');
    await page.route('**/api/v1/files/admin/addin-clients**', (route) => route.fulfill({ json: { clients, summary: { online: 3, onlineUsers: 2, users: 3, installs: 4, ssoProblems: 2 } } }));
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: { viewer: { userId: 1, name: 'Admin', canManage: true }, clients: [], requestable: [] } }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
    await page.goto('/files?view=addin');
    const people = page.locator('.fm-kf-person');
    await expect(people).toHaveCount(3, { timeout: 20_000 });
    await expect(page.locator('.fm-kf-device')).toHaveCount(4);
    await expect(page.locator('.fm-kf-person.is-problem')).toHaveCount(2);
    await page.getByRole('tab', { name: /Проблемы со входом/ }).click();
    await expect(people).toHaveCount(2);
    await expect(page.getByText(/AADSTS50011/)).toBeVisible();
    await page.getByRole('tab', { name: /В сети/ }).click();
    await expect(people).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}
});
