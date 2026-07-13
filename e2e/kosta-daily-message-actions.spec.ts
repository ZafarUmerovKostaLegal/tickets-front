import { test, expect } from './fixtures/test';

test.describe('@smoke Kosta Daily message actions', () => {
    test('кнопки ответа и реакции видны при hover', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/kosta-daily');
        await expect(page.locator('.kd-tg')).toBeVisible({ timeout: 30_000 });

        const firstChat = page.locator('.kd-tg__chat-item').first();
        if (await firstChat.isVisible()) {
            await firstChat.click();
        }

        const incomingRow = page.locator('.kd-tg__row--in').first();
        await expect(incomingRow).toBeVisible({ timeout: 20_000 });
        await incomingRow.hover();

        const actions = incomingRow.locator('.kd-tg__row-actions');
        await expect(actions).toBeVisible();
        await expect(actions.getByRole('button', { name: 'Ответить' })).toBeVisible();
        await expect(actions.getByRole('button', { name: 'Добавить реакцию' })).toBeVisible();
    });
});
