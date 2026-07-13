import { test, expect } from '@playwright/test';

test.describe('@real-backend Gateway smoke', () => {
    test('live endpoint responds', async ({ request }) => {
        const r = await request.get('/live');
        expect(r.status()).toBeLessThan(500);
    });

    test('health endpoint responds', async ({ request }) => {
        const r = await request.get('/health');
        expect(r.status()).toBeLessThan(500);
    });
});
