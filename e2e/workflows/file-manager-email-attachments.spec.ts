import type { Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const NOW = '2026-11-26T06:23:50Z';
const SHOTS = process.env.FM_SHOTS_DIR ?? '';

const letter = {
    id: 'mail1', docNumber: 'KL-000051', name: '2026-11-26 info@kostalegal.com — Test.eml', kind: 'email', docType: '', description: 'Test',
    version: 4, sizeBytes: 302_000, contentType: 'message/rfc822', folderId: 'emails', matterId: 'm1', matterName: 'Project Falcon',
    matterCode: 'KL-104', clientId: 'c1', clientName: 'Acme', createdAt: NOW, createdBy: 'Zafar Umerov', updatedAt: NOW,
    updatedBy: 'Zafar Umerov', checkedOutById: null, checkedOutBy: null, checkedOutAt: null, favorite: false,
};

test.describe('@e2e Файловый менеджер: вложения письма', () => {
    test('сохраняются в matter, у остальных — «Открыть»', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const saves: string[] = [];
        let saved: null | Record<string, unknown> = null;
        const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        await page.route('**/api/v1/files/clients', (route) => json(route, {
            viewer: { userId: 1, name: 'Partner P', canManage: true },
            clients: [{ id: 'c1', name: 'Acme', matters: [{ id: 'm1', clientId: 'c1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'manage', mine: true, favorite: false }] }],
            requestable: [],
        }));
        await page.route('**/api/v1/files/access-requests**', (route) => json(route, { requests: [] }));
        await page.route('**/api/v1/files/matters/m1/browse**', (route) => json(route, {
            matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'manage', favorite: false },
            client: { id: 'c1', name: 'Acme' }, folderId: 'emails', path: [],
            folders: [{ id: 'corr', parentId: null, name: 'Correspondence', documents: 1, createdAt: NOW, favorite: false },
                { id: 'emails', parentId: 'corr', name: 'Emails', documents: 1, createdAt: NOW, favorite: false }],
            documents: [letter],
        }));
        await page.route('**/api/v1/files/documents/mail1', (route) => json(route, {
            document: letter, level: 'manage', canManageAccess: true, path: [], versions: [], activity: [],
        }));
        await page.route('**/api/v1/files/documents/mail1/email', (route) => json(route, {
            subject: 'Test', from: 'Info <info@kostalegal.com>', to: 'Zafar Umerov <zumerov@kostalegal.com>', cc: '',
            date: 'Thu, 26 Nov 2026 06:23:50 +0000', html: '', text: 'See attached',
            attachments: [
                { index: 0, name: 'pdf.pdf', contentType: 'application/pdf', size: 216_000, saved: null },
                { index: 1, name: 'NDA signed.pdf', contentType: 'application/pdf', size: 98_000, saved: {
                    documentId: 'd9', name: 'NDA signed.pdf', folderId: 'emails', folderPath: 'Correspondence / Emails',
                    savedBy: 'Iroda T', savedAt: NOW, visible: false,
                } },
            ],
        }));
        await page.route('**/api/v1/files/documents/mail1/email/0/save', (route) => {
            saves.push(String((route.request().postDataJSON() as { folderId?: string | null }).folderId ?? 'root'));
            saved = { ...letter, id: 'd10', name: 'pdf.pdf', kind: 'pdf', contentType: 'application/pdf', sizeBytes: 216_000 };
            return json(route, { status: 'created', document: saved, folderId: 'emails', folderPath: 'Correspondence / Emails', savedBy: 'Partner P' });
        });
        await page.goto('/files?view=matter&matter=m1&folder=emails&doc=mail1');
        const list = page.locator('.fm-att');
        await expect(list.locator('li')).toHaveCount(2, { timeout: 30_000 });
        await expect(list.locator('li').nth(1)).toContainText('Открыть папку');
        await expect(list.locator('li').nth(1)).toContainText('Correspondence / Emails · Iroda T');
        await expect(page.locator('.fm-pane__actions')).not.toContainText('Скачать');
        await list.locator('li').first().getByRole('button', { name: 'В matter' }).click();
        const picker = page.locator('.fm-attpick');
        await expect(picker.getByRole('option', { name: 'Emails' })).toHaveAttribute('aria-selected', 'true');
        await picker.getByRole('option', { name: 'Correspondence' }).click();
        if (SHOTS)
            await page.locator('.fm-pane').screenshot({ path: `${SHOTS}/email-attach-picker.png` });
        await picker.getByRole('button', { name: 'Сохранить сюда' }).click();
        await expect(picker).toHaveCount(0);
        expect(saves).toEqual(['corr']);
        await expect(list.locator('li').first()).toContainText('Открыть');
        await expect(list.locator('li').first()).toContainText('Correspondence / Emails · Partner P');
        expect(saves).toHaveLength(1);
        expect(saved).not.toBeNull();
        const overflow = await page.locator('.fm-pane').evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        if (SHOTS)
            await page.locator('.fm-pane').screenshot({ path: `${SHOTS}/email-attachments.png` });
        await list.locator('li').nth(1).getByRole('button').click();
        await expect(page).toHaveURL(/folder=emails/);
    });

    test('PDF открывается в превью и на весь экран', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        const pdf = { ...letter, id: 'pdf1', name: 'Contract.pdf', kind: 'pdf', contentType: 'application/pdf', sizeBytes: 600 };
        const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        await page.route('**/api/v1/files/clients', (route) => json(route, {
            viewer: { userId: 1, name: 'Partner P', canManage: true },
            clients: [{ id: 'c1', name: 'Acme', matters: [{ id: 'm1', clientId: 'c1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'manage', mine: true, favorite: false }] }],
            requestable: [],
        }));
        await page.route('**/api/v1/files/access-requests**', (route) => json(route, { requests: [] }));
        await page.route('**/api/v1/files/matters/m1/browse**', (route) => json(route, {
            matter: { id: 'm1', name: 'Project Falcon', code: 'KL-104', closed: false, level: 'manage', favorite: false },
            client: { id: 'c1', name: 'Acme' }, folderId: null, path: [], folders: [], documents: [pdf],
        }));
        await page.route('**/api/v1/files/documents/pdf1', (route) => json(route, { document: pdf, level: 'manage', canManageAccess: true, path: [], versions: [], activity: [] }));
        await page.route('**/api/v1/files/documents/pdf1/content**', (route) => route.fulfill({
            status: 200, contentType: 'application/pdf',
            body: ['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj', 'trailer<</Root 1 0 R>>', '%%EOF'].join('\n'),
        }));
        await page.goto('/files?view=matter&matter=m1&doc=pdf1');
        const frame = page.locator('.fm-pane iframe.fm-pv--pdf');
        await expect(frame).toHaveAttribute('src', /^blob:/, { timeout: 30_000 });
        await page.getByRole('button', { name: 'На весь экран' }).click();
        const dialog = page.getByRole('dialog', { name: 'Contract.pdf' });
        await expect(dialog.locator('iframe.fm-pv--pdf')).toHaveAttribute('src', /^blob:/);
        const box = await dialog.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThan(1200);
        if (SHOTS)
            await page.screenshot({ path: `${SHOTS}/pdf-fullscreen.png` });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
    });
});
