import { test, expect } from './fixtures/test';

const EMPLOYEE_VISIBLE_NAV = [
    'Учёт времени',
    'Расходы',
    'Список дел',
    'IT-заявки',
    'Корреспонденция',
    'Kosta Daily',
    'График отпусков',
    'Правила',
    'Помощь',
    'Kosta Legal AI',
];

const EMPLOYEE_HIDDEN_NAV = [
    'Инвентаризация',
    'Админ-панель',
    'Посещаемость',
    'Расписание звонков',
    'Бухгалтерия',
    'Контакты',
    'Сетевой диск',
];

const ADMIN_EXTRA_NAV = [
    'Инвентаризация',
    'Админ-панель',
    'Посещаемость',
    'Расписание звонков',
    'Бухгалтерия',
    'Контакты',
];

test.describe('Навигация сотрудника', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    for (const label of EMPLOYEE_VISIBLE_NAV) {
        test(`видит пункт «${label}»`, async ({ page }) => {
            await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible();
        });
    }

    for (const label of EMPLOYEE_HIDDEN_NAV) {
        test(`не видит пункт «${label}»`, async ({ page }) => {
            await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
        });
    }
});

test.describe('Навигация администратора', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('admin');
    });

    for (const label of ADMIN_EXTRA_NAV) {
        test(`видит пункт «${label}»`, async ({ page }) => {
            await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible();
        });
    }
});

test.describe('Навигация без учёта времени', () => {
    test('скрывает раздел «Учёт времени»', async ({ page, loginAs }) => {
        await loginAs('noTimeTracking');
        await expect(page.getByRole('link', { name: 'Учёт времени', exact: true })).toHaveCount(0);
    });
});

test.describe('Переходы по навигации', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('employee');
    });

    const navTargets: Array<{ label: string; path: RegExp }> = [
        { label: 'IT-заявки', path: /\/tickets$/ },
        { label: 'Список дел', path: /\/todo$/ },
        { label: 'Расходы', path: /\/expenses$/ },
        { label: 'Kosta Daily', path: /\/kosta-daily$/ },
        { label: 'График отпусков', path: /\/vacation-schedule$/ },
        { label: 'Правила', path: /\/rules$/ },
        { label: 'Помощь', path: /\/help$/ },
    ];

    for (const { label, path } of navTargets) {
        test(`клик «${label}» открывает ${path}`, async ({ page }) => {
            await page.getByRole('link', { name: label, exact: true }).first().click();
            await expect(page).toHaveURL(path);
        });
    }
});

test.describe('Hub-плитки', () => {
    test('отображают подсказку о перетаскивании', async ({ page, loginAs }) => {
        await loginAs('employee');
        await expect(page.getByText(/Перетащите плитку/)).toBeVisible();
    });
});
