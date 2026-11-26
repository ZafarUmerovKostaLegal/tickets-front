import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';

function at(day: number, hour: number, minute: number): string {
    return new Date(2026, 10, day, hour, minute).toISOString();
}

async function mockAudit(page: Page) {
    const urls: string[] = [];
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: {
        viewer: { userId: 1, name: 'Partner P', canManage: true },
        clients: [{ id: 'c1', name: 'Kosta Legal', matters: [{ id: 'm1', name: 'Проверка создания Matter', code: 'KL-1', closed: false, level: 'manage', favorite: false }] }],
        requestable: [],
    } }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
    const items = [
        { id: 'a1', at: at(25, 13, 46), userId: 1, userName: 'Zafar Umerov', action: 'upload', matterId: 'm1', matterName: 'Проверка создания Matter', targetKind: 'document', targetId: 'd1', targetName: '2026-11-25 notifications@github.com — [tickets-front] Run failed .github workflows tests.yml - master (3e95462).eml', detail: '' },
        { id: 'a2', at: at(25, 13, 37), userId: 1, userName: 'Zafar Umerov', action: 'version', matterId: 'm1', matterName: 'Проверка создания Matter', targetKind: 'document', targetId: 'd2', targetName: 'Conversation_[INTERNAL INVESTIGATION] Kostal Legal x Masdar Legal laptops.eml', detail: 'v3' },
        { id: 'a3', at: at(25, 12, 58), userId: 2, userName: 'Iroda Tursunova', action: 'download', matterId: 'm1', matterName: 'Проверка создания Matter', targetKind: 'document', targetId: 'd3', targetName: 'Settlement draft.docx', detail: '' },
        { id: 'a4', at: at(24, 18, 5), userId: 1, userName: 'Zafar Umerov', action: 'folder_acl_set', matterId: 'm1', matterName: 'Проверка создания Matter', targetKind: 'folder', targetId: 'f1', targetName: 'Correspondence · Iroda Tursunova', detail: 'read' },
        { id: 'a5', at: at(24, 9, 12), userId: 4, userName: 'Bekzod Karimov', action: 'denied', matterId: 'm1', matterName: 'Проверка создания Matter', targetKind: 'matter', targetId: 'm1', targetName: 'Проверка создания Matter', detail: 'need=read' },
        { id: 'a6', at: at(20, 16, 40), userId: 2, userName: 'Iroda Tursunova', action: 'delete', matterId: 'm1', matterName: 'Проверка создания Matter', targetKind: 'document', targetId: 'd4', targetName: 'Old memo.pdf', detail: '' },
    ];
    await page.route('**/api/v1/files/audit**', (route) => {
        const url = new URL(route.request().url());
        urls.push(url.search);
        const actions = (url.searchParams.get('action') || '').split(',').filter(Boolean);
        const userId = url.searchParams.get('userId');
        const rows = items.filter((row) => (!actions.length || actions.includes(row.action)) && (!userId || String(row.userId) === userId));
        return route.fulfill({ json: { total: rows.length + (actions.length || userId ? 0 : 137), items: rows } });
    });
    return urls;
}

test.describe('@e2e Файловый менеджер: журнал аудита', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date(2026, 10, 25, 14, 0));
    });

    test('лента по дням, быстрые фильтры и сотрудник', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await loginAs('admin');
        const urls = await mockAudit(page);
        await page.goto('/files?view=audit');
        await expect(page.locator('.fm-au-ev')).toHaveCount(6, { timeout: 30_000 });
        await expect(page.locator('.fm-au-day__title').first()).toContainText('Сегодня');
        await expect(page.locator('.fm-au-day__title').nth(1)).toContainText('Вчера');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/audit-1440.png`, fullPage: true });

        await page.locator('.fm-au-day__title', { hasText: 'Вчера' }).click();
        await expect(page.locator('.fm-au-ev:visible')).toHaveCount(4);
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/audit-collapsed.png` });
        await page.locator('.fm-au-day__title', { hasText: 'Вчера' }).click();
        await expect(page.locator('.fm-au-ev:visible')).toHaveCount(6);
        await page.getByRole('button', { name: 'Свернуть все дни' }).click();
        await expect(page.locator('.fm-au-ev:visible')).toHaveCount(0);
        await page.getByRole('button', { name: 'Развернуть все дни' }).click();
        await expect(page.locator('.fm-au-ev:visible')).toHaveCount(6);
        await page.locator('.fm-au__chip', { hasText: 'Доступ' }).click();
        await expect(page.locator('.fm-au-ev')).toHaveCount(1);
        expect(urls.at(-1)).toContain('folder_acl_set');

        await page.locator('.fm-au__chip', { hasText: 'Все' }).click();
        await page.locator('.fm-au-ev__who', { hasText: 'Iroda Tursunova' }).first().click();
        await expect(page.locator('.fm-au-ev')).toHaveCount(2);
        await expect(page.locator('.fm-au__pill')).toContainText('Iroda Tursunova');
        await page.locator('.fm-au__reset:not(.fm-au__fold)').click();
        await expect(page.locator('.fm-au-ev')).toHaveCount(6);
    });

    test('390 и тёмная тема', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 390, height: 860 });
        await page.addInitScript(() => {
            try {
                localStorage.setItem('appTheme', 'dark');
            }
            catch {
                return;
            }
        });
        await loginAs('admin');
        await mockAudit(page);
        await page.goto('/files?view=audit');
        await expect(page.locator('.fm-au-ev').first()).toBeVisible({ timeout: 30_000 });
        if (SHOTS)
            await page.locator('.fm-au__feed').screenshot({ path: `${SHOTS}/audit-390.png` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
});
