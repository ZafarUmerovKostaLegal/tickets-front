import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/test';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

type Meta = { id: string; fileName: string; sizeBytes: number; uploadedAt: string; uploadedByAuthUserId: number };

const systemRow = (pdfFileName: string) => ({
    id: 'sys-inv-1',
    invoiceId: 'inv-1',
    seqNo: '1',
    billedTo: 'ООО Альфа',
    currency: 'USD',
    amount: '5,000.00',
    partner: 'TEST',
    issueDate: '2026-10-02',
    dueOrPayment: '2026-11-01',
    clientNumber: 'INV-2026-00173',
    statusNote: 'Выставлен',
    advanceFee: '',
    balance: '5,000.00',
    pdfFileName,
    pdfUploadedAt: pdfFileName ? '2026-11-17T10:00:00Z' : '',
});

async function mockRegistry(page: Page, state: { current: Meta | null; uploads: string[] }) {
    const json = (route: Route, body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    await page.route('**/api/v1/time-tracking/invoice-registry/years', (route) => json(route, {
        years: [{ id: '2026-system', sheetName: '2026 (система)', mode: 'system', rowCount: 1 }],
        seedRevision2026: null,
    }));
    await page.route('**/api/v1/time-tracking/invoice-registry/2026-system**', (route) => json(route, {
        year: '2026-system',
        sheetName: '2026 (система)',
        mode: 'system',
        columns: [],
        rows: [systemRow(state.current?.fileName ?? '')],
        statuses: ['Выставлен', 'Оплачен'],
    }));
    await page.route('**/api/v1/time-tracking/invoices/inv-1/pdf-file/content**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }));
    await page.route('**/api/v1/time-tracking/invoices/inv-1/pdf-file', async (route) => {
        if (route.request().method() === 'PUT') {
            const body = route.request().postDataBuffer()?.toString('utf8') ?? '';
            const name = /filename="([^"]+)"/.exec(body)?.[1] ?? 'upload.pdf';
            state.uploads.push(name);
            state.current = { id: `f${state.uploads.length}`, fileName: name, sizeBytes: PDF.length, uploadedAt: '2026-11-17T12:30:00Z', uploadedByAuthUserId: 1 };
            return json(route, { current: state.current });
        }
        return json(route, { current: state.current });
    });
}

async function openSystemSheet(page: Page) {
    await page.goto('/time-tracking?tab=invoices&invTab=registry');
    await page.getByText('2026 (система)', { exact: true }).first().click();
    await expect(page.locator('.tt-inv-reg__pdf').first()).toBeVisible({ timeout: 20_000 });
}

test.describe('@e2e Реестр инвойсов: замена PDF', () => {
    test('загруженный PDF показывается вместо сгенерированного и заменяется новым', async ({ page, loginAs }) => {
        await loginAs('admin');
        const state = { current: { id: 'f0', fileName: 'Старый счёт.pdf', sizeBytes: PDF.length, uploadedAt: '2026-11-01T09:00:00Z', uploadedByAuthUserId: 1 } as Meta | null, uploads: [] as string[] };
        await mockRegistry(page, state);
        await openSystemSheet(page);

        const pdfButton = page.locator('.tt-inv-reg__pdf--uploaded').first();
        await expect(pdfButton).toContainText('свой PDF');
        await pdfButton.click();

        const dialog = page.locator('.tt-inv-reg-pdf__dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('.tt-inv-reg-pdf__name')).toContainText('Старый счёт.pdf');
        await expect(dialog.locator('.tt-inv-reg-pdf__source--uploaded')).toBeVisible();
        await expect(dialog.locator('iframe.tt-inv-reg-pdf__frame')).toBeVisible();

        await dialog.locator('input[type="file"]').setInputFiles({ name: 'Новый счёт.pdf', mimeType: 'application/pdf', buffer: PDF });
        await page.getByRole('button', { name: 'Заменить', exact: true }).click();

        await expect(dialog.locator('.tt-inv-reg-pdf__name')).toContainText('Новый счёт.pdf');
        expect(state.uploads).toHaveLength(1);
        await expect(page.getByText(/PDF заменён/)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.tt-inv-reg__pdf--uploaded').first()).toHaveAttribute('title', /Новый счёт\.pdf/);
    });

    test('не-PDF отклоняется без загрузки, отмена подтверждения ничего не отправляет', async ({ page, loginAs }) => {
        await loginAs('admin');
        const state = { current: { id: 'f0', fileName: 'a.pdf', sizeBytes: 1, uploadedAt: '2026-11-01T09:00:00Z', uploadedByAuthUserId: 1 } as Meta | null, uploads: [] as string[] };
        await mockRegistry(page, state);
        await openSystemSheet(page);
        await page.locator('.tt-inv-reg__pdf').first().click();
        const dialog = page.locator('.tt-inv-reg-pdf__dialog');
        const input = dialog.locator('input[type="file"]');

        await input.setInputFiles({ name: 'contract.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK') });
        await expect(page.getByText('Выберите файл в формате PDF')).toBeVisible();

        await input.setInputFiles({ name: 'b.pdf', mimeType: 'application/pdf', buffer: PDF });
        await page.getByRole('button', { name: 'Отмена' }).last().click();
        expect(state.uploads).toEqual([]);
        await expect(dialog.locator('.tt-inv-reg-pdf__name')).toContainText('a.pdf');
    });
});
