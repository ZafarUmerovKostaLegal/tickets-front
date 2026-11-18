import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { USERS } from '../fixtures/users';

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function mockEntries(page: Page) {
    const iso = todayIso();
    const entry = (id: string, hours: number, project: string) => ({
        id, auth_user_id: USERS.employee.id, work_date: iso, hours, duration_seconds: hours * 3600, is_billable: true,
        project_id: `p-${id}`, project_name: project, client_id: `c-${id}`, client_name: 'ООО Альфа', task_id: `t-${id}`,
        task_name: 'Анализ', description: 'Проверка документов', created_at: `${iso}T09:00:00Z`, updated_at: null,
    });
    await page.route('**/time-entries**', (route) => (route.request().method() === 'GET'
        ? route.fulfill({ json: [entry('e1', 2.5, 'Due diligence'), entry('e2', 1.25, 'Арбитраж')] })
        : route.fallback()));
}

test.describe('@e2e Таймшит на телефоне', () => {
    test.use({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });

    test('записи дня видны сразу, добавление — плавающая кнопка, без лишних «+»', async ({ page, loginAs }) => {
        await loginAs('employee');
        await mockEntries(page);
        await page.goto('/time-tracking?tab=timesheet');

        const rows = page.locator('.tsp__row');
        await expect(rows).toHaveCount(2, { timeout: 30_000 });
        const firstRow = await rows.first().boundingBox();
        expect(firstRow!.y + firstRow!.height).toBeLessThan(720);

        const fab = page.locator('.tsp__top-add');
        await expect(fab).toBeVisible();
        const fabBox = (await fab.boundingBox())!;
        expect(fabBox.width).toBe(56);
        expect(fabBox.x + fabBox.width).toBeLessThanOrEqual(320);

        await expect(page.locator('.tsp__day-quick').first()).toBeHidden();
        await expect(page.locator('.tsp-mini')).toBeHidden();
        await expect(page.locator('.tsp__foot')).toBeHidden();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('кнопки записи помещаются в строку на 320px', async ({ page, loginAs }) => {
        await loginAs('employee');
        await mockEntries(page);
        await page.goto('/time-tracking?tab=timesheet');
        const acts = page.locator('.tsp__row-acts').first();
        await expect(acts).toBeVisible({ timeout: 30_000 });
        const right = await acts.evaluate((el) => Math.max(...Array.from(el.children).map((c) => c.getBoundingClientRect().right)));
        expect(right).toBeLessThanOrEqual(320);
    });
});

test.describe('@e2e Таймшит на десктопе', () => {
    test('раскладка десктопа не изменилась', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1280, height: 860 });
        await loginAs('employee');
        await mockEntries(page);
        await page.goto('/time-tracking?tab=timesheet');
        await expect(page.locator('.tsp__row')).toHaveCount(2, { timeout: 30_000 });
        const add = page.locator('.tsp__top-add');
        await expect(add).toContainText('Добавить время');
        expect(await add.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
        await expect(page.locator('.tsp-mini')).toBeVisible();
    });
});
