import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Correspondence workflows', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    test('incoming registry default tab', async ({ page }) => {
        await page.goto('/correspondence');
        await expect(page.locator('.corr-shell, main').first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('tab', { name: /входящ/i }).first()).toBeVisible({ timeout: 15_000 });
    });

    test('register incoming button opens modal', async ({ page }) => {
        await page.goto('/correspondence');
        await expect(page.locator('.corr-shell, main').first()).toBeVisible({ timeout: 15_000 });
        const btn = page.getByRole('button', { name: /зарегистрировать входящ/i });
        await expect(btn).toBeVisible({ timeout: 15_000 });
        await btn.click();
        await expect(page.getByRole('dialog', { name: /зарегистрировать входящ/i })).toBeVisible({ timeout: 10_000 });
    });
});
