import { test, expect } from '../fixtures/test';

const NOW = '2026-11-18T09:00:00Z';
const SHOTS = process.env.FM_SHOTS_DIR;
const MB = 1024 * 1024;

test.describe('@e2e Файловый менеджер: большие файлы', () => {
    test('файл больше 40 МБ уходит в фоновую очередь частями, переживает сбой и открывается', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const puts: number[] = [];
        let failedOnce = false;
        let received = 0;
        const docs: unknown[] = [];
        const doc = {
            id: 'big', docNumber: 'KL-000099', name: 'Data room.zip', kind: 'other', docType: '', description: '', version: 1,
            sizeBytes: 45 * MB, contentType: 'application/zip', folderId: 'agr', matterId: 'm1', matterName: 'Project Falcon',
            matterCode: 'KL-104', clientId: 'c1', clientName: 'Acme', createdAt: NOW, createdBy: 'Admin', updatedAt: NOW,
            updatedBy: 'Admin', checkedOutById: null, checkedOutBy: null, checkedOutAt: null, favorite: false,
        };
        await page.route('**/api/v1/files/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const path = url.pathname.replace(/^.*\/api\/v1\/files/, '');
            const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
            if (path === '/clients') {
                return json({ viewer: { userId: 1, name: 'Admin', canManage: true }, requestable: [], clients: [{ id: 'c1', name: 'Acme', archived: false, favorite: false, matters: [
                    { id: 'm1', clientId: 'c1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'edit', mine: true, provisioned: true, documents: 0, favorite: false },
                ] }] });
            }
            if (path.startsWith('/access-requests'))
                return json({ requests: [] });
            if (path === '/matters/m1/browse') {
                return json({ matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'edit', favorite: false }, client: { id: 'c1', name: 'Acme' },
                    folderId: 'agr', path: [], folders: [{ id: 'agr', parentId: null, name: 'Agreements', documents: docs.length, createdAt: NOW, favorite: false }], documents: docs });
            }
            if (path === '/matters/m1/uploads' && request.method() === 'POST') {
                const body = request.postDataJSON() as { size: number; folderId: string };
                expect(body.folderId).toBe('agr');
                return json({ id: 'up1', name: 'Data room.zip', size: body.size, received: 0, chunkSize: 8 * MB }, 201);
            }
            if (path === '/uploads/up1' && request.method() === 'PUT') {
                const offset = Number(url.searchParams.get('offset'));
                if (offset === 8 * MB && !failedOnce) {
                    failedOnce = true;
                    return json({ detail: 'temporary' }, 503);
                }
                puts.push(offset);
                received = offset + (request.postDataBuffer()?.length ?? 0);
                await new Promise((resolve) => setTimeout(resolve, 250));
                return json({ id: 'up1', size: 45 * MB, received, chunkSize: 8 * MB });
            }
            if (path === '/uploads/up1/complete') {
                docs.push(doc);
                return json({ documents: [doc], results: [{ status: 'created', document: doc }] });
            }
            if (path === '/documents/big')
                return json({ document: doc, level: 'edit', versions: [], folderPath: [] });
            return json({});
        });
        await page.goto('/files?view=matter&matter=m1&folder=agr');
        await page.locator('input[type="file"]').setInputFiles({ name: 'Data room.zip', mimeType: 'application/zip', buffer: Buffer.alloc(45 * MB, 7) });

        const panel = page.getByRole('region', { name: 'Загрузка файлов' });
        await expect(panel).toBeVisible({ timeout: 30_000 });
        await expect(panel.getByRole('progressbar')).toBeVisible();
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/fm-upload-progress.png` });
        await expect(panel.getByText('Загружено')).toBeVisible({ timeout: 60_000 });
        expect(puts).toEqual([0, 8, 16, 24, 32, 40].map((n) => n * MB));
        expect(received).toBe(45 * MB);
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/fm-upload-done.png` });
        await expect(page.locator('.fm-ex__tile', { hasText: 'Data room.zip' })).toBeVisible();
        await panel.getByRole('button', { name: 'Открыть' }).click();
        await expect(page).toHaveURL(/doc=big/);
    });
});
