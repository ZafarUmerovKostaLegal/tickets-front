import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

type Folder = { id: string; parentId: string | null; name: string; hidden: boolean };
type File = { id: string; folderId: string | null; name: string; hidden: boolean; size: number };
type Calls = { move: unknown[]; copy: unknown[]; hide: unknown[]; remove: unknown[]; create: unknown[] };

const NOW = '2026-11-18T09:00:00Z';

function makeDrive() {
    const folders: Folder[] = [
        { id: 'back', parentId: null, name: 'Back Office', hidden: false },
        { id: 'it', parentId: null, name: 'IT Folder', hidden: false },
        { id: 'main', parentId: null, name: 'MAIN FOLDER', hidden: false },
        { id: 'om', parentId: null, name: 'OM', hidden: false },
        { id: 'contracts', parentId: 'main', name: 'Contracts', hidden: false },
    ];
    const files: File[] = [
        { id: 'f1', folderId: null, name: 'Policy.pdf', hidden: false, size: 120_000 },
        { id: 'f2', folderId: 'contracts', name: 'NDA contract.docx', hidden: false, size: 40_000 },
    ];
    const calls: Calls = { move: [], copy: [], hide: [], remove: [], create: [] };
    let seq = 0;
    const upload = { start: null as null | { name: string; size: number; parentId: string | null }, chunks: 0, received: 0 };

    const crumbs = (id: string | null) => {
        const out: Array<{ id: string; name: string }> = [];
        let current = folders.find((f) => f.id === id);
        while (current) {
            out.unshift({ id: current.id, name: current.name });
            current = folders.find((f) => f.id === current!.parentId);
        }
        return out;
    };
    const folderOut = (f: Folder) => ({
        id: f.id, name: f.name, createdAt: NOW, updatedAt: NOW, hidden: f.hidden, parentId: f.parentId,
        itemCount: folders.filter((c) => c.parentId === f.id).length + files.filter((c) => c.folderId === f.id).length,
    });
    const fileOut = (f: File) => ({
        id: f.id, name: f.name, kind: f.name.endsWith('.pdf') ? 'pdf' : 'doc', size: '1 KB', sizeBytes: f.size,
        createdAt: NOW, updatedAt: NOW, hidden: f.hidden, folderId: f.folderId,
    });
    const browse = (parent: string | null, showHidden: boolean) => ({
        path: crumbs(parent),
        folderId: parent,
        level: 'manage',
        canEdit: true,
        canManage: true,
        folders: folders.filter((f) => f.parentId === parent && (showHidden || !f.hidden)).map(folderOut),
        files: files.filter((f) => f.folderId === parent && (showHidden || !f.hidden)).map(fileOut),
    });

    const handle = async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^.*\/legal-hub\/drive/, '');
        const showHidden = url.searchParams.get('showHidden') === 'true';
        const body = () => request.postDataJSON() as Record<string, unknown>;
        const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        const method = request.method();

        if (method === 'GET' && path === '')
            return json(browse(url.searchParams.get('parentId'), showHidden));
        if (method === 'GET' && path === '/tree')
            return json({ folders: folders.filter((f) => showHidden || !f.hidden).map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, hidden: f.hidden })) });
        if (method === 'GET' && path === '/search') {
            const q = (url.searchParams.get('q') ?? '').toLowerCase();
            return json({
                query: q,
                folders: folders.filter((f) => f.name.toLowerCase().includes(q)).map((f) => ({ ...folderOut(f), path: crumbs(f.parentId) })),
                files: files.filter((f) => f.name.toLowerCase().includes(q)).map((f) => ({ ...fileOut(f), path: crumbs(f.folderId) })),
                truncated: false,
            });
        }
        if (method === 'POST' && path === '/folders') {
            const { name, parentId } = body() as { name: string; parentId: string | null };
            calls.create.push({ name, parentId });
            let parent = parentId ?? null;
            let created: string | null = null;
            for (const part of name.split('/')) {
                const existing = folders.find((f) => f.parentId === parent && f.name === part);
                if (existing) {
                    parent = existing.id;
                    continue;
                }
                seq += 1;
                folders.push({ id: `n${seq}`, parentId: parent, name: part, hidden: false });
                parent = `n${seq}`;
                created ??= parent;
            }
            return json({ ...browse(parentId ?? null, showHidden), createdId: parent });
        }
        if (method === 'POST' && (path === '/move' || path === '/copy')) {
            const data = body() as { folderIds: string[]; fileIds: string[]; targetId: string | null };
            (path === '/move' ? calls.move : calls.copy).push(data);
            if (path === '/move') {
                folders.filter((f) => data.folderIds.includes(f.id)).forEach((f) => { f.parentId = data.targetId; });
                files.filter((f) => data.fileIds.includes(f.id)).forEach((f) => { f.folderId = data.targetId; });
            }
            const count = data.folderIds.length + data.fileIds.length;
            return json(path === '/move' ? { moved: count, targetId: data.targetId } : { copied: count, targetId: data.targetId });
        }
        if (method === 'POST' && path === '/hide') {
            const data = body() as { folderIds: string[]; fileIds: string[]; hidden: boolean };
            calls.hide.push(data);
            folders.filter((f) => data.folderIds.includes(f.id)).forEach((f) => { f.hidden = data.hidden; });
            files.filter((f) => data.fileIds.includes(f.id)).forEach((f) => { f.hidden = data.hidden; });
            return json({ updated: data.folderIds.length + data.fileIds.length });
        }
        if (method === 'POST' && path === '/delete') {
            const data = body() as { folderIds: string[]; fileIds: string[] };
            calls.remove.push(data);
            for (const id of data.folderIds)
                folders.splice(folders.findIndex((f) => f.id === id), 1);
            for (const id of data.fileIds)
                files.splice(files.findIndex((f) => f.id === id), 1);
            return json({ deleted: data.folderIds.length + data.fileIds.length });
        }
        if (method === 'PATCH') {
            const [, kind, id] = path.split('/');
            const { name } = body() as { name: string };
            const item = kind === 'folders' ? folders.find((f) => f.id === id) : files.find((f) => f.id === id);
            if (item)
                item.name = name;
            return json(browse(item && 'parentId' in item ? item.parentId : (item as File | undefined)?.folderId ?? null, showHidden));
        }
        if (method === 'POST' && path === '/uploads') {
            const data = body() as { name: string; size: number; parentId: string | null };
            upload.start = data;
            return json({ id: 'up1', name: data.name, size: data.size, received: 0, chunkSize: 8 * 1024 * 1024 }, 201);
        }
        if (method === 'PUT' && path === '/uploads/up1') {
            upload.chunks += 1;
            upload.received += request.postDataBuffer()?.length ?? 0;
            return json({ id: 'up1', size: upload.start?.size ?? 0, received: upload.received, chunkSize: 8 * 1024 * 1024 });
        }
        if (method === 'POST' && path === '/uploads/up1/complete') {
            const item: File = { id: 'big', folderId: upload.start?.parentId ?? null, name: upload.start?.name ?? 'file', hidden: false, size: upload.received };
            files.push(item);
            return json({ file: fileOut(item), parentId: item.folderId });
        }
        return json({ detail: 'not mocked' }, 404);
    };

    return { folders, files, calls, handle, upload };
}

async function openDisk(page: Page) {
    const drive = makeDrive();
    await page.route('**/api/v1/legal-hub/drive**', drive.handle);
    await page.route('**/api/v1/files/clients', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ viewer: { userId: 1, name: 'Admin', canManage: true }, clients: [], requestable: [] }),
    }));
    await page.route('**/api/v1/files/access-requests**', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ requests: [] }),
    }));
    await page.goto('/files');
    await expect(page.locator('.fm-disk-x .fm-ex__tile').first()).toBeVisible({ timeout: 30_000 });
    return drive;
}

const tile = (page: Page, name: string) => page.locator('.fm-disk-x .fm-ex__tile', { hasText: name });

test.describe('@e2e Файловый менеджер: Диск как проводник', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.addInitScript(() => {
            try {
                localStorage.removeItem('fm-disk-layout');
                localStorage.removeItem('fm-disk-hidden');
            }
            catch {
            }
        });
    });

    test('дерево папок, создание вложенной структуры и навигация назад', async ({ page, loginAs }) => {
        await loginAs('admin');
        const drive = await openDisk(page);
        const tree = page.locator('.fm-disk-x__tree');
        await expect(tree).toContainText('MAIN FOLDER');

        await page.keyboard.press('Control+Shift+N');
        const input = page.getByRole('dialog').locator('input');
        await input.fill('Clients/ACME/2026');
        await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
        await expect(tile(page, 'Clients')).toBeVisible();
        expect(drive.calls.create).toEqual([{ name: 'Clients/ACME/2026', parentId: null }]);
        await expect(tree).toContainText('Clients');

        await tile(page, 'MAIN FOLDER').dblclick();
        await expect(tile(page, 'Contracts')).toBeVisible();
        await expect(page.locator('.fm-disk-x__crumbs')).toContainText('MAIN FOLDER');
        await page.keyboard.press('Alt+ArrowLeft');
        await expect(tile(page, 'Back Office')).toBeVisible();
    });

    test('перетаскивание папки в другую папку и в дерево', async ({ page, loginAs }) => {
        await loginAs('admin');
        const drive = await openDisk(page);
        await tile(page, 'OM').dragTo(tile(page, 'Back Office'));
        await expect.poll(() => drive.calls.move.length).toBe(1);
        expect(drive.calls.move[0]).toEqual({ folderIds: ['om'], fileIds: [], targetId: 'back' });
        await expect(tile(page, 'OM')).toHaveCount(0);

        await tile(page, 'Policy.pdf').dragTo(page.locator('.fm-disk-x__tree-row', { hasText: 'IT Folder' }));
        await expect.poll(() => drive.calls.move.length).toBe(2);
        expect(drive.calls.move[1]).toEqual({ folderIds: [], fileIds: ['f1'], targetId: 'it' });
    });

    test('множественное выделение, вырезать и вставить в другую папку', async ({ page, loginAs }) => {
        await loginAs('admin');
        const drive = await openDisk(page);
        await tile(page, 'IT Folder').click();
        await tile(page, 'Policy.pdf').click({ modifiers: ['Control'] });
        await expect(page.locator('.fm-disk__status')).toContainText('Выбрано: 2');
        await page.keyboard.press('Control+X');
        await expect(tile(page, 'IT Folder')).toHaveClass(/is-cut/);

        await tile(page, 'Back Office').dblclick();
        await expect(page.locator('.fm-disk-x__crumbs')).toContainText('Back Office');
        await page.keyboard.press('Control+V');
        await expect.poll(() => drive.calls.move.length).toBe(1);
        expect(drive.calls.move[0]).toEqual({ folderIds: ['it'], fileIds: ['f1'], targetId: 'back' });
        await expect(tile(page, 'IT Folder')).toBeVisible();
    });

    test('скрытие папки, показ скрытых и удаление', async ({ page, loginAs }) => {
        await loginAs('admin');
        const drive = await openDisk(page);
        await tile(page, 'OM').click({ button: 'right' });
        await page.getByRole('menuitem', { name: 'Скрыть' }).click();
        await expect(tile(page, 'OM')).toHaveCount(0);
        expect(drive.calls.hide[0]).toEqual({ folderIds: ['om'], fileIds: [], hidden: true });

        await page.getByRole('button', { name: 'Просмотр' }).click();
        await page.getByRole('button', { name: 'Скрытые элементы' }).click();
        await expect(tile(page, 'OM')).toHaveClass(/is-hidden/);

        await tile(page, 'OM').click();
        await page.keyboard.press('Delete');
        await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();
        await expect.poll(() => drive.calls.remove.length).toBe(1);
        await expect(tile(page, 'OM')).toHaveCount(0);
    });

    test('удалённые файлы не исчезают: список и восстановление', async ({ page, loginAs }) => {
        await loginAs('admin');
        const drive = await openDisk(page);
        const deleted = [
            { id: 'd1', source: 'drive', name: 'Old contract.pdf', sizeBytes: 81_920, contentType: 'application/pdf', path: 'MAIN FOLDER/Contracts', taskId: null, deletedBy: 'Iroda T', deletedAt: '2026-03-02T09:00:00Z', createdAt: '2025-11-01T09:00:00Z' },
            { id: 'd2', source: 'task', name: 'scan.jpg', sizeBytes: 20_480, contentType: 'image/jpeg', path: '', taskId: 't1', deletedBy: 'Admin', deletedAt: '2026-04-10T09:00:00Z', createdAt: null },
        ];
        let restored = '';
        await page.route('**/api/v1/legal-hub/drive/deleted**', async (route) => {
            const url = route.request().url();
            if (url.endsWith('/restore')) {
                restored = url.split('/deleted/')[1]!.split('/')[0]!;
                deleted.splice(deleted.findIndex((row) => row.id === restored), 1);
                drive.files.push({ id: 'r1', folderId: 'contracts', name: 'Old contract.pdf', hidden: false, size: 81_920 });
                return route.fulfill({ json: { parentId: 'contracts', file: {} } });
            }
            return route.fulfill({ json: { items: deleted } });
        });
        await page.getByRole('button', { name: 'Удалённые файлы' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('Old contract.pdf')).toBeVisible();
        await expect(dialog.getByText(/Вложение задачи/)).toBeVisible();
        await dialog.getByRole('button', { name: 'Восстановить' }).click();
        await expect.poll(() => restored).toBe('d1');
        await expect(dialog.getByText('Old contract.pdf')).toHaveCount(0);
    });

    test('поиск по всем подпапкам с переходом к расположению', async ({ page, loginAs }) => {
        await loginAs('admin');
        await openDisk(page);
        await page.keyboard.press('Control+F');
        await page.keyboard.type('contract');
        await expect(page.locator('.fm-disk-x__banner')).toContainText('Результаты поиска');
        await expect(tile(page, 'NDA contract.docx')).toContainText('MAIN FOLDER › Contracts');
        await tile(page, 'NDA contract.docx').click({ button: 'right' });
        await page.getByRole('menuitem', { name: 'Открыть расположение' }).click();
        await expect(page.locator('.fm-disk-x__crumbs')).toContainText('Contracts');
        await expect(tile(page, 'NDA contract.docx')).toHaveClass(/is-on/);
    });
});

test('@e2e Диск: файл больше 40 МБ загружается частями в фоне и появляется в папке', async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs('admin');
    const drive = await openDisk(page);
    await page.locator('.fm-disk-x input[type="file"]:not([webkitdirectory])').first()
        .setInputFiles({ name: 'Video.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(45 * 1024 * 1024, 1) });
    const panel = page.getByRole('region', { name: 'Загрузка файлов' });
    await expect(panel.getByText('Загружено')).toBeVisible({ timeout: 60_000 });
    expect(drive.upload.start).toEqual({ name: 'Video.mp4', size: 45 * 1024 * 1024, contentType: 'video/mp4', parentId: null, path: '' });
    expect(drive.upload.chunks).toBe(6);
    await expect(tile(page, 'Video.mp4')).toBeVisible();
});

test.describe('@e2e Файловый менеджер: Диск на телефоне', () => {
    test.use({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });

    test('без панели дерева, без горизонтального скролла, тап открывает папку', async ({ page, loginAs }) => {
        await loginAs('admin');
        await openDisk(page);
        await expect(page.locator('.fm-disk-x__tree')).toBeHidden();
        await tile(page, 'MAIN FOLDER').tap();
        await expect(tile(page, 'Contracts')).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
