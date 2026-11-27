import type { Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const NOW = '2026-11-18T09:00:00Z';
const SHOTS = process.env.FM_SHOTS_DIR ?? '';

const matter = (id: string, name: string, code: string, level: string) => ({
    id, clientId: 'c1', name, code, closed: false, level, mine: true, provisioned: true, documents: 12, favorite: false,
});

test.describe('@e2e Файловый менеджер: доступ из списка matters', () => {
    for (const width of [1440, 390]) {
        test(`клик по уровню доступа открывает меню (${width})`, async ({ page, loginAs }) => {
            await page.setViewportSize({ width, height: 900 });
            await loginAs('admin');
            const puts: unknown[] = [];
            const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            await page.route('**/api/v1/files/clients', (route) => json(route, {
                viewer: { userId: 1, name: 'Partner P', canManage: true },
                clients: [{ id: 'c1', name: 'Kosta Legal', archived: false, favorite: false, matters: [
                    matter('m1', 'Проверка создания Matter', 'KL-PRSZ-12/03', 'manage'),
                    matter('m2', 'Только чтение', 'KL-READ-1', 'read'),
                ] }],
                requestable: [],
            }));
            await page.route('**/api/v1/files/access-requests**', (route) => json(route, { requests: [] }));
            await page.route('**/api/v1/files/matters/m1/security', (route) => {
                if (route.request().method() === 'PUT') {
                    puts.push(route.request().postDataJSON());
                    return json(route, { acl: {} });
                }
                return json(route, {
                    matter: { id: 'm1', name: 'Проверка создания Matter', code: 'KL-PRSZ-12/03', clientName: 'Kosta Legal', closed: false },
                    acl: [{ userId: 3, userName: 'Lawyer L', level: 'edit', note: '', grantedBy: 'Partner P', grantedAt: NOW, until: null, suspendedUntil: null }],
                    effective: [
                        { userId: 1, name: 'Partner P', position: 'Partner', source: 'timeTracking', level: 'edit', effective: 'edit', partner: true },
                        { userId: 2, name: 'Iroda T', position: 'Associate', source: 'timeTracking', level: 'edit', effective: 'edit', partner: false },
                        { userId: 3, name: 'Lawyer L', position: 'Junior associate', source: 'acl', level: 'edit', effective: 'edit', partner: false },
                    ],
                    folders: [],
                    documents: [],
                    pendingRequests: 0,
                });
            });
            await page.goto('/files?view=myMatters');

            const row = page.locator('tr, article', { hasText: 'Проверка создания Matter' }).first();
            await expect(row).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('tr, article', { hasText: 'Только чтение' }).first().locator('.fm-level-btn')).toHaveCount(0);

            await row.getByRole('button', { name: /Настроить доступ/ }).click();
            const pop = page.getByRole('dialog', { name: 'Доступ к matter' });
            await expect(pop).toBeVisible();
            await expect(page).toHaveURL(/view=myMatters/);
            await expect(pop).toContainText('Iroda T');
            if (SHOTS)
                await page.screenshot({ path: `${SHOTS}/matter-access-pop-${width}.png` });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

            const iroda = pop.locator('.fm-sx-person', { hasText: 'Iroda T' });
            await iroda.getByRole('radio').nth(0).click();
            await expect.poll(() => puts.length).toBe(1);
            expect(puts[0]).toMatchObject({ userId: 2, level: 'read' });

            await page.keyboard.press('Escape');
            await expect(pop).toBeHidden();
            await expect(page).toHaveURL(/view=myMatters/);
        });
    }
});
