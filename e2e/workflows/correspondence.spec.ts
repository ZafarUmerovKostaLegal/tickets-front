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

    test('register outgoing opens template letter page', async ({ page }) => {
        await page.goto('/correspondence?tab=outgoing');
        await expect(page.locator('.corr-shell, main').first()).toBeVisible({ timeout: 15_000 });
        const btn = page.getByRole('button', { name: /зарегистрировать исходящ/i });
        await expect(btn).toBeVisible({ timeout: 15_000 });
        await btn.click();
        await expect(page).toHaveURL(/\/correspondence\/outgoing\/new/);
        await expect(page.getByText(/тема/i).first()).toBeVisible({ timeout: 15_000 });
    });
});
