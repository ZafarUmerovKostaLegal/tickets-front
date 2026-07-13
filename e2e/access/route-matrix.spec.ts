import { test, expect } from '../fixtures/test';
import { ROUTE_ACCESS_MATRIX } from '../helpers/access-matrix';

test.describe('Матрица доступа ко всем маршрутам @access', () => {
    for (const { path, persona, expectUrl, tag } of ROUTE_ACCESS_MATRIX) {
        const title = `${persona} → ${path}`;
        const opts = tag ? { tag } : {};
        test(title, opts, async ({ page, loginAs }) => {
            await loginAs(persona);
            await page.goto(path);
            await expect(page).toHaveURL(expectUrl, { timeout: 20_000 });
        });
    }
});
