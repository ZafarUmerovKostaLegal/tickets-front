import { test, expect, type Page } from '../fixtures/test';

type Rule = Record<string, unknown>;

async function openRules(page: Page, width: number) {
    await page.setViewportSize({ width, height: 900 });
    const state = {
        rules: [
            { id: 'r1', scope: 'personal', match: 'ivan@acme.com', matterId: 'm1', matterName: 'Project Falcon', matterCode: 'KL-104', clientId: 'c1', clientName: 'Acme', folderId: null, folderPath: '', enabled: true, hits: 12, lastHitAt: '2026-11-20T09:00:00Z', ownerName: 'Admin', mine: true, canEdit: true, createdAt: null },
            { id: 'r2', scope: 'shared', match: 'beta.com', matterId: 'm2', matterName: 'Beta Arbitration', matterCode: 'KL-221', clientId: 'c2', clientName: 'Beta LLC', folderId: 'f1', folderPath: 'Correspondence / Court', enabled: false, hits: 0, lastHitAt: null, ownerName: 'Partner P', mine: false, canEdit: true, createdAt: null },
        ] as Rule[],
        mailbox: null as Record<string, unknown> | null,
        created: [] as Rule[],
    };
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: {
        viewer: { userId: 1, name: 'Admin', canManage: true },
        clients: [
            { id: 'c1', name: 'Acme', archived: false, favorite: false, matters: [{ id: 'm1', clientId: 'c1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'edit', mine: true, provisioned: true, documents: 4, favorite: false }] },
            { id: 'c2', name: 'Beta LLC', archived: false, favorite: false, matters: [{ id: 'm2', clientId: 'c2', name: 'Beta Arbitration', code: 'KL-221', closed: false, level: 'manage', mine: false, provisioned: true, documents: 1, favorite: false }] },
        ],
        requestable: [],
    } }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
    await page.route('**/api/v1/files/mail/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith('/mail/autofile')) {
            const enabled = (request.postDataJSON() as { enabled: boolean }).enabled;
            state.mailbox = { email: 'admin@kostalegal.com', enabled, since: '2026-11-21T08:00:00Z', filedTotal: 0, lastRunAt: null, lastFiledAt: null, lastError: null };
            return route.fulfill({ json: { mailbox: state.mailbox } });
        }
        if (request.method() === 'POST' && url.pathname.endsWith('/mail/rules')) {
            const body = request.postDataJSON() as Rule;
            state.created.push(body);
            state.rules.unshift({ id: 'r3', scope: body.scope, match: String(body.match).replace(/^@/, ''), matterId: body.matterId, matterName: 'Project Falcon', matterCode: 'KL-104', clientId: 'c1', clientName: 'Acme', folderId: null, folderPath: '', enabled: true, hits: 0, lastHitAt: null, ownerName: 'Admin', mine: true, canEdit: true, createdAt: null });
            return route.fulfill({ status: 201, json: { rule: state.rules[0] } });
        }
        return route.fulfill({ json: { rules: state.rules, mailbox: state.mailbox, canShare: true, serverReady: true } });
    });
    await page.goto('/files?view=mailRules');
    await expect(page.getByText('Автосохранение моей почты')).toBeVisible({ timeout: 20_000 });
    return state;
}

test.describe('@e2e Файловый менеджер: правила почты', () => {
    for (const width of [1440, 390]) {
        test(`автосохранение включается, правило добавляется (${width})`, async ({ page, loginAs }) => {
            await loginAs('admin');
            const state = await openRules(page, width);
            await expect(page.getByText('@beta.com')).toBeVisible();
            await expect(page.getByText('Correspondence / Court')).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

            await page.getByRole('button', { name: 'Включить' }).click();
            await expect(page.getByText(/Включено для admin@kostalegal\.com/)).toBeVisible();

            await page.getByPlaceholder(/ivan@client\.com/).fill('@acme.com');
            await page.locator('.fm-mailrules__matter button').first().click();
            await page.getByRole('option', { name: /Project Falcon/ }).click();
            await page.getByRole('button', { name: 'Добавить правило' }).click();
            await expect.poll(() => state.created.length).toBe(1);
            expect(state.created[0]).toMatchObject({ match: '@acme.com', matterId: 'm1', scope: 'personal' });
            await expect(page.getByText('@acme.com', { exact: true })).toBeVisible();
            await page.screenshot({ path: test.info().outputPath(`mail-rules-${width}.png`), fullPage: true });
        });
    }
});
