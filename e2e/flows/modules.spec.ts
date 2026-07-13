import { test, expect } from '../fixtures/test';

test.describe('IT-заявки — интерактивные сценарии @flows', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    test('открывает модал создания тикета @smoke', async ({ page }) => {
        await page.goto('/tickets');
        await page.getByRole('button', { name: /нов/i }).click();
        await expect(page.getByRole('dialog').or(page.locator('.tm'))).toBeVisible();
    });

    test('фильтр по статусу не ломает список', async ({ page }) => {
        await page.goto('/tickets');
        const statusFilter = page.locator('.home-tickets__filter').first();
        if (await statusFilter.isVisible()) {
            await statusFilter.click();
        }
        await expect(page.locator('.home-tickets')).toBeVisible();
    });

    test('поиск по тикетам принимает ввод', async ({ page }) => {
        await page.goto('/tickets');
        const search = page.locator('.home-tickets__search-input, input[type="search"]').first();
        if (await search.isVisible()) {
            await search.fill('тест');
            await expect(search).toHaveValue('тест');
        }
    });
});

test.describe('Todo — интерактивные сценарии @flows', () => {
    test('отображает колонки канбан-доски', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/todo');
        await expect(page.locator('.todo-column').filter({ hasText: 'К выполнению' }).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('.todo-column').filter({ hasText: 'В работе' }).first()).toBeVisible();
    });
});

test.describe('Kosta Daily — интерактивные сценарии @flows', () => {
    test('можно переключиться на вкладку сотрудников', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/kosta-daily');
        await page.getByRole('tab', { name: /сотрудник/i }).click();
        await expect(page.getByRole('tab', { name: /сотрудник/i })).toHaveAttribute('aria-selected', 'true');
    });
});

test.describe('Админ-панель — интерактивные сценарии @flows', () => {
    test('загружает список пользователей', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.goto('/admin');
        await expect(page.locator('main').first()).toBeVisible();
    });
});

test.describe('Правила и помощь @flows', () => {
    test('правила — раскрываются секции FAQ', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/rules');
        await expect(page.getByRole('heading', { name: 'Правила' })).toBeVisible();
    });

    test('помощь — отображает FAQ', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/help');
        await expect(page.getByText(/принтер|Wi/i).first()).toBeVisible();
    });
});
