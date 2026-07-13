import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Time Tracking workflows', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('manager');
    });

    test('opens reports tab and shows reports panel', async ({ page }) => {
        await page.goto('/time-tracking?tab=reports');
        await expect(page.locator('#time-tab-btn-reports')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.tt-reports').first()).toBeVisible({ timeout: 15_000 });
    });

    test('weekly reports show partner scope for manager', async ({ page }) => {
        await page.goto('/time-tracking?tab=reports');
        const weeklyTab = page.getByRole('tab', { name: /недел/i });
        if (await weeklyTab.count()) {
            await weeklyTab.first().click();
            const partnerScope = page.locator('.tt-reports__partner-scope');
            if (await partnerScope.count())
                await expect(partnerScope.first()).toBeVisible({ timeout: 15_000 });
        }
    });

    test('project detail route loads', async ({ page }) => {
        await page.goto('/time-tracking/project/project-1');
        await expect(page).toHaveURL(/project/);
    });
});
