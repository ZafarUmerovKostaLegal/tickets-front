import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Expenses workflows', () => {
    test('expense form panel visible', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/expenses');
        await expect(page.locator('.expenses-page, .expenses-shell, main').first()).toBeVisible({ timeout: 15_000 });
    });

    test('moderation queue route', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.goto('/expenses/requests');
        await expect(page).toHaveURL(/expenses\/requests/);
        await expect(page.locator('.expenses-page, .expenses-shell, main').first()).toBeVisible({ timeout: 15_000 });
    });

    test('expense report route for partner', async ({ page, loginAs }) => {
        await loginAs('partner');
        await page.goto('/expenses/report');
        await expect(page).toHaveURL(/expenses\/report/);
        await expect(page.locator('.expenses-page, .expenses-shell, main').first()).toBeVisible({ timeout: 15_000 });
    });
});
