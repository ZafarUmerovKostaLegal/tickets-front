import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';

async function mockRules(page: Page) {
    const posts: unknown[] = [];
    const base = { matterId: 'm1', matterName: 'Проверка создания Matter', matterCode: 'KL-PRSZ-12/03', clientId: 'c1', clientName: 'Kosta Legal', enabled: true, ownerName: 'Zafar Umerov', mine: true, canEdit: true, createdAt: null, scope: 'personal' };
    const rules = [
        { ...base, id: 'r1', match: 'info@kostalegal.com', subject: '', folderId: null, folderPath: '', hits: 1, lastHitAt: '2026-11-25T09:11:00Z' },
        { ...base, id: 'r2', match: 'client.com', subject: 'invoice, счёт', folderId: 'f-bill', folderPath: 'Billing', hits: 4, lastHitAt: '2026-11-25T10:12:00Z' },
        { ...base, id: 'r3', match: '', subject: 'court hearing', folderId: 'f-court', folderPath: 'Court Documents', hits: 0, lastHitAt: null },
    ];
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: {
        viewer: { userId: 1, name: 'Zafar Umerov', canManage: true },
        clients: [{ id: 'c1', name: 'Kosta Legal', matters: [{ id: 'm1', name: 'Проверка создания Matter', code: 'KL-PRSZ-12/03', closed: false, level: 'manage', favorite: false, mine: true }] }],
        requestable: [],
    } }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
    await page.route('**/api/v1/files/matters/m1/browse**', (route) => route.fulfill({ json: {
        matter: { id: 'm1', name: 'Проверка создания Matter', code: 'KL-PRSZ-12/03', closed: false, level: 'manage', favorite: false },
        client: { id: 'c1', name: 'Kosta Legal' }, folderId: null, path: [], documents: [],
        folders: [
            { id: 'f-bill', parentId: null, name: 'Billing', documents: 0, createdAt: null, favorite: false },
            { id: 'f-corr', parentId: null, name: 'Correspondence', documents: 0, createdAt: null, favorite: false },
            { id: 'f-mail', parentId: 'f-corr', name: 'Emails', documents: 0, createdAt: null, favorite: false },
            { id: 'f-court', parentId: null, name: 'Court Documents', documents: 0, createdAt: null, favorite: false },
        ],
    } }));
    await page.route('**/api/v1/files/mail/rules**', async (route) => {
        if (route.request().method() === 'POST') {
            posts.push(route.request().postDataJSON());
            return route.fulfill({ status: 201, json: { rule: rules[0] } });
        }
        return route.fulfill({ json: {
            rules,
            mailbox: { email: 'zumerov@kostalegal.com', enabled: true, since: null, filedTotal: 18, lastRunAt: '2026-11-25T10:37:00Z', lastFiledAt: null, lastError: null },
            canShare: true, serverReady: true,
        } });
    });
    return posts;
}

test.describe('@e2e Файловый менеджер: правила почты', () => {
    test('тема, папка и несколько правил', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await loginAs('admin');
        const posts = await mockRules(page);
        await page.goto('/files?view=mailRules');
        await expect(page.locator('.fm-mr-rule')).toHaveCount(3, { timeout: 30_000 });
        await expect(page.locator('.fm-mr-rule').nth(2)).toContainText('Любой отправитель');
        await expect(page.locator('.fm-mr-rule').nth(1)).toContainText('Все из @client.com');

        await page.getByPlaceholder(/ivan@client.com/).fill('anna@client.com');
        await page.getByRole('button', { name: /всех сотрудников @client.com/ }).click();
        await expect(page.getByPlaceholder(/ivan@client.com/)).toHaveValue('@client.com');
        await expect(page.locator('.fm-mr-domain-note')).toContainText('client.com');
        await page.getByPlaceholder(/invoice, счёт/).fill('NDA, договор');
        await page.locator('.fm-mr-form__grid label').nth(2).locator('button').first().click();
        await page.getByRole('option', { name: /Проверка создания Matter/ }).click();
        await page.locator('.fm-mr-form__grid label').nth(3).locator('button').first().click();
        await page.getByRole('option', { name: 'Correspondence / Emails', exact: true }).click();
        await expect(page.locator('.fm-mr-form__summary')).toContainText('«NDA» или «договор»');
        await expect(page.locator('.fm-mr-form__summary')).toContainText('Correspondence / Emails');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/rules-1440.png`, fullPage: true });
        await page.locator('.fm-mr-form button[type=submit]').click();
        await expect.poll(() => posts.length).toBe(1);
        expect(posts[0]).toMatchObject({ match: '@client.com', subject: 'NDA, договор', matterId: 'm1', folderId: 'f-mail' });

        await page.locator('.fm-mr-rule').nth(1).getByRole('button', { name: 'Изменить правило' }).click();
        await expect(page.locator('.fm-mr-form h3')).toHaveText('Изменение правила');
        await expect(page.getByPlaceholder(/invoice, счёт/)).toHaveValue('invoice, счёт');
    });

    test('390', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 390, height: 860 });
        await loginAs('admin');
        await mockRules(page);
        await page.goto('/files?view=mailRules');
        await expect(page.locator('.fm-mr-rule').first()).toBeVisible({ timeout: 30_000 });
        if (SHOTS)
            await page.locator('.fm-mr-list').first().screenshot({ path: `${SHOTS}/rules-390.png` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
});
