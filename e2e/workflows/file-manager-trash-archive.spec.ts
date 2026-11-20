import { test, expect } from '../fixtures/test';

const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    kind: 'document', id, name, matterId: 'm1', matterName: 'Project Falcon', clientName: 'Acme',
    canPurge: true, deletedAt: '2026-11-10T09:00:00Z', deletedBy: 'Iroda T', fileKind: 'pdf', sizeBytes: 4096, ...extra,
});

test.describe('@e2e Файловый менеджер: файлы не удаляются окончательно', () => {
    test('«Убрать из корзины» честно говорит, что файл сохранится, а главный админ видит архив', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        let purged = '';
        await page.route('**/api/v1/files/clients', (route) => route.fulfill({ json: { viewer: { userId: 1, name: 'Root', canManage: true, superAdmin: true }, clients: [], requestable: [] } }));
        await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({ json: { requests: [] } }));
        await page.route('**/api/v1/files/trash**', async (route) => {
            const url = new URL(route.request().url());
            if (route.request().method() === 'DELETE') {
                purged = url.pathname.split('/').pop() ?? '';
                return route.fulfill({ json: { ok: true } });
            }
            const archived = url.searchParams.get('archived') === 'true';
            return route.fulfill({ json: { items: archived ? [item('a1', 'Old NDA.pdf', { purgedAt: '2026-11-11T09:00:00Z' })] : [item('t1', 'Draft.pdf')] } });
        });
        await page.goto('/files?view=trash');
        await expect(page.getByText('Draft.pdf')).toBeVisible({ timeout: 20_000 });
        await page.getByRole('button', { name: 'Убрать из корзины' }).click();
        await expect(page.getByText(/Файл не удаляется: он сохранится в архиве/)).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Убрать из корзины' }).click();
        await expect.poll(() => purged).toBe('t1');
        await page.getByRole('tab', { name: 'Архив удалённого' }).click();
        await expect(page.getByText('Old NDA.pdf')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Убрать из корзины' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Восстановить' })).toBeVisible();
    });
});
