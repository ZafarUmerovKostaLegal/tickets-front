import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const NOW = '2026-11-18T09:00:00Z';
const SHOTS = process.env.FM_SHOTS_DIR ?? '';

type Entry = { level: string; effective: string | null; note: string; until: string | null; suspendedUntil: string | null; grantedBy: string; grantedAt: string };

function makeMatter() {
    const folders = [
        { id: 'corr', parentId: null as string | null, name: 'Correspondence', documents: 2, createdAt: NOW, favorite: false, access: { level: null, entries: 1, inherit: true } },
        { id: 'emails', parentId: 'corr', name: 'Emails', documents: 4, createdAt: NOW, favorite: false, access: { level: null, entries: 0, inherit: true } },
        { id: 'agr', parentId: null, name: 'Agreements', documents: 3, createdAt: NOW, favorite: false, access: { level: null, entries: 0, inherit: true } },
        { id: 'drafts', parentId: null, name: 'Drafts', documents: 0, createdAt: NOW, favorite: false, access: { level: null, entries: 0, inherit: true } },
    ];
    const docs = [
        { id: 'd1', name: 'SPA v3.docx', kind: 'doc', folderId: null as string | null },
        { id: 'd2', name: 'Board minutes.pdf', kind: 'pdf', folderId: null },
    ];
    const entries: Record<number, Entry | null> = {
        2: { level: 'read', effective: 'read', note: '', until: '2026-12-01T18:59:59Z', suspendedUntil: null, grantedBy: 'Partner', grantedAt: NOW },
        3: null,
        4: { level: 'edit', effective: 'deny', note: '', until: null, suspendedUntil: '2026-11-25T18:59:59Z', grantedBy: 'Partner', grantedAt: NOW },
    };
    const puts: unknown[] = [];
    const folderFiles = [
        { id: 'f1', name: 'Letter to Acme.pdf', kind: 'pdf', createdById: 2, createdBy: 'Iroda T', restricted: false },
        { id: 'f2', name: 'Court filing.docx', kind: 'doc', createdById: 1, createdBy: 'Partner P', restricted: false },
        { id: 'f3', name: 'Settlement terms.docx', kind: 'doc', createdById: 1, createdBy: 'Partner P', restricted: true },
    ];

    const docOut = (doc: typeof docs[number]) => ({
        id: doc.id, docNumber: `KL-00000${doc.id.slice(1)}`, name: doc.name, kind: doc.kind, docType: '', description: '',
        version: 2, sizeBytes: 182_000, contentType: 'application/octet-stream', folderId: doc.folderId, matterId: 'm1',
        matterName: 'Project Falcon', matterCode: 'KL-104', clientId: 'c1', clientName: 'Acme', createdAt: NOW,
        createdBy: 'Iroda T', updatedAt: NOW, updatedBy: 'Iroda T', checkedOutById: null, checkedOutBy: null,
        checkedOutAt: null, favorite: false,
        access: { restricted: doc.id === 'd2', entries: doc.id === 'd1' ? 2 : 0, mine: false, level: 'edit' },
    });

    const members = () => [
        { userId: 1, name: 'Partner P', position: 'Partner', partner: true, matterLevel: 'manage', source: 'timeTracking' },
        { userId: 2, name: 'Iroda T', position: 'Associate', partner: false, matterLevel: 'edit', source: 'timeTracking' },
        { userId: 3, name: 'Lawyer L', position: 'Junior associate', partner: false, matterLevel: 'edit', source: 'timeTracking' },
        { userId: 4, name: 'Bekzod K', position: 'Paralegal', partner: false, matterLevel: 'edit', source: 'both' },
    ].map((member) => {
        const entry = entries[member.userId] ?? null;
        const effective = member.partner ? null : entry?.effective ?? null;
        const files: Record<string, string> = {};
        for (const file of folderFiles) {
            const level = member.partner ? 'edit' : file.createdById === member.userId ? 'edit'
                : effective === 'read' || effective === 'edit' ? (file.restricted ? null : effective) : null;
            if (level)
                files[file.id] = level;
        }
        return { ...member, entry, inherited: null, effective, files };
    });

    const handleMatter = async (route: Route) => {
        const url = new URL(route.request().url());
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname.endsWith('/browse')) {
            const folderId = url.searchParams.get('folderId');
            return json({
                matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'manage', favorite: false },
                client: { id: 'c1', name: 'Acme' },
                folderId,
                path: [],
                folders,
                documents: docs.filter((doc) => doc.folderId === folderId).map(docOut),
            });
        }
        return json({});
    };

    const handleFolder = async (route: Route) => {
        const request = route.request();
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (request.method() === 'PUT') {
            const body = request.postDataJSON() as { userId: number; level: string };
            puts.push(body);
            entries[body.userId] = { level: body.level, effective: body.level, note: '', until: null, suspendedUntil: null, grantedBy: 'Partner', grantedAt: NOW };
            return json({ entry: entries[body.userId] });
        }
        return json({
            folder: { id: 'corr', name: 'Correspondence', parentId: null, inherit: true, path: [] },
            matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104' },
            members: members(),
            documents: folderFiles,
        });
    };

    const docPuts: unknown[] = [];
    let restricted = false;
    const handleDocument = async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname.endsWith('/restricted')) {
            restricted = (request.postDataJSON() as { restricted: boolean }).restricted;
            docPuts.push({ restricted });
            return json({ restricted });
        }
        if (request.method() === 'PUT') {
            docPuts.push(request.postDataJSON());
            return json({ entry: null });
        }
        return json({
            document: { id: 'd1', name: 'SPA v3.docx', folderId: null, folderName: '', createdBy: 'Iroda T', createdById: 2, restricted },
            matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104' },
            members: [
                { userId: 2, name: 'Iroda T', position: 'Associate', partner: false, owner: true, matterLevel: 'edit', entry: null, viaFolder: null, effective: 'owner' },
                { userId: 3, name: 'Lawyer L', position: 'Junior associate', partner: false, owner: false, matterLevel: 'edit', entry: null, viaFolder: 'read', effective: restricted ? 'own' : 'read' },
                { userId: 4, name: 'Bekzod K', position: 'Paralegal', partner: false, owner: false, matterLevel: 'edit',
                    entry: { level: 'edit', effective: 'edit', note: '', until: '2026-12-01T18:59:59Z', suspendedUntil: null, grantedBy: 'Partner', grantedAt: NOW },
                    viaFolder: null, effective: 'edit' },
            ],
        });
    };

    return { handleMatter, handleFolder, handleDocument, puts, docPuts };
}

async function openMatter(page: Page) {
    const matter = makeMatter();
    await page.route('**/api/v1/files/matters/**', matter.handleMatter);
    await page.route('**/api/v1/files/folders/*/access**', matter.handleFolder);
    await page.route('**/api/v1/files/documents/*/access**', matter.handleDocument);
    await page.route('**/api/v1/files/documents/*/restricted', matter.handleDocument);
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            viewer: { userId: 1, name: 'Partner P', canManage: true },
            clients: [{ id: 'c1', name: 'Acme', archived: false, favorite: false, matters: [
                { id: 'm1', clientId: 'c1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'manage', mine: true, provisioned: true, documents: 9, favorite: false },
            ] }],
            requestable: [],
        }),
    }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ requests: [] }),
    }));
    await page.goto('/files?view=matter&matter=m1');
    await expect(page.locator('.fm-ex__tile', { hasText: 'Correspondence' })).toBeVisible({ timeout: 30_000 });
    return matter;
}

test.describe('@e2e Файловый менеджер: доступ к папкам matter', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-11-18T12:00:00'));
        await page.addInitScript(() => {
            try {
                localStorage.removeItem('fm.matter.layout');
                localStorage.removeItem('fm.matter.dateFilter');
            }
            catch {
            }
        });
    });

    test('список и drawer доступа с галочками', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const matter = await openMatter(page);

        await expect(page.locator('.fm-ex__tile', { hasText: 'Correspondence' }).locator('.fm-ex__access')).toHaveText('Особый доступ');
        await page.getByRole('button', { name: 'Список' }).click();
        const row = page.locator('.fm-ex__list tr', { hasText: 'Correspondence' });
        await expect(row).toBeVisible();
        await expect(page.locator('.fm-ex__list tr', { hasText: 'SPA v3.docx' })).toContainText('Iroda T');

        await row.click();
        const drawer = page.getByRole('complementary', { name: 'Доступ к папке' });
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Partner P' })).toContainText('Партнёр · видит всё');
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Iroda T' })).toContainText('Доступ по');
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Bekzod K' })).toContainText('Временно отключён');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/fa-1440-light.png` });

        const lawyer = drawer.locator('.fm-faccess__row', { hasText: 'Lawyer L' });
        await expect(lawyer.getByRole('radio', { name: 'Свои файлы' })).toHaveAttribute('aria-checked', 'true');
        await expect(lawyer).toContainText('Доступно файлов: 0 из 3');
        await lawyer.getByRole('radio', { name: 'Редактирование' }).click();
        await expect.poll(() => matter.puts.length).toBe(1);
        expect(matter.puts[0]).toMatchObject({ userId: 3, level: 'edit' });
        await expect(lawyer.getByRole('radio', { name: 'Редактирование' })).toHaveAttribute('aria-checked', 'true');
        await expect(lawyer).toContainText('Доступно файлов: 2 из 3');
        const iroda = drawer.locator('.fm-faccess__row', { hasText: 'Iroda T' });
        await expect(iroda.getByRole('radio', { name: 'Чтение' })).toHaveAttribute('aria-checked', 'true');
        await iroda.getByRole('button', { name: /Доступно файлов: 2 из 3/ }).click();
        const list = iroda.locator('.fm-faccess__file-list li');
        await expect(list).toHaveCount(3);
        await expect(list.filter({ hasText: 'Letter to Acme.pdf' })).toContainText('Редактирование');
        await expect(list.filter({ hasText: 'Letter to Acme.pdf' })).toContainText('автор');
        await expect(list.filter({ hasText: 'Court filing.docx' })).toContainText('Чтение');
        await expect(list.filter({ hasText: 'Settlement terms.docx' })).toContainText('Нет доступа');
        await expect(list.filter({ hasText: 'Letter to Acme.pdf' }).locator('select')).toHaveCount(0);
        const settlement = list.filter({ hasText: 'Settlement terms.docx' }).locator('select');
        await expect(settlement).toHaveValue('');
        await expect(settlement.locator('option').first()).toHaveText('По папке: Нет доступа');
        const before = matter.docPuts.length;
        await settlement.selectOption('read');
        await expect.poll(() => matter.docPuts.length).toBe(before + 1);
        expect(matter.docPuts[before]).toMatchObject({ userId: 2, level: 'read' });
        if (SHOTS)
            await drawer.screenshot({ path: `${SHOTS}/fa-files.png` });

        await drawer.locator('.fm-faccess__row', { hasText: 'Iroda T' }).getByRole('button', { name: 'Временный доступ и отключение' }).click();
        await expect(drawer.getByText('Временно отключить по')).toBeVisible();
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/fa-1440-panel.png` });

        await page.getByRole('button', { name: 'Плитка' }).click();
        await expect(page.locator('.fm-ex__tiles')).toBeVisible();
    });

    test('доступ к отдельному файлу', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const matter = await openMatter(page);

        await expect(page.locator('.fm-ex__tile', { hasText: 'SPA v3.docx' }).locator('.fm-ex__access')).toHaveText('Доступ: 2');
        await expect(page.locator('.fm-ex__tile', { hasText: 'Board minutes.pdf' }).locator('.fm-ex__access')).toHaveText('Конфиденциально');

        await page.locator('.fm-ex__tile', { hasText: 'SPA v3.docx' }).click({ button: 'right' });
        await page.getByRole('menuitem', { name: 'Доступ к файлу…' }).click();
        const drawer = page.getByRole('complementary', { name: 'Доступ к файлу' });
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Iroda T' })).toContainText('Автор файла');
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Lawyer L' })).toContainText('Доступ через папку');
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Bekzod K' })).toContainText('Доступ по');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/doc-access-1440.png` });

        await drawer.getByLabel('Конфиденциальный файл').click();
        await expect.poll(() => matter.docPuts.length).toBe(1);
        expect(matter.docPuts[0]).toEqual({ restricted: true });
        await expect(drawer.locator('.fm-faccess__row', { hasText: 'Lawyer L' })).toContainText('Не видит');

        await drawer.locator('.fm-faccess__row', { hasText: 'Lawyer L' }).getByRole('radio', { name: 'Чтение' }).click();
        await expect.poll(() => matter.docPuts.length).toBe(2);
        expect(matter.docPuts[1]).toMatchObject({ userId: 3, level: 'read' });
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/doc-access-restricted.png` });
    });

    for (const width of [390, 768]) {
        test(`drawer на ширине ${width}`, async ({ page, loginAs }) => {
            await page.setViewportSize({ width, height: 860 });
            await page.addInitScript(() => {
                try {
                    localStorage.setItem('appTheme', 'dark');
                }
                catch {
                }
            });
            await loginAs('admin');
            await openMatter(page);
            await page.getByRole('button', { name: 'Список' }).click();
            if (SHOTS)
                await page.screenshot({ path: `${SHOTS}/fa-${width}-list.png` });
            await page.locator('.fm-ex__list tr', { hasText: 'Correspondence' }).click();
            await expect(page.getByRole('complementary', { name: 'Доступ к папке' })).toBeVisible();
            if (SHOTS)
                await page.screenshot({ path: `${SHOTS}/fa-${width}-drawer.png` });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        });
    }

    test('фильтры и сортировка списка сохраняются после перезагрузки', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        await openMatter(page);
        await page.locator('.fm-datebar__layout button').nth(1).click();
        await page.getByPlaceholder('Найти в папке…').fill('SPA');
        await page.locator('.fm-ex__sort', { hasText: 'Размер' }).click();
        await expect(page.locator('.fm-ex__list tbody tr', { hasText: 'SPA v3.docx' })).toBeVisible();
        await page.reload();
        await expect(page.getByPlaceholder('Найти в папке…')).toHaveValue('SPA', { timeout: 30_000 });
        await page.locator('.fm-datebar__layout button').nth(1).click();
        await expect(page.locator('.fm-ex__sort.is-on')).toContainText('Размер');
        await expect(page.locator('.fm-ex__list tbody tr', { hasText: 'Board minutes.pdf' })).toHaveCount(0);
    });
});
