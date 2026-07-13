import { test, expect } from './fixtures/test';
import { SAMPLE_TICKET } from './fixtures/mock-data';

type PageCase = {
    name: string;
    path: string;
    persona: 'employee' | 'admin' | 'manager';
    heading?: RegExp | string;
    selector?: string;
};

const PAGE_CASES: PageCase[] = [
    { name: 'Главная (hub)', path: '/home', persona: 'employee', selector: '.home-page--hub' },
    { name: 'IT-заявки', path: '/tickets', persona: 'employee', heading: 'IT-заявки' },
    { name: 'Список дел', path: '/todo', persona: 'employee', selector: '.todo-page, .todo-boards-bar' },
    { name: 'Расходы', path: '/expenses', persona: 'employee', selector: '.expenses-shell, .expenses-page' },
    { name: 'Учёт времени', path: '/time-tracking', persona: 'employee', selector: '.time-page' },
    { name: 'График отпусков', path: '/vacation-schedule', persona: 'employee', selector: '.vacation-page, main' },
    { name: 'Корреспонденция', path: '/correspondence', persona: 'employee', selector: '.correspondence-shell, main' },
    { name: 'Kosta Daily', path: '/kosta-daily', persona: 'employee', selector: '.kd-tg' },
    { name: 'Правила', path: '/rules', persona: 'employee', heading: 'Правила' },
    { name: 'Помощь', path: '/help', persona: 'employee', heading: 'Помощь' },
    { name: 'Kosta Legal AI', path: '/kosta-legal-ai', persona: 'employee', heading: /С чего начнём/i },
    { name: 'Деталь тикета', path: `/ticket/${SAMPLE_TICKET.uuid}`, persona: 'employee', selector: 'main' },
    { name: 'Админ-панель', path: '/admin', persona: 'admin', selector: '.admin-page, main' },
    { name: 'Редактирование пользователя', path: '/admin/user/1', persona: 'admin', selector: 'main' },
    { name: 'Посещаемость', path: '/attendance', persona: 'admin', heading: /посещаем/i },
    { name: 'Инвентаризация', path: '/inventory', persona: 'admin', selector: '.inventory-page, main' },
    { name: 'Расписание звонков', path: '/call-schedule', persona: 'admin', selector: '.csched-page, main' },
    { name: 'Бухгалтерия', path: '/accounting', persona: 'admin', heading: /бухгалтер/i },
    { name: 'Контакты', path: '/contacts', persona: 'admin', selector: '.contacts-page, main' },
    { name: 'Заявки на расходы (модерация)', path: '/expenses/requests', persona: 'admin', selector: '.expenses-shell, main' },
    { name: 'Отчёт по расходам', path: '/expenses/report', persona: 'admin', selector: '.expenses-shell, main' },
    { name: 'Новый проект (TT)', path: '/time-tracking/projects/new', persona: 'manager', selector: 'main' },
    { name: 'Превью отчёта (TT)', path: '/time-tracking/reports/preview', persona: 'manager', selector: '.tt-rp-preview' },
    { name: 'Превью счёта (TT)', path: '/time-tracking/invoices/preview', persona: 'manager', selector: 'main' },
    { name: 'Деталь проекта (TT)', path: '/time-tracking/project/demo-project?client=client-1', persona: 'manager', selector: '.pdp, main' },
];

test.describe('Загрузка страниц', () => {
    for (const pageCase of PAGE_CASES) {
        test(`${pageCase.name} (${pageCase.path})`, async ({ page, loginAs }) => {
            await loginAs(pageCase.persona);
            await page.goto(pageCase.path);

            if (pageCase.heading) {
                await expect(page.getByRole('heading', { name: pageCase.heading }).first()).toBeVisible({ timeout: 20_000 });
            }
            else if (pageCase.selector) {
                await expect(page.locator(pageCase.selector).first()).toBeVisible({ timeout: 20_000 });
            }
            else {
                await expect(page.locator('main').first()).toBeVisible({ timeout: 20_000 });
            }
        });
    }
});

test.describe('IT-заявки — содержимое', () => {
    test('отображает тестовый тикет из API', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/tickets');
        await expect(page.locator('.home-tickets__row-title', { hasText: SAMPLE_TICKET.theme })).toBeVisible({ timeout: 20_000 });
    });

    test('кнопка создания тикета доступна сотруднику', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/tickets');
        await expect(page.getByRole('button', { name: /нов/i })).toBeVisible();
    });
});

test.describe('Учёт времени — вкладки', () => {
    test('сотрудник видит только timesheet и expenses', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/time-tracking');
        await expect(page.getByRole('tab', { name: 'Расписание (Время)' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Расходы', exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Отчёты' })).toHaveCount(0);
    });

    test('менеджер видит все вкладки', async ({ page, loginAs }) => {
        await loginAs('manager');
        await page.goto('/time-tracking');
        await expect(page.getByRole('tab', { name: /отчёт/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /статист/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /клиент/i })).toBeVisible();
    });
});

test.describe('Kosta Daily — чат', () => {
    test('отображает список комнат', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/kosta-daily');
        await expect(page.getByText('Общий канал')).toBeVisible({ timeout: 20_000 });
    });
});
