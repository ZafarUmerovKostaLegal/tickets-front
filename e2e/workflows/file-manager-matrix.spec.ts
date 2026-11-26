import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';

async function mockMatrix(page: Page) {
    await page.addInitScript(() => localStorage.setItem('fm.matrix.mode', 'matters'));
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

    test('папки и файлы matter: уровни и правила', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        await page.addInitScript(() => localStorage.setItem('fm.matrix.mode', 'folders'));
        await page.route('**/api/v1/files/clients', (route) => json(route, {
            viewer: { userId: 1, name: 'Partner P', canManage: true },
            clients: [{ id: 'c1', name: 'MASDAR', archived: false, favorite: false, matters: [
                { id: 'm1', clientId: 'c1', name: 'ADB Sherabad', code: 'KL-MAS-01', closed: false, level: 'manage', mine: true, favorite: false },
            ] }],
            requestable: [],
        }));
        await page.route('**/api/v1/files/access-requests**', (route) => json(route, { requests: [] }));
        const folderPuts: unknown[] = [];
        const filePuts: unknown[] = [];
        await page.route('**/api/v1/files/folders/*/access', (route) => {
            folderPuts.push({ url: route.request().url(), ...route.request().postDataJSON() });
            return json(route, { entry: {} });
        });
        await page.route('**/api/v1/files/documents/*/access', (route) => {
            filePuts.push({ url: route.request().url(), ...route.request().postDataJSON() });
            return json(route, { entry: {} });
        });
        await page.route('**/api/v1/files/matters/m1/access-matrix', (route) => json(route, {
            matter: { id: 'm1', name: 'ADB Sherabad', code: 'KL-MAS-01', closed: false },
            folders: [
                { id: 'corr', parentId: null, name: 'Correspondence', inherit: true },
                { id: 'emails', parentId: 'corr', name: 'Emails', inherit: true },
                { id: 'agr', parentId: null, name: 'Agreements', inherit: false },
            ],
            documents: [
                { id: 'd1', folderId: 'corr', name: 'Letter.pdf', kind: 'pdf', createdById: 42, createdBy: 'Amal', restricted: false },
                { id: 'd2', folderId: 'corr', name: 'Board minutes.pdf', kind: 'pdf', createdById: 1, createdBy: 'Partner', restricted: true },
                { id: 'd3', folderId: 'agr', name: 'SPA v3.docx', kind: 'doc', createdById: 1, createdBy: 'Partner', restricted: false },
                { id: 'd4', folderId: null, name: 'Notes.txt', kind: 'text', createdById: 1, createdBy: 'Partner', restricted: false },
            ],
            truncated: false,
            people: [
                { userId: 1, name: 'Partner P', position: 'Partner', partner: true, matterLevel: 'manage', source: 'timeTracking' },
                { userId: 41, name: 'Aliye Ablyalimova', position: 'Senior Associate', partner: false, matterLevel: 'edit', source: 'timeTracking' },
                { userId: 42, name: 'Amal Yuldashev', position: 'Junior Associate', partner: false, matterLevel: 'edit', source: 'timeTracking' },
            ],
            folderRules: { '41:corr': { level: 'read', effective: 'read', until: null, suspendedUntil: null } },
            folderCells: { '41:corr': 'read', '41:emails': 'read' },
            fileRules: { '42:d3': { level: 'edit', effective: 'edit', until: null, suspendedUntil: null } },
        }));
        await page.goto('/files?view=matrix');
        const table = page.locator('.fm-mxf .fm-mx__table');
        await expect(table).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('tab', { name: 'Папки и файлы matter' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('.fm-mxf__person')).toHaveCount(3);
        await page.getByRole('button', { name: 'Раскрыть всё' }).click();
        await expect(page.getByRole('button', { name: 'Aliye Ablyalimova, Letter.pdf: Чтение' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Aliye Ablyalimova, Board minutes.pdf: Нет доступа' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Amal Yuldashev, SPA v3.docx: Редактирование' })).toHaveClass(/is-explicit/);
        await expect(page.getByRole('button', { name: 'Amal Yuldashev, Agreements: Свои файлы' })).toBeVisible();
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mxf-1440.png` });

        await page.getByRole('button', { name: 'Amal Yuldashev, Correspondence: Свои файлы' }).click();
        const pop = page.getByRole('dialog', { name: 'Amal Yuldashev' });
        await expect(pop).toContainText('по родительской папке');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mxf-pop.png` });
        await pop.getByRole('radio', { name: /Закрыто/ }).click();
        await expect.poll(() => folderPuts.length).toBe(1);
        expect(folderPuts[0]).toMatchObject({ userId: 42, level: 'deny' });
        expect(String((folderPuts[0] as { url: string }).url)).toContain('/folders/corr/access');

        await page.getByRole('button', { name: 'Aliye Ablyalimova, Board minutes.pdf: Нет доступа' }).click();
        await page.getByRole('dialog', { name: 'Aliye Ablyalimova' }).getByRole('radio', { name: /Чтение/ }).click();
        await expect.poll(() => filePuts.length).toBe(1);
        expect(filePuts[0]).toMatchObject({ userId: 41, level: 'read' });

        await page.getByPlaceholder('Найти папку или файл…').fill('SPA');
        await expect(page.locator('.fm-mxf__row.is-file')).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
});
