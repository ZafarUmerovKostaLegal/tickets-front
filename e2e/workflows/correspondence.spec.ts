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

    test('compose letter opens template letter page', async ({ page }) => {
        await page.goto('/correspondence?tab=outgoing');
        await expect(page.locator('.corr-shell, main').first()).toBeVisible({ timeout: 15_000 });
        const btn = page.getByRole('button', { name: /написать письмо/i });
        await expect(btn).toBeVisible({ timeout: 15_000 });
        await btn.click();
        await expect(page).toHaveURL(/\/correspondence\/outgoing\/new/);
        await expect(page.getByText(/тема/i).first()).toBeVisible({ timeout: 15_000 });
    });

    test('letter editor: typing into the template keeps font and spacing', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/correspondence/outgoing/new');
        const paragraphs = page.locator('.corr-docx-editor .layout-paragraph');
        await expect(paragraphs.filter({ hasText: 'Уважаемый' }).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.corr-docx-editor .docx-menubar__trigger')).toHaveText(['Файл', 'Формат', 'Вставка']);
        const blank = paragraphs.nth(9);
        await expect(blank).toHaveText('');
        const box = await blank.boundingBox();
        await page.mouse.click(box!.x + 20, box!.y + box!.height / 2);
        await page.keyboard.type('Первая строка');
        await page.keyboard.press('Enter');
        await page.keyboard.type('Вторая строка');
        await expect(paragraphs.nth(9)).toHaveText('Первая строка');
        await expect(paragraphs.nth(10)).toHaveText('Вторая строка');
        await expect(page.locator('.corr-docx-editor .docx-toolbar__font-family-trigger')).toContainText('Calibri Light');
        await expect(page.locator('.corr-docx-editor .docx-toolbar__font-size input')).toHaveValue('11');
    });
});
