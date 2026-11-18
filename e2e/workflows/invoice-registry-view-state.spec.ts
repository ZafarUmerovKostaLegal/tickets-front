import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const row = (i: number) => ({
    id: `sys-inv-${i}`, invoiceId: `inv-${i}`, seqNo: String(i), billedTo: `Клиент ${i}`,
    currency: i % 2 ? 'USD' : 'UZS', amount: '1,000.00', partner: i % 3 ? 'VBG' : 'NFH', partnerNote: '', details: '',
    issueDate: '2026-10-02', dueOrPayment: '2026-11-01', clientNumber: `INV-2026-${String(i).padStart(5, '0')}`,
    statusNote: 'Выставлен', advanceFee: '', balance: '1,000.00', pdfFileName: '', pdfUploadedAt: '',
});

async function mockRegistry(page: Page) {
    const json = (route: Route, body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/api/v1/time-tracking/invoice-registry/years', (route) => json(route, {
        years: [{ id: '2026-system', sheetName: '2026 (система)', mode: 'system', rowCount: 80 }],
        seedRevision2026: null,
    }));
    await page.route('**/api/v1/time-tracking/invoice-registry/2026-system**', (route) => json(route, {
        year: '2026-system', sheetName: '2026 (система)', mode: 'system', columns: [],
        rows: Array.from({ length: 80 }, (_, i) => row(i + 1)),
        statuses: ['Выставлен', 'Оплачен'],
    }));
}

async function openSheet(page: Page) {
    await page.goto('/time-tracking?tab=invoices&invTab=registry');
    await page.getByText('2026 (система)', { exact: true }).first().click();
    await expect(page.locator('.tt-inv-reg__table-wrap')).toBeVisible({ timeout: 20_000 });
}

test.describe('@e2e Реестр инвойсов: фильтры и прокрутка', () => {
    test('фильтр и позиция прокрутки сохраняются после обновления страницы', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await loginAs('admin');
        await mockRegistry(page);
        await openSheet(page);

        const number = page.getByRole('searchbox', { name: 'Номер' });
        await number.fill('INV-2026-0000');
        const rows = page.locator('tbody .tt-inv-reg__tr');
        await expect(rows).toHaveCount(9);
        await number.fill('INV-2026-0');
        await expect(rows).toHaveCount(80);

        const wrap = page.locator('.tt-inv-reg__table-wrap');
        await wrap.evaluate((el) => { el.scrollTop = 900; });
        await page.waitForTimeout(200);
        const before = await wrap.evaluate((el) => el.scrollTop);
        expect(before).toBeGreaterThan(500);

        await page.reload();
        await expect(page.locator('.tt-inv-reg__table-wrap')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('searchbox', { name: 'Номер' })).toHaveValue('INV-2026-0');
        await expect.poll(() => page.locator('.tt-inv-reg__table-wrap').evaluate((el) => el.scrollTop)).toBe(before);

        await page.getByRole('searchbox', { name: 'Номер' }).fill('INV-2026-0000');
        await page.reload();
        await expect(page.locator('tbody .tt-inv-reg__tr')).toHaveCount(9, { timeout: 20_000 });
    });
});
