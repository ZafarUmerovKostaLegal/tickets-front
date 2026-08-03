import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Call schedule day files', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    test('open day modal shows files shelf and upload control', async ({ page }) => {
        await page.goto('/call-schedule');
        await expect(page.locator('.csched-page').first()).toBeVisible({ timeout: 15_000 });

        const dateBtn = page.locator('.csched-cal__date-open').first();
        await expect(dateBtn).toBeVisible({ timeout: 15_000 });
        await dateBtn.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(dialog.getByRole('heading', { name: /файлы дня|day files/i })).toBeVisible();
        await expect(dialog.getByRole('button', { name: /загрузить файл|upload file/i })).toBeVisible();
    });
});
