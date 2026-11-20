import { test, expect } from '../fixtures/test';

const now = new Date().toISOString();
const hourAgo = new Date(Date.now() - 3600_000).toISOString();

for (const width of [1440, 390]) { // desktop + phone
    test(`@e2e Профиль → Устройства: список и завершение сеансов (${width})`, async ({ page, loginAs }) => {
        await page.setViewportSize({ width, height: 860 });
        await loginAs('partner');
        let sessions = [
            { id: 3, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', ip: '192.168.230.15', createdAt: hourAgo, lastSeenAt: now, current: true },
            { id: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', ip: '94.158.52.10', createdAt: '2026-11-18T07:12:00Z', lastSeenAt: '2026-11-19T18:40:00Z', current: false },
            { id: 1, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', ip: '10.0.0.7', createdAt: '2026-11-10T09:00:00Z', lastSeenAt: '2026-11-12T10:00:00Z', current: false },
        ];
        await page.route('**/api/v1/auth/azure/sessions**', async (route) => {
            const request = route.request();
            const path = new URL(request.url()).pathname;
            if (request.method() === 'DELETE') {
                const id = Number(path.split('/').pop());
                sessions = sessions.filter((row) => row.id !== id);
                return route.fulfill({ status: 204 });
            }
            if (path.endsWith('/end-others')) {
                const ended = sessions.filter((row) => !row.current).length;
                sessions = sessions.filter((row) => row.current);
                return route.fulfill({ json: { ended } });
            }
            return route.fulfill({ json: { sessions } });
        });
        await page.goto('/home');
        await page.getByRole('button', { name: 'Меню пользователя' }).click();
        await page.getByRole('menuitem', { name: 'Устройства' }).click();
        const dialog = page.getByRole('dialog', { name: 'Устройства и сеансы' });
        await expect(dialog.getByText('Chrome · Windows')).toBeVisible();
        await expect(dialog.getByText('Это устройство')).toBeVisible();
        await dialog.locator('li', { hasText: 'Safari · iPhone' }).getByRole('button', { name: 'Завершить' }).click();
        await expect(dialog.getByText('Safari · iPhone')).toHaveCount(0);
        await dialog.getByRole('button', { name: /Завершить все остальные/ }).click();
        await expect(dialog.locator('li')).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
}
