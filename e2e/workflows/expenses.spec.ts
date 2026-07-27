import { test, expect } from '../fixtures/test';

test.describe('@e2e @flows Expenses workflows', () => {
    test('expense form panel visible', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/expenses');
        await expect(page.locator('.expenses-page')).toBeVisible({ timeout: 15_000 });

        const layout = await page.locator('.expenses-page').evaluate((root) => {
            const main = root.querySelector<HTMLElement>('.expenses-page__main');
            const content = root.querySelector<HTMLElement>('.expenses-page__content');
            if (!main || !content)
                return null;
            return {
                mainDisplay: getComputedStyle(main).display,
                mainWidth: main.getBoundingClientRect().width,
                contentWidth: content.getBoundingClientRect().width,
            };
        });
        expect(layout).not.toBeNull();
        expect(layout?.mainDisplay).toBe('flex');
        expect(layout?.contentWidth ?? 0).toBeGreaterThan((layout?.mainWidth ?? 0) * 0.85);
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
