import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const NOTE = 'Счёт за сентябрь\nбез часов по спору';

async function mockRegistry(page: Page, state: { note: string; patches: unknown[]; fail?: boolean }) {
    const json = (route: Route, body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    await page.route('**/api/v1/time-tracking/invoice-registry/years', (route) => json(route, {
        years: [{ id: '2026-system', sheetName: '2026 (система)', mode: 'system', rowCount: 1 }],
        seedRevision2026: null,
    }));
    await page.route('**/api/v1/time-tracking/invoice-registry/2026-system**', (route) => json(route, {
        year: '2026-system',
        sheetName: '2026 (система)',
        mode: 'system',
        columns: [],
        rows: [{
            id: 'sys-inv-1', invoiceId: 'inv-1', seqNo: '1', billedTo: 'ООО Альфа', currency: 'USD', amount: '5,000.00',
            partner: 'AAA', partnerNote: '', details: state.note, issueDate: '2026-10-02', dueOrPayment: '2026-11-01',
            clientNumber: 'INV-2026-00173', statusNote: 'Оплачен', advanceFee: '', balance: '0.00', pdfFileName: '', pdfUploadedAt: '',
        }],
        statuses: ['Выставлен', 'Оплачен'],
    }));
    await page.route('**/api/v1/time-tracking/invoices/inv-1', async (route) => {
        if (route.request().method() !== 'PATCH')
            return route.fallback();
        const body = route.request().postDataJSON() as { internalNote?: string | null };
        state.patches.push(body);
        if (state.fail)
            return json(route, { detail: 'Сервер недоступен' }, 500);
        state.note = (body.internalNote ?? '').trim();
        return json(route, { id: 'inv-1', status: 'paid', internalNote: state.note || null, lines: [] });
    });
}

async function openNoteCell(page: Page) {
    await page.goto('/time-tracking?tab=invoices&invTab=registry');
    await page.getByText('2026 (система)', { exact: true }).first().click();
    const cell = page.locator('td[data-registry-edit]').first();
    await expect(cell).toBeVisible({ timeout: 20_000 });
    return cell;
}

test.describe('@e2e Реестр инвойсов: внутреннее примечание', () => {
    test('полный многострочный текст редактируется и сохраняется после перезагрузки', async ({ page, loginAs }) => {
        await loginAs('admin');
        const state = { note: NOTE, patches: [] as unknown[] };
        await mockRegistry(page, state);

        const cell = await openNoteCell(page);
        await expect(cell).toContainText('без часов по спору');
        await cell.click();

        const area = page.locator('textarea.tt-inv-reg__input--area');
        await expect(area).toHaveValue(NOTE);
        await area.press('End');
        await area.pressSequentially(', согласовано  ');
        await area.blur();

        await expect.poll(() => state.patches.length).toBe(1);
        expect(state.patches[0]).toEqual({ internalNote: `${NOTE}, согласовано  ` });
        await expect(page.locator('td[data-registry-edit]').first()).toContainText('согласовано');

        await page.reload();
        await page.getByText('2026 (система)', { exact: true }).first().click();
        await expect(page.locator('td[data-registry-edit]').first()).toContainText('без часов по спору, согласовано');
    });

    test('очистка отправляет null, ошибка сервера возвращает прежний текст', async ({ page, loginAs }) => {
        await loginAs('admin');
        const state = { note: NOTE, patches: [] as unknown[], fail: true };
        await mockRegistry(page, state);

        const cell = await openNoteCell(page);
        await cell.click();
        const area = page.locator('textarea.tt-inv-reg__input--area');
        await area.fill('');
        await area.blur();

        await expect.poll(() => state.patches.length).toBe(1);
        expect(state.patches[0]).toEqual({ internalNote: null });
        await expect(page.locator('td[data-registry-edit]').first()).toContainText('без часов по спору');
    });
});
