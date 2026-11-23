import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const ME = 4;
const NOW = '2026-11-18T09:00:00Z';

type Task = Record<string, unknown> & { id: string; status: string; boardColumn: string; assigneeUserId: number; reviewerUserId: number | null };

function makeHub() {
    const tasks: Task[] = [
        { id: 't1', title: 'SPA review', projectId: 'p1', projectLabel: 'Project Falcon', status: 'todo', boardColumn: 'todo', assigneeUserId: ME, reviewerUserId: null, dueOn: '2026-11-25' },
        { id: 't2', title: 'Board minutes', projectId: 'p1', projectLabel: 'Project Falcon', status: 'progress', boardColumn: 'progress', assigneeUserId: ME, reviewerUserId: null, dueOn: '2026-11-10' },
        { id: 't3', title: 'Lease memo', projectId: 'p2', projectLabel: 'Warehouse lease', status: 'progress', boardColumn: 'progress', assigneeUserId: ME, reviewerUserId: null, dueOn: '2026-11-30' },
    ];
    const actions: Array<{ id: string; body: unknown }> = [];
    const history: Record<string, Array<{ id: string; kind: string; actor: string; text: string; createdAt: string }>> = {};

    const allowed = (task: Task) => {
        if (task.boardColumn === 'done')
            return [];
        if (task.status === 'associate')
            return ['approve', 'return', 'reassign'];
        return [...(task.status === 'todo' ? ['take'] : []), 'submit', 'reassign'];
    };
    const detail = (task: Task) => ({
        ...task, priority: 'normal', createdAt: NOW, updatedAt: NOW, comments: [], files: [], checks: [],
        history: history[task.id] ?? [], actions: allowed(task),
    });

    const handle = async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace('/api/v1/legal-hub', '');
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (path === '/teams') {
            return json({ userId: ME, mates: [ME, 11, 12], teams: [{
                id: 'team-a', name: 'Team A', partnerId: ME, memberIds: [11, 12], viaTemp: false, canManage: true,
                members: [{ id: ME, name: 'Пётр Партнёров', lead: true }, { id: 11, name: 'Анна Юрист' }, { id: 12, name: 'Иван Младший' }],
                temps: [{ id: 'g1', userId: 30, name: 'Гость Временный', email: 'guest@kostalegal.com', expiresOn: '2026-12-01', grantedBy: 'Пётр', active: true }],
            }] });
        }
        if (path === '/stats') {
            return json({
                totals: { open: 3, overdue: 1, dueWeek: 1, review: 0, changes: 0, done30: 2, returned30: 1 },
                people: [{ userId: ME, open: 3, overdue: 1, done30: 2, review: 0, byStage: { todo: 1, progress: 2 } }],
                projects: [
                    { id: 'p1', name: 'Project Falcon', total: 4, done: 2, progress: 50, stage: 'progress', stages: { todo: 1, progress: 1, wait: 0, review: 0, changes: 0, done: 2 }, overdue: 1, nextDue: '2026-11-25', people: [ME], updatedAt: NOW },
                    { id: 'p2', name: 'Warehouse lease', total: 1, done: 0, progress: 0, stage: 'review', stages: { todo: 0, progress: 0, wait: 0, review: 1, changes: 0, done: 0 }, overdue: 0, nextDue: null, people: [ME], updatedAt: NOW },
                ],
            });
        }
        const action = /^\/tasks\/([^/]+)\/action$/.exec(path);
        if (action && request.method() === 'POST') {
            const task = tasks.find((row) => row.id === action[1])!;
            const body = request.postDataJSON() as { action: string; userId?: number; comment?: string };
            actions.push({ id: task.id, body });
            const kind = { take: 'taken', submit: 'submitted', approve: 'approved', return: 'returned', reassign: 'reassigned' }[body.action] ?? body.action;
            (history[task.id] ??= []).push({ id: `h${actions.length}`, kind, actor: 'Пётр Партнёров', text: '', createdAt: NOW });
            if (body.action === 'take')
                Object.assign(task, { status: 'progress', boardColumn: 'progress' });
            if (body.action === 'submit')
                Object.assign(task, { status: 'associate', boardColumn: 'associate', reviewerUserId: task.reviewerUserId ?? body.userId ?? null });
            return json(detail(task));
        }
        const one = /^\/tasks\/([^/]+)$/.exec(path);
        if (one)
            return json(detail(tasks.find((row) => row.id === one[1])!));
        if (path === '/tasks')
            return json({ items: tasks.map((task) => ({ ...task, priority: 'normal', createdAt: NOW, updatedAt: NOW })) });
        if (path === '/summary')
            return json({ mine: tasks.length, review: 0, team: tasks.length });
        if (path.startsWith('/board'))
            return json({});
        return json({ items: [] });
    };
    return { handle, actions, tasks };
}

async function openHub(page: Page, path = '/legal-hub') {
    const hub = makeHub();
    await page.route('**/api/v1/legal-hub/**', hub.handle);
    await page.goto(path);
    return hub;
}

test.describe('@e2e Legal Hub: командная работа', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.clock.setFixedTime(new Date('2026-11-18T12:00:00'));
        await page.addInitScript(() => {
            try {
                localStorage.setItem('lh-board-view', 'list');
            }
            catch {
            }
        });
    });

    test('список задач разбит по проектам, в карточке — рабочий цикл', async ({ page, loginAs }) => {
        await loginAs('partner');
        const hub = await openHub(page);
        await page.getByRole('button', { name: 'Список', exact: true }).click();

        const falcon = page.getByRole('region', { name: 'Project Falcon' });
        await expect(falcon).toBeVisible({ timeout: 30_000 });
        await expect(falcon.locator('li')).toHaveCount(2);
        await expect(page.getByRole('region', { name: 'Warehouse lease' }).locator('li')).toHaveCount(1);

        await falcon.getByText('SPA review').click();
        await page.getByRole('button', { name: 'Принять в работу' }).click();
        await expect(page.getByRole('button', { name: 'Принять в работу' })).toHaveCount(0);

        await page.locator('.lh-act__row').first().getByRole('button', { name: 'На проверку', exact: true }).click();
        await page.locator('.lh-act__pick').click();
        await page.getByRole('option', { name: 'Анна Юрист' }).click();
        await page.locator('.lh-act__form').getByRole('button', { name: 'На проверку' }).click();
        await expect(page.getByRole('button', { name: 'Принять работу' })).toBeVisible();
        expect(hub.actions.map((row) => row.body)).toEqual([
            { action: 'take' },
            { action: 'submit', userId: 11 },
        ]);
    });

    test('карта проектов и статистика команды', async ({ page, loginAs }) => {
        await loginAs('partner');
        await openHub(page, '/legal-hub?view=projects');
        const map = page.getByRole('region', { name: 'Этапы проектов' });
        await expect(map).toBeVisible({ timeout: 30_000 });
        await expect(map.locator('.lh-map__row')).toHaveCount(2);
        await expect(map.locator('.lh-map__row').first().locator('.lh-map__step.is-current')).toContainText('В работе');
        await expect(map.getByText('Просрочено: 1')).toBeVisible();
        await expect(page.locator('.lh-stats__tile', { hasText: 'Готово за 30 дней' })).toContainText('2');
        await page.screenshot({ path: 'test-results/legal-hub-project-map.png', fullPage: true });
    });
});
