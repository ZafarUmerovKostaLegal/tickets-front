import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const SHOTS = process.env.FM_SHOTS_DIR ?? '';
const NOW = '2026-11-25T08:10:00Z';

async function mockStats(page: Page, quiet = false) {
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: {
        viewer: { userId: 1, name: 'Partner P', canManage: true }, clients: [], requestable: [],
    } }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
    await page.route('**/api/v1/files/stats', (route) => route.fulfill({ json: {
        documents: 21,
        storedBytes: 5_350_000,
        versions: 31,
        checkedOut: 2,
        inTrash: 2,
        pendingRequests: quiet ? 0 : 1,
        uploadsWeek: 12,
        downloadsDay: 0,
        deniedDay: quiet ? 0 : 3,
        activeUsers: [
            { userId: 1, name: 'Zafar Umerov', events: 68 },
            { userId: 2, name: 'Azizbek Akhmadjonov', events: 1 },
        ],
        activeMatters: [
            { matterId: 'm1', name: 'Проверка создания Matter', events: 57 },
            { matterId: 'm2', name: 'Проверка обновлений TT', events: 2 },
            { matterId: 'm3', name: 'Bukhara BESS', events: 1 },
        ],
        topDownloaders: [],
        recentDenied: quiet ? [] : [
            { id: 'a1', at: NOW, userId: 4, userName: 'Bekzod K', action: 'denied', matterId: 'm1', matterName: 'Project Falcon', targetKind: 'matter', targetId: 'm1', targetName: '', detail: '' },
        ],
    } }));
}

test.describe('@e2e Файловый менеджер: мониторинг', () => {
    test('карточки, рейтинги и склонения', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        await mockStats(page);
        await page.goto('/files?view=monitoring');
        await expect(page.locator('.fm-mon__kpis')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.fm-mon-rank').first()).toContainText('68 событий');
        await expect(page.locator('.fm-mon-rank').first()).toContainText('1 событие');
        await expect(page.locator('.fm-mon-alert.is-alert')).toContainText('3');
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mon-1440.png` });
        await page.locator('.fm-mon-kpi', { hasText: 'В корзине' }).click();
        await expect(page).toHaveURL(/view=trash/);
    });

    test('спокойный день и 390', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 390, height: 860 });
        await page.addInitScript(() => {
            try {
                localStorage.setItem('appTheme', 'dark');
            }
            catch {
            }
        });
        await loginAs('admin');
        await mockStats(page, true);
        await page.goto('/files?view=monitoring');
        await expect(page.locator('.fm-mon__kpis')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.fm-mon__grid .fm-mon-empty.is-ok')).toBeVisible();
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/mon-390.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });

    test('удалённые файлы: размер и удаление навсегда', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 1100 });
        await loginAs('admin');
        await mockStats(page);
        const erased: string[] = [];
        let items = [
            { kind: 'document', id: 'd1', name: 'Big archive.zip', matterId: 'm1', matterName: 'Проверка создания Matter', clientName: 'Kosta Legal', deletedAt: NOW, deletedBy: 'Zafar Umerov', canPurge: true, sizeBytes: 30_000_000, storedBytes: 31_000_000, purgedAt: null },
            { kind: 'folder', id: 'f1', name: 'Old drafts', matterId: 'm2', matterName: 'TEST REPORTS', clientName: 'Kosta Legal', deletedAt: NOW, deletedBy: 'Iroda T', canPurge: true, documents: 3, storedBytes: 2_400_000, purgedAt: null },
        ];
        await page.route('**/api/v1/files/trash/*/*/erase', (route) => {
            const id = route.request().url().split('/').slice(-2)[0];
            erased.push(id);
            items = items.filter((item) => item.id !== id);
            return route.fulfill({ json: { ok: true, documents: 1, folders: 0, bytes: 31_000_000, diskBytes: 31_000_000 } });
        });
        await page.route('**/api/v1/files/trash?archived=true', (route) => route.fulfill({ status: 403, json: { detail: 'no' } }));
        await page.route('**/api/v1/files/trash', (route) => route.fulfill({ json: { items } }));
        await page.goto('/files?view=monitoring');
        const card = page.locator('.fm-del');
        await expect(card.locator('.fm-del__list li')).toHaveCount(2, { timeout: 30_000 });
        await expect(card.locator('.fm-del__list li').first()).toContainText('Big archive.zip');
        if (SHOTS)
            await card.screenshot({ path: `${SHOTS}/mon-deleted.png` });
        await card.locator('.fm-del__list li').first().getByRole('button', { name: 'Удалить навсегда' }).click();
        await expect(page.getByRole('dialog')).toContainText('нельзя отменить');
        await page.getByRole('dialog').getByRole('button', { name: 'Удалить навсегда' }).click();
        await expect(card.locator('.fm-del__list li')).toHaveCount(1);
        expect(erased).toEqual(['d1']);
    });
});
