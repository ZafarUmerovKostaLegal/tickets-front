import { test, expect } from '../fixtures/test';
import { SAMPLE_TICKET } from '../fixtures/mock-data';
import { getExpensesOpenUrl, getTicketDetailUrl, getUserEditUrl } from '../../src/shared/config/routes';

test.describe('Deep links @flows', () => {
    test('getTicketDetailUrl открывает деталь тикета', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto(getTicketDetailUrl(SAMPLE_TICKET.uuid));
        await expect(page).toHaveURL(new RegExp(`/ticket/${SAMPLE_TICKET.uuid}$`));
        await expect(page.locator('main').first()).toBeVisible();
    });

    test('getExpensesOpenUrl открывает расход', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto(getExpensesOpenUrl('exp-draft-1'));
        await expect(page).toHaveURL(/\/expenses\/exp-draft-1$/);
    });

    test('getUserEditUrl доступен админу', async ({ page, loginAs }) => {
        await loginAs('admin');
        await page.goto(getUserEditUrl(1));
        await expect(page).toHaveURL(/\/admin\/user\/1$/);
    });

    test('time-tracking с tab=expenses открывает вкладку расходов', async ({ page, loginAs }) => {
        await loginAs('employee');
        await page.goto('/time-tracking?tab=expenses');
        await expect(page).toHaveURL(/tab=expenses/);
        await expect(page.getByRole('tab', { name: 'Расходы', exact: true })).toHaveAttribute('aria-selected', 'true');
    });
});
