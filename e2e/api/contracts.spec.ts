import { test, expect } from '../fixtures/test';
import { FRONTEND_API_ROUTES } from './api-routes';

test.describe.configure({ mode: 'serial' });

test.describe('@api API route contracts', () => {
    test.beforeEach(async ({ loginAs }) => {
        await loginAs('admin');
    });

    for (const route of FRONTEND_API_ROUTES) {
        test(`${route.method} ${route.path} (${route.module})`, async ({ page }) => {
            const status = await page.evaluate(async ({ path, method }) => {
                const r = await fetch(path, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                });
                return r.status;
            }, { path: route.path, method: route.method });

            expect(status, `${route.method} ${route.path}`).toBeGreaterThanOrEqual(200);
            expect(status, `${route.method} ${route.path}`).toBeLessThan(500);
        });
    }
});
