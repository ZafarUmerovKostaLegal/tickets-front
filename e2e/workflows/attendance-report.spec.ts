import { test, expect } from '../fixtures/test';

const people = [
    ['00000025', 'Iroda Tokhirova', 'Associate'],
    ['00000057', 'Iroda Bekmurodova', 'Junior Associate'],
    ['00000019', 'Jahongir Bahodirov', 'Junior Associate'],
    ['00000030', 'Nigina Begalieva', 'Associate'],
    ['00000031', 'Anastasia Sanina', 'Associate'],
    ['00000032', 'Dilshodbek Orifjonov', 'Associate'],
];

function periodItems(from: string, to: string) {
    const items: unknown[] = [];
    const d = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    let n = 0;
    while (d <= end) {
        const ymd = d.toISOString().slice(0, 10);
        people.forEach(([no, name, pos], i) => {
            n += 1;
            const absent = (n + i) % 9 === 0 || d.getDay() === 0 || d.getDay() === 6;
            const late = !absent && (n + i) % 4 === 0;
            const inH = late ? 10 + (i % 2) : 9;
            const inM = (n * 7 + i * 3) % 50;
            items.push({
                date: ymd,
                app_user_id: i + 1,
                display_name: name,
                email: null,
                role: 'Сотрудник',
                position: pos,
                camera_employee_no: no,
                camera_name: name,
                status: absent ? 'absent' : late ? 'late' : 'present_on_time',
                first_event_time: absent ? null : `${ymd}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00+05:00`,
                last_event_time: absent || (n % 11 === 0) ? null : `${ymd}T18:${String((n * 5) % 60).padStart(2, '0')}:00+05:00`,
                event_count: 4,
                unique_event_count: 3,
            });
        });
        d.setDate(d.getDate() + 1);
    }
    return items;
}

async function mock(page: import('@playwright/test').Page) {
    await page.route('**/api/v1/attendance/report/period**', async (route) => {
        const url = new URL(route.request().url());
        await route.fulfill({ json: { date_from: url.searchParams.get('date_from'), date_to: url.searchParams.get('date_to'), app_user_id: null, items: periodItems(url.searchParams.get('date_from')!, url.searchParams.get('date_to')!), workday: { workday_start: '09:00:00', workday_end: '18:00:00' } } });
    });
    await page.route('**/api/v1/attendance/hikvision/ingest/status', (route) => route.fulfill({ json: {
        events_total: 48213, min_event_time: '2026-01-05T08:40:00+05:00', max_event_time: '2026-11-20T13:10:00+05:00',
        poller_running: true, last_poll_at: new Date().toISOString(), last_poll_error: null, backfill_running: false,
    } }));
}

test.describe('@e2e @flows Attendance period report', () => {
    for (const width of [1440, 390]) {
        test(`summary per employee and drill-down by day (${width})`, async ({ page, loginAs }) => {
            await page.setViewportSize({ width, height: 900 });
            await loginAs('admin');
            await mock(page);
            await page.goto('/attendance');
            await page.getByRole('button', { name: 'Этот месяц' }).click();
            const summary = page.locator('.att-overview__list--summary');
            await expect(summary).toBeVisible({ timeout: 20_000 });
            await expect(summary.locator('tbody tr')).toHaveCount(people.length);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
            await page.getByRole('tab', { name: 'По дням' }).click();
            await expect(page.locator('.att-overview__list--period tbody tr').first()).toBeVisible();
            await expect(page.locator('.att-overview__list--period td.att-overview__date-cell', { hasText: /^(7|8) нояб/ })).toHaveCount(0);
            await page.getByRole('tab', { name: 'Сводка' }).click();
            await summary.locator('tbody tr').first().click();
            await expect(page.locator('.att-overview__list--period')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Excel по сотруднику' })).toBeVisible();
        });
    }

    test('several employees can be picked at once', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await loginAs('admin');
        await mock(page);
        await page.goto('/attendance');
        await page.getByRole('button', { name: 'Этот месяц' }).click();
        const summary = page.locator('.att-overview__list--summary tbody tr');
        await expect(summary).toHaveCount(people.length, { timeout: 20_000 });
        await page.locator('.att-multi__button').click();
        await page.getByRole('option', { name: 'Iroda Tokhirova' }).click();
        await page.getByRole('option', { name: 'Nigina Begalieva' }).click();
        await page.getByRole('option', { name: 'Anastasia Sanina' }).click();
        await page.screenshot({ path: test.info().outputPath('multi-open.png') });
        await page.keyboard.press('Escape');
        await expect(page.locator('.att-multi__button')).toContainText('Выбрано: 3');
        await expect(summary).toHaveCount(3);
        await expect(page.locator('.att-overview__kpi').first()).toContainText('3');
        await expect(page.getByRole('button', { name: 'Excel за период' })).toBeEnabled();
        await page.screenshot({ path: test.info().outputPath('multi-picked.png') });
        await page.getByRole('button', { name: 'Сбросить' }).first().click();
        await expect(summary).toHaveCount(people.length);
    });

    test('Transaction CSV import loads punches and reports the range', async ({ page, loginAs }) => {
        await loginAs('admin');
        await mock(page);
        let uploaded = '';
        await page.route('**/api/v1/attendance/hikvision/ingest/import-csv', async (route) => {
            uploaded = route.request().postData() ?? '';
            await route.fulfill({ json: {
                ok: true, filename: 'Transaction.csv', rows_read: 3, rows_mapped: 3, rows_unmapped: 0, upserted: 3,
                date_min: '2026-01-05', date_max: '2026-11-20', unmapped_names: {},
            } });
        });
        await page.goto('/attendance');
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Импорт CSV' }).click();
        await (await chooser).setFiles({
            name: 'Transaction_2026-01-01_2026-12-31.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(['First Name,Date,Week,Time', 'Diyorbek,2026-01-05,Monday,09:01', ''].join('\n')),
        });
        await expect(page.getByText(/Импортировано 3 отметок/)).toBeVisible({ timeout: 15_000 });
        expect(uploaded).toContain('Diyorbek');
    });
});
