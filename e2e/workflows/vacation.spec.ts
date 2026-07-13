import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Vacation workflows', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    test('schedule tab loads', async ({ page }) => {
        await page.goto('/vacation-schedule');
        await expect(page.locator('[class*="vacation"], .vacation, main').first()).toBeVisible({ timeout: 15_000 });
    });

    test('my requests tab if present', async ({ page }) => {
        await page.goto('/vacation-schedule');
        const tab = page.getByRole('tab', { name: /мои заявки/i });
        if (await tab.count())
            await tab.first().click();
    });
});
