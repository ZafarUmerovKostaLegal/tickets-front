import { test, expect } from '../fixtures/test';

function pad(n: number) {
    return String(n).padStart(2, '0');
}

function isoDay(offset: number) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const graphEvent = (id: string, offset: number, from: string, to: string, subject: string) => ({
    id,
    subject,
    start: { dateTime: `${isoDay(offset)}T${from}:00` },
    end: { dateTime: `${isoDay(offset)}T${to}:00` },
});

test.describe('@e2e Главная: адаптив и поиск', () => {
    test('поиск в шапке фильтрует плитки', async ({ page, loginAs }) => {
        await loginAs('employee');
        const tiles = page.locator('.home-nav-tiles__item');
        await expect(tiles.first()).toBeVisible();
        const total = await tiles.count();
        await page.locator('.home-hub-topbar__search-input').fill('Kosta Daily');
        await expect.poll(() => tiles.count()).toBeLessThan(total);
        await expect(page.locator('.home-nav-tiles__item', { hasText: 'Kosta Daily' })).toBeVisible();
    });

    test('на 320px две колонки плиток и нет горизонтальной прокрутки', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 320, height: 700 });
        await loginAs('employee');
        await expect(page.locator('.home-nav-tiles__item').first()).toBeVisible();
        const columns = await page.locator('.home-nav-tiles__grid').first().evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        );
        expect(columns).toBe(2);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test('на 768px три колонки', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 768, height: 900 });
        await loginAs('employee');
        await expect(page.locator('.home-nav-tiles__item').first()).toBeVisible();
        const columns = await page.locator('.home-nav-tiles__grid').first().evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        );
        expect(columns).toBe(3);
    });
});

test.describe('@e2e Главная на сенсорном телефоне', () => {
    test.use({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });

    test('ручки перетаскивания и подсказка скрыты', async ({ page, loginAs }) => {
        await loginAs('employee');
        await expect(page.locator('.home-nav-tiles__item').first()).toBeVisible();
        await expect(page.locator('.home-nav-tiles__drag-handle').first()).toBeHidden();
        await expect(page.locator('.home-nav-tiles__reorder-hint')).toBeHidden();
    });
});

test.describe('@e2e Kosta Daily: поле ввода', () => {
    test('кнопка отправки активируется при вводе текста, меню скрепки открывается и закрывается', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/kosta-daily');
        await expect(page.locator('.kd-tg')).toBeVisible({ timeout: 30_000 });
        const firstChat = page.locator('.kd-tg__chat-item').first();
        if (await firstChat.isVisible())
            await firstChat.click();

        const send = page.locator('.kd-tg__composer-send');
        await expect(send).toBeDisabled();
        await page.locator('.kd-tg__composer-input').fill('Привет всем');
        await expect(send).toBeEnabled();
        await expect(send).toHaveClass(/kd-tg__composer-send--ready/);

        await page.getByRole('button', { name: 'Прикрепить' }).click();
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        await expect(menu.getByRole('menuitem', { name: 'Файл или фото' })).toBeVisible();
        await expect(menu.getByRole('menuitem', { name: 'Опрос' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
    });

    test('поле ввода растёт вместе с многострочным текстом', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/kosta-daily');
        await expect(page.locator('.kd-tg')).toBeVisible({ timeout: 30_000 });
        const firstChat = page.locator('.kd-tg__chat-item').first();
        if (await firstChat.isVisible())
            await firstChat.click();
        const input = page.locator('.kd-tg__composer-input');
        const before = await input.evaluate((el) => el.getBoundingClientRect().height);
        await input.fill('1\n2\n3\n4');
        await expect.poll(() => input.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(before);
    });
});

test.describe('@e2e Расписание звонков на телефоне', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('список звонков выбранного дня и карточка звонка', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.route('**/api/v1/call-schedule/events**', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                events: [
                    graphEvent('a', 0, '10:00', '10:30', 'Созвон с клиентом'),
                    graphEvent('b', 0, '12:00', '13:00', 'Weekly команды'),
                    graphEvent('c', 1, '11:00', '11:30', 'Встреча с партнёром'),
                ],
            }),
        }));
        await page.goto('/call-schedule');

        const agenda = page.locator('.csched-agenda');
        await expect(agenda).toBeVisible();
        await expect(agenda.locator('.csched-agenda__item')).toHaveCount(2);
        await expect(page.locator('.csched-cal__cell--selected .csched-cal__dot')).toHaveCount(2);

        await agenda.locator('.csched-agenda__item', { hasText: 'Созвон с клиентом' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Созвон с клиентом');
        await dialog.getByRole('button', { name: /закрыть/i }).last().click();
        await expect(dialog).toBeHidden();
    });

    test('без звонков показывается кнопка нового слота', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.route('**/api/v1/call-schedule/events**', (route) => route.fulfill({
            status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }),
        }));
        await page.goto('/call-schedule');
        await expect(page.locator('.csched-agenda__empty')).toBeVisible();
        await page.locator('.csched-agenda__empty').click();
        await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('на десктопе список дня скрыт, а события видны в сетке', async ({ page, loginAs }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await loginAs('admin');
        await page.route('**/api/v1/call-schedule/events**', (route) => route.fulfill({
            status: 200, contentType: 'application/json', body: JSON.stringify({ events: [graphEvent('a', 0, '10:00', '10:30', 'Созвон')] }),
        }));
        await page.goto('/call-schedule');
        await expect(page.locator('.csched-cal__event', { hasText: 'Созвон' })).toBeVisible();
        await expect(page.locator('.csched-agenda')).toBeHidden();
    });
});

test.describe('@e2e Новый проект: тип «Без бюджета»', () => {
    test('выбор «Без бюджета» скрывает поля бюджета', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.goto('/time-tracking/projects/new');
        const typeButton = page.locator('button[id$="-ptype"]');
        const newProject = page.getByRole('button', { name: /Новый проект/ });
        await expect(typeButton.or(newProject)).toBeVisible({ timeout: 20_000 });
        if (!(await typeButton.isVisible()))
            await newProject.click();
        await expect(typeButton).toBeVisible({ timeout: 20_000 });
        await typeButton.click();
        await page.getByRole('option', { name: 'Без бюджета' }).click();
        await expect(typeButton).toContainText('Без бюджета');
        await expect(page.getByText('Часы выставляются клиенту по ставкам')).toBeVisible();
        await expect(page.locator('button[id$="-btype"]')).toHaveCount(0);
    });
});
