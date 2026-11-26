import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const NOW = '2026-11-18T09:00:00Z';

type Doc = { id: string; name: string; description: string; folderId: string; createdAt: string };

function makeMatter() {
    const folders = [
        { id: 'corr', parentId: null as string | null, name: 'Correspondence', documents: 0, createdAt: NOW, favorite: false },
        { id: 'emails', parentId: 'corr', name: 'Emails', documents: 4, createdAt: NOW, favorite: false },
        { id: 'agr', parentId: null, name: 'Agreements', documents: 0, createdAt: NOW, favorite: false },
    ];
    const docs: Doc[] = [
        { id: 'd1', name: '2026-11-03_01_klenneshaw.eml', description: '', folderId: 'emails', createdAt: NOW },
        { id: 'd2', name: '2026-11-09 Ivan Petrov - SPA final [ab12cd].eml', description: 'SPA final comments', folderId: 'emails', createdAt: NOW },
        { id: 'd3', name: '2026-11-17 Anna - Hello [cd34ef].eml', description: 'Re: Hello from the buyer', folderId: 'emails', createdAt: NOW },
        { id: 'd4', name: 'notes.docx', description: '', folderId: 'emails', createdAt: '2026-10-01T09:00:00Z' },
    ];
    const organizeCalls: unknown[] = [];
    const removed: string[] = [];
    docs.push({ id: 'd5', name: '2026-11-09_02_ivan.eml', description: 'SPA final comments', folderId: 'agr', createdAt: '2026-11-10T09:00:00Z' });

    const docOut = (doc: Doc) => ({
        id: doc.id, docNumber: `KL-00000${doc.id.slice(1)}`, name: doc.name, kind: doc.name.endsWith('.eml') ? 'email' : 'word',
        docType: '', description: doc.description, version: 1, sizeBytes: 40_000, contentType: 'application/octet-stream',
        folderId: doc.folderId, matterId: 'm1', matterName: 'Project Falcon', matterCode: 'KL-104', clientId: 'c1', clientName: 'Acme',
        createdAt: doc.createdAt, createdBy: 'Zafar', updatedAt: doc.createdAt, updatedBy: 'Zafar',
        checkedOutById: null, checkedOutBy: null, checkedOutAt: null, favorite: false,
    });

    const handle = async (route: Route) => {
        const url = new URL(route.request().url());
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname.endsWith('/mail/organize')) {
            organizeCalls.push(route.request().postDataJSON());
            folders.push({ id: 'person', parentId: 'emails', name: 'Zafar Umerov', documents: 3, createdAt: NOW, favorite: false });
            docs.forEach((doc) => {
                if (doc.name.endsWith('.eml'))
                    doc.folderId = 'person';
            });
            return json({ moved: 3, folders: ['Zafar Umerov'], subjects: 1 });
        }
        if (url.pathname.endsWith('/duplicates')) {
            const live = docs.filter((doc) => !removed.includes(doc.id));
            const pair = live.filter((doc) => doc.id === 'd2' || doc.id === 'd5');
            return json({
                groups: pair.length > 1 ? [{
                    reason: 'message',
                    key: 'spa@x',
                    documents: pair.map((doc) => ({ ...docOut(doc), folderPath: [{ id: 'corr', name: 'Correspondence' }, { id: 'emails', name: 'Emails' }] })),
                }] : [],
                total: pair.length > 1 ? 1 : 0,
            });
        }
        if (url.pathname.endsWith('/browse')) {
            const folderId = url.searchParams.get('folderId');
            return json({
                matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'edit', favorite: false },
                client: { id: 'c1', name: 'Acme' },
                folderId,
                path: [],
                folders,
                documents: docs.filter((doc) => doc.folderId === folderId).map(docOut),
            });
        }
        return json({});
    };
    const handleDocument = async (route: Route) => {
        const id = new URL(route.request().url()).pathname.split('/').pop() ?? '';
        if (route.request().method() === 'DELETE')
            removed.push(id);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    };
    return { handle, handleDocument, organizeCalls, removed };
}

async function openEmails(page: Page) {
    const matter = makeMatter();
    await page.route('**/api/v1/files/matters/**', matter.handle);
    await page.route('**/api/v1/files/documents/*', matter.handleDocument);
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            viewer: { userId: 1, name: 'Admin', canManage: true },
            clients: [{ id: 'c1', name: 'Acme', archived: false, favorite: false, matters: [
                { id: 'm1', clientId: 'c1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'edit', mine: true, provisioned: true, documents: 4, favorite: false },
            ] }],
            requestable: [],
        }),
    }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ requests: [] }),
    }));
    await page.goto('/files?view=matter&matter=m1&folder=emails');
    await expect(page.locator('.fm-ex__tile', { hasText: 'notes.docx' })).toBeVisible({ timeout: 30_000 });
    return matter;
}

test.describe('@e2e Файловый менеджер: письма в matter', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.clock.setFixedTime(new Date('2026-11-18T12:00:00'));
        await page.addInitScript(() => {
            try {
                localStorage.removeItem('fm.matter.dateFilter');
            }
            catch {
            }
        });
    });

    test('тема письма на плитке и фильтр по дате письма', async ({ page, loginAs }) => {
        await loginAs('admin');
        await openEmails(page);
        const tiles = page.locator('.fm-ex__tiles .fm-ex__tile:not(.fm-ex__tile--up)');
        await expect(page.locator('.fm-ex__tile', { hasText: 'SPA final [ab12cd]' }).locator('.fm-ex__tile-subject')).toHaveText('SPA final comments');

        await page.getByRole('button', { name: '7 дней' }).click();
        await expect(tiles).toHaveCount(1);
        await expect(page.locator('.fm-datebar__count')).toHaveText('Показано 1 из 4');

        await page.getByRole('button', { name: '30 дней' }).click();
        await expect(tiles).toHaveCount(3);

        await page.getByRole('button', { name: 'Период' }).click();
        await page.getByLabel('С', { exact: true }).fill('2026-11-01');
        await page.getByLabel('По', { exact: true }).fill('2026-11-05');
        await expect(tiles).toHaveCount(1);
        await expect(tiles.first()).toContainText('klenneshaw');

        await page.getByLabel('С', { exact: true }).fill('2025-01-01');
        await page.getByLabel('По', { exact: true }).fill('2025-01-02');
        await expect(page.getByText('За выбранный период документов нет')).toBeVisible();
        await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
        await expect(tiles).toHaveCount(4);
    });

    test('письма раскладываются по сотрудникам', async ({ page, loginAs }) => {
        await loginAs('admin');
        const matter = await openEmails(page);
        await page.getByRole('button', { name: 'Разложить по сотрудникам' }).click();
        await expect(page.locator('.fm-ex__tile', { hasText: 'Zafar Umerov' })).toBeVisible();
        await expect(page.locator('.fm-ex__tile', { hasText: '.eml' })).toHaveCount(0);
        expect(matter.organizeCalls).toEqual([{ folderId: 'emails' }]);
        await expect(page.getByRole('button', { name: 'Разложить по сотрудникам' })).toHaveCount(0);
    });

    test('дубликаты: оригинал остаётся, копия уходит в корзину', async ({ page, loginAs }) => {
        await loginAs('admin');
        const matter = await openEmails(page);
        await page.getByRole('button', { name: 'Дубликаты', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Дубликаты в matter' });
        await expect(dialog.getByText('Одно и то же письмо', { exact: true })).toBeVisible();
        await expect(dialog.locator('.fm-dups__doc.is-original')).toContainText('SPA final [ab12cd]');
        await dialog.getByRole('button', { name: 'Оставить только оригинал' }).click();
        await expect(dialog.getByText('Дубликатов нет')).toBeVisible();
        expect(matter.removed).toEqual(['d5']);
    });
});
