import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Inventory & Attendance', () => {
    test('inventory items tab', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.goto('/inventory');
        await expect(page.getByRole('tab', { name: /позиц/i })).toBeVisible({ timeout: 15_000 });
    });

    test('attendance page for admin', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.goto('/attendance');
        await expect(page.locator('.att')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('heading', { level: 1, name: 'Посещаемость' })).toBeVisible();
    });
});
