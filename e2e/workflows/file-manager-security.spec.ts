import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const NOW = '2026-11-18T09:00:00Z';
const SHOTS = process.env.FM_SHOTS_DIR ?? '';

const matter = (id: string, name: string, code: string, closed = false) => ({
    id, clientId: id.startsWith('m') ? 'c1' : 'c2', name, code, closed, level: 'manage', mine: true,
    provisioned: true, documents: 12, favorite: false,
});

async function mockSecurity(page: Page) {
    const puts: unknown[] = [];
    const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/api/v1/files/clients', (route) => json(route, {
        viewer: { userId: 1, name: 'Partner P', canManage: true },
        clients: [
            { id: 'c1', name: 'Acme LLC', archived: false, favorite: false, matters: [
                matter('m1', 'Project Falcon', 'KL-104'),
                matter('m2', 'Acme v. Beta', 'KL-105'),
                matter('m3', 'Old dispute', 'KL-090', true),
            ] },
            { id: 'c2', name: 'Orion Bank', archived: false, favorite: false, matters: [
                matter('o1', 'Bond issue 2026', 'KL-210'),
            ] },
        ],
        requestable: [],
    }));
    await page.route('**/api/v1/files/security/overview', (route) => json(route, {
        matters: {
            m1: { rules: 3, walls: 1, temporary: 1, suspended: 1, folderRules: 2, folders: 1, pending: 1 },
            o1: { rules: 1, walls: 0, temporary: 0, suspended: 0, folderRules: 0, folders: 0, pending: 0 },
        },
    }));
    await page.route('**/api/v1/files/matters/m1/security', (route) => {
        if (route.request().method() === 'PUT') {
            puts.push(route.request().postDataJSON());
            return json(route, { acl: {} });
        }
        return json(route, {
            matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104', clientName: 'Acme LLC', closed: false },
            inherited: [],
            acl: [
                { userId: 3, userName: 'Lawyer L', level: 'edit', note: 'Due diligence', grantedBy: 'Partner P', grantedAt: NOW, until: '2026-12-20T18:59:59Z', suspendedUntil: null },
                { userId: 4, userName: 'Bekzod K', level: 'edit', note: '', grantedBy: 'Partner P', grantedAt: NOW, until: null, suspendedUntil: '2026-11-25T18:59:59Z' },
                { userId: 5, userName: 'Conflict C', level: 'deny', note: 'Конфликт интересов', grantedBy: 'Partner P', grantedAt: NOW, until: null, suspendedUntil: null },
            ],
            effective: [
                { userId: 1, name: 'Partner P', position: 'Partner', source: 'timeTracking', level: 'edit', effective: 'edit', partner: true, until: null, suspendedUntil: null },
                { userId: 2, name: 'Iroda T', position: 'Associate', source: 'timeTracking', level: 'edit', effective: 'edit', partner: false, until: null, suspendedUntil: null },
                { userId: 3, name: 'Lawyer L', position: 'Junior associate', source: 'acl', level: 'edit', effective: 'edit', partner: false, until: '2026-12-20T18:59:59Z', suspendedUntil: null },
                { userId: 4, name: 'Bekzod K', position: 'Paralegal', source: 'both', level: 'edit', effective: 'deny', partner: false, until: null, suspendedUntil: '2026-11-25T18:59:59Z' },
                { userId: 5, name: 'Conflict C', position: 'Associate', source: 'acl', level: 'deny', effective: 'deny', partner: false, until: null, suspendedUntil: null },
            ],
            folders: [
                { id: 'corr', parentId: null, name: 'Correspondence', documents: 4, inherit: true, entries: 2, deny: 0, temporary: 1 },
                { id: 'emails', parentId: 'corr', name: 'Emails', documents: 31, inherit: false, entries: 0, deny: 0, temporary: 0 },
                { id: 'agr', parentId: null, name: 'Agreements', documents: 9, inherit: true, entries: 0, deny: 0, temporary: 0 },
                { id: 'drafts', parentId: null, name: 'Drafts', documents: 2, inherit: true, entries: 1, deny: 1, temporary: 0 },
            ],
            documents: [
                { id: 'd9', name: 'Settlement draft.docx', folderId: 'drafts', createdBy: 'Iroda T', restricted: true, entries: 1, deny: 0, temporary: 0 },
            ],
            pendingRequests: 1,
        });
    });
    await page.route('**/api/v1/files/folders/*/access**', (route) => json(route, {
        folder: { id: 'corr', name: 'Correspondence', parentId: null, inherit: true, path: [] },
        matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104' },
        members: [
            { userId: 2, name: 'Iroda T', position: 'Associate', partner: false, matterLevel: 'edit', source: 'timeTracking',
                entry: { level: 'read', effective: 'read', note: '', until: null, suspendedUntil: null, grantedBy: 'Partner P', grantedAt: NOW },
                inherited: null, effective: 'read' },
        ],
    }));
    await page.route('**/api/v1/files/audit**', (route) => json(route, {
        total: 3,
        items: [
            { id: 'a1', at: NOW, userId: 1, userName: 'Partner P', action: 'folder_acl_set', matterId: 'm1', matterName: 'Project Falcon', targetKind: 'folder', targetId: 'corr', targetName: 'Correspondence · Iroda T', detail: 'read' },
            { id: 'a2', at: NOW, userId: 1, userName: 'Partner P', action: 'acl_set', matterId: 'm1', matterName: 'Project Falcon', targetKind: 'user', targetId: '5', targetName: 'Conflict C', detail: 'deny' },
            { id: 'a3', at: NOW, userId: 4, userName: 'Bekzod K', action: 'denied', matterId: 'm1', matterName: 'Project Falcon', targetKind: 'matter', targetId: 'm1', targetName: 'Project Falcon', detail: 'need=read' },
        ],
    }));
    await page.route('**/api/v1/files/access-requests**', (route) => json(route, { requests: [] }));
    return { puts };
}

test.describe('@e2e Файловый менеджер: безопасность matters', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-11-18T12:00:00'));
    });

    test('список matters, люди, папки и журнал', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await loginAs('admin');
        const mocks = await mockSecurity(page);
        await page.goto('/files?view=security');

        await expect(page.locator('.fm-sx-welcome h2')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.fm-sx-rail .fm-sx-matter')).toHaveCount(4);
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/sx-1440-welcome.png` });

        await page.getByRole('radio', { name: /Стены/ }).click();
        await expect(page.locator('.fm-sx-rail .fm-sx-matter')).toHaveCount(1);
        await page.locator('.fm-sx-matter', { hasText: 'Project Falcon' }).click();

        await expect(page.locator('.fm-sx-head')).toContainText('Project Falcon');
        await expect(page.locator('.fm-sx-banner')).toContainText('1');
        await expect(page.locator('.fm-sx-person', { hasText: 'Bekzod K' })).toContainText('Отключён по');
        await expect(page.locator('.fm-sx-person', { hasText: 'Lawyer L' })).toContainText('по 20 дек.');
        if (SHOTS) {
            await page.waitForTimeout(600);
            await page.screenshot({ path: `${SHOTS}/sx-1440-people.png`, fullPage: true });
        }

        await page.locator('.fm-sx-person', { hasText: 'Iroda T' }).getByRole('radio', { name: 'Просмотр' }).click();
        await expect.poll(() => mocks.puts.length).toBe(1);
        expect(mocks.puts[0]).toMatchObject({ userId: 2, level: 'read' });

        await page.locator('.fm-sx-person', { hasText: 'Iroda T' }).getByRole('button', { name: 'Срок доступа и временное отключение' }).click();
        await expect(page.getByText('Временно отключить по')).toBeVisible();

        await page.getByRole('tab', { name: /Папки/ }).click();
        await expect(page.locator('.fm-sx-node', { hasText: 'Emails' })).toContainText('Без наследования');
        await expect(page.locator('.fm-sx-docs')).toContainText('Settlement draft.docx');
        await expect(page.locator('.fm-sx-docs')).toContainText('Конфиденциально');
        await page.locator('.fm-sx-node', { hasText: 'Correspondence' }).click();
        await expect(page.getByRole('complementary', { name: 'Доступ к папке' })).toBeVisible();
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/sx-1440-folders.png` });

        await page.getByRole('tab', { name: /Журнал/ }).click();
        await expect(page.locator('.fm-sx-journal li')).toHaveCount(3);
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/sx-1440-journal.png` });
    });

    for (const width of [390, 768]) {
        test(`адаптив ${width}`, async ({ page, loginAs }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.addInitScript(() => {
                try {
                    localStorage.setItem('appTheme', 'dark');
                }
                catch {
                }
            });
            await loginAs('admin');
            await mockSecurity(page);
            await page.goto('/files?view=security&matter=m1');
            await expect(page.locator('.fm-sx-person', { hasText: 'Iroda T' })).toBeVisible({ timeout: 30_000 });
            if (SHOTS)
                await page.screenshot({ path: `${SHOTS}/sx-${width}.png`, fullPage: true });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        });
    }
});
