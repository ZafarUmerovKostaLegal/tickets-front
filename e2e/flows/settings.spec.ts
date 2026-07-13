import { test, expect } from '../fixtures/test';

test.describe('Настройки приложения @flows', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    test('переключение темы оформления @smoke', async ({ page }) => {
        await page.goto('/tickets');
        const themeBtn = page.locator('.hub-header-card__theme').first();
        if (!(await themeBtn.isVisible()))
            return;
        const before = await page.locator('body').getAttribute('data-theme');
        await themeBtn.click();
        await expect(page.locator('body')).toHaveAttribute('data-theme', before === 'dark' ? 'light' : 'dark');
    });

    test('переключение языка RU/EN', async ({ page }) => {
        await page.goto('/help');
        const langBtn = page.getByRole('button', { name: /english|англ|language|язык/i }).first();
        if (!(await langBtn.isVisible()))
            return;
        await langBtn.click();
        await expect(page.getByRole('heading', { name: /help/i })).toBeVisible({ timeout: 10_000 });
    });
});
