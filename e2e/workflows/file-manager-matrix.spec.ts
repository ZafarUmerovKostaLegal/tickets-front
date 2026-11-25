import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';

async function mockMatrix(page: Page) {
    const puts: unknown[] = [];
    const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/api/v1/files/clients', (route) => json(route, {
        viewer: { userId: 1, name: 'Partner P', canManage: true },
        clients: [{ id: 'c1', name: 'MASDAR', archived: false, favorite: false, matters: [] }],
        requestable: [],
    }));
    await page.route('**/api/v1/files/access-requests**', (route) => json(route, { requests: [] }));
    await page.route('**/api/v1/files/matrix**', (route) => json(route, {
        client: { id: 'c1', name: 'MASDAR' },
        matters: [
            { id: 'm1', name: 'ADB Sherabad', code: 'KL-MAS-01', closed: false },
            { id: 'm2', name: 'Energy Generation License', code: 'KL-MAS-02', closed: false },
            { id: 'm3', name: 'Guzar district ADB II', code: 'KL-MAS-03', closed: false },
            { id: 'm4', name: 'Old tender', code: 'KL-MAS-00', closed: true },
        ],
        users: [
            { userId: 40, name: 'auth-user-40@tt.local', position: '' },
            { userId: 41, name: 'Aliye Ablyalimova', position: 'Senior Associate' },
            { userId: 42, name: 'Amal Yuldashev', position: 'Junior Associate' },
        ],
        cells: { '40:m1': 'edit', '41:m1': 'edit', '41:m2': 'manage', '42:m3': 'deny', '41:m3': 'read' },
        explicit: ['41:m2', '42:m3'],
    }));
    await page.route('**/api/v1/time-tracking/users', (route) => json(route, [
        { id: 40, email: 'auth-user-40@tt.local', display_name: null },
        { id: 41, email: 'aliye@kostalegal.com', display_name: 'Aliye Ablyalimova', position: 'Senior Associate' },
        { id: 42, email: 'amal@kostalegal.com', display_name: 'Amal Yuldashev', position: 'Junior Associate' },
    ]));
    await page.route('**/api/v1/contacts/colleagues', (route) => json(route, [
        { id: 40, email: 'dilnoza@kostalegal.com', display_name: 'Dilnoza Davidbaeva', position: 'Associate' },
    ]));
    await page.route('**/api/v1/files/matters/*/security', (route) => {
        if (route.request().method() === 'PUT')
            puts.push(route.request().postDataJSON());
        return json(route, { acl: {} });
    });
    return { puts };
}

test.describe('@e2e Файловый менеджер: матрица доступа', () => {
    test('имена, меню клетки и выдача доступа', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const mocks = await mockMatrix(page);
        await page.goto('/files?view=matrix');

        const table = page.locator('.fm-mx__table');
        await expect(table).toBeVisible({ timeout: 30_000 });
        await expect(table).toContainText('Dilnoza Davidbaeva');
        await expect(table).not.toContainText('auth-user-40');
        await expect(page.locator('.fm-mx__col')).toHaveCount(3);
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mx-1440.png` });

        await page.getByRole('button', { name: /Amal Yuldashev, KL-MAS-01/ }).click();
        const pop = page.getByRole('dialog', { name: 'Amal Yuldashev' });
        await expect(pop).toContainText('Нет доступа');
        await pop.getByRole('button', { name: /Срок и комментарий/ }).click();
        await pop.getByPlaceholder('Зачем выдаёте доступ…').fill('Due diligence');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mx-pop.png` });
        await pop.getByRole('radio', { name: /Изменение/ }).click();
        await expect.poll(() => mocks.puts.length).toBe(1);
        expect(mocks.puts[0]).toMatchObject({ userId: 42, level: 'edit', note: 'Due diligence' });

        await page.getByRole('button', { name: /Aliye Ablyalimova, KL-MAS-02/ }).click();
        await expect(page.getByRole('dialog', { name: 'Aliye Ablyalimova' })).toContainText('Вернуть как в учёте времени');
        await page.keyboard.press('1');
        await expect.poll(() => mocks.puts.length).toBe(2);
        expect(mocks.puts[1]).toMatchObject({ userId: 41, level: 'read' });

        await page.getByRole('button', { name: 'Выдать доступ' }).click();
        await expect(page.getByRole('dialog', { name: 'Выдать доступ · MASDAR' })).toBeVisible();
    });

    test('адаптив 390', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 390, height: 860 });
        await loginAs('admin');
        await mockMatrix(page);
        await page.goto('/files?view=matrix');
        await expect(page.locator('.fm-mx__table')).toBeVisible({ timeout: 30_000 });
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mx-390.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
});
