import { test, expect } from './fixtures/test';
import { installApiMocks, installFailingMe } from './fixtures/api-mock';
import { loginAs, clearAuth, TOKEN } from './fixtures/auth';
import { USERS } from './fixtures/users';
import { SAMPLE_TICKET } from './fixtures/mock-data';

test.describe('Аутентификация @smoke', () => {
    test('страница входа отображается для гостя', async ({ page }) => {
        await clearAuth(page);
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Войти через Microsoft' })).toBeVisible();
        await expect(page.getByText('Добро пожаловать')).toBeVisible();
    });

    test('защищённый маршрут перенаправляет гостя на вход', async ({ page }) => {
        await clearAuth(page);
        await page.goto('/home');
        await expect(page).toHaveURL('/');
    });

    test('авторизованный пользователь на / перенаправляется на /home', async ({ page }) => {
        await loginAs(page, 'employee');
        await page.goto('/');
        await expect(page).toHaveURL(/\/home$/);
    });

    test('OAuth callback с токеном ведёт на /home', async ({ page }) => {
        await installApiMocks(page, { user: USERS.employee });
        await page.goto(`/auth/callback#access_token=${TOKEN}`);
        await expect(page).toHaveURL(/\/home$/);
    });

    test('ошибка auth_failed показывает сообщение на странице входа', async ({ page }) => {
        await clearAuth(page);
        await page.goto('/?error=auth_failed');
        await expect(page.getByRole('alert')).toContainText('Ошибка входа');
    });

    test('заблокированный пользователь перенаправляется на вход', async ({ page }) => {
        await installApiMocks(page, { user: USERS.blocked });
        await page.addInitScript((token) => {
            localStorage.setItem('access_token', token);
        }, TOKEN);
        await page.goto('/home');
        await expect(page).toHaveURL('/');
    });

    test('архивный пользователь перенаправляется на вход', async ({ page }) => {
        await installApiMocks(page, { user: USERS.archived });
        await page.addInitScript((token) => {
            localStorage.setItem('access_token', token);
        }, TOKEN);
        await page.goto('/home');
        await expect(page).toHaveURL('/');
    });

    test('ошибка загрузки профиля при старте показывает экран повтора', async ({ page }) => {
        await installFailingMe(page);
        await page.addInitScript((token) => {
            localStorage.setItem('access_token', token);
        }, TOKEN);
        await page.goto('/home');
        await expect(page.getByRole('button', { name: /повтор/i })).toBeVisible({ timeout: 20_000 });
    });

    test('неизвестный маршрут перенаправляет на /home', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/unknown-route-xyz');
        await expect(page).toHaveURL(/\/home$/);
    });
});

test.describe('Кнопка входа', () => {
    test('кнопка Microsoft инициирует переход на Azure login', async ({ page }) => {
        await clearAuth(page);
        await page.route('**/api/v1/auth/azure/login**', async (route) => {
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Azure login stub</body></html>' });
        });
        await page.goto('/');
        await page.getByRole('button', { name: 'Войти через Microsoft' }).click();
        await expect(page).toHaveURL(/\/api\/v1\/auth\/azure\/login/);
    });
});

test.describe('Детальная страница тикета', () => {
    test('открывается по UUID', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto(`/ticket/${SAMPLE_TICKET.uuid}`);
        await expect(page.locator('.home-page, .ticket-detail-page, main')).toBeVisible();
    });
});
