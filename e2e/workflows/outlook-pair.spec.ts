import { test, expect } from '../fixtures/test';

test('@e2e Outlook: вход по коду подтверждается в Kosta Hub', async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await loginAs('partner');
    let confirmed = '';
    await page.route('**/api/v1/auth/outlook/pair/**', async (route) => {
        if (route.request().url().includes('/info'))
            return route.fulfill({ json: { code: 'ABCD-EFGH', device: 'Mozilla/5.0 (iPhone) Outlook-iOS', expiresIn: 500, confirmed: false } });
        confirmed = route.request().postData() ?? '';
        return route.fulfill({ status: 204, body: '' });
    });
    await page.goto('/outlook-pair?code=abcdefgh', { waitUntil: 'commit', timeout: 90000 });
    await expect(page.getByText('Outlook · iOS')).toBeVisible({ timeout: 90000 });
    await page.getByRole('button', { name: 'Подтвердить вход' }).click();
    await expect(page.getByText('Готово')).toBeVisible();
    expect(confirmed).toContain('ABCD-EFGH');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
