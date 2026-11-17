import { test, expect } from './fixtures/test';
import type { UserPersona } from './fixtures/users';


type RouteCase = { path: string; persona: UserPersona; expectPath: RegExp };

const CASES: RouteCase[] = [
    { path: '/inventory/qr', persona: 'admin', expectPath: /^\/inventory\/qr$/ },
    { path: '/inventory/tag/INV-001', persona: 'employee', expectPath: /^\/inventory\/tag\/INV-001$/ },
    { path: '/time-tracking/invoices/new', persona: 'partner', expectPath: /^\/time-tracking\/invoices\/new$/ },
    { path: '/time-tracking/invoices/inv-1', persona: 'partner', expectPath: /^\/time-tracking\/invoices\/inv-1$/ },
    { path: '/timesheet', persona: 'employee', expectPath: /^\/home$/ },
    { path: '/expenses/clients', persona: 'admin', expectPath: /^\/expenses\/clients$/ },
    { path: '/expenses/partners', persona: 'admin', expectPath: /^\/expenses\/partners$/ },
    { path: '/expenses/cash', persona: 'partner', expectPath: /^\/expenses\/cash$/ },
    { path: '/expenses/cash', persona: 'employee', expectPath: /^\/expenses$/ },
    { path: '/expenses/corporate-card', persona: 'admin', expectPath: /^\/expenses\/corporate-card$/ },
    { path: '/expenses/partners/report', persona: 'partner', expectPath: /^\/expenses\/partners\/report$/ },
    { path: '/expenses/partners/report', persona: 'employee', expectPath: /^\/expenses$/ },
    { path: '/correspondence/outgoing/new', persona: 'employee', expectPath: /^\/correspondence\/outgoing\/new$/ },
    { path: '/correspondence/outgoing/preview', persona: 'employee', expectPath: /^\/correspondence\/outgoing\/preview$/ },
    { path: '/hr', persona: 'partner', expectPath: /^\/hr$/ },
    { path: '/hr', persona: 'employee', expectPath: /^\/home$/ },
    { path: '/legal-hub', persona: 'partner', expectPath: /^\/legal-hub$/ },
    { path: '/legal-hub/member/1', persona: 'partner', expectPath: /^\/legal-hub\/member\/1$/ },
    { path: '/legal-hub/member/1/reports', persona: 'partner', expectPath: /^\/legal-hub\/member\/1\/reports$/ },
    { path: '/legal-hub/member/1/stats', persona: 'partner', expectPath: /^\/legal-hub\/member\/1\/stats$/ },
    { path: '/files', persona: 'employee', expectPath: /^\/files$/ },
    { path: '/files/explorer', persona: 'admin', expectPath: /^\/home$/ },
    { path: '/internal-communication', persona: 'employee', expectPath: /^\/internal-communication$/ },
    { path: '/it-security', persona: 'employee', expectPath: /^\/home$/ },
];

test.describe('@smoke Остальные маршруты рендерятся без ошибок', () => {
    for (const c of CASES) {
        test(`${c.persona} → ${c.path}`, async ({ page, loginAs }) => {
            const pageErrors: string[] = [];
            page.on('pageerror', (e) => pageErrors.push(e.message));
            await loginAs(c.persona);
            await page.goto(c.path);
            await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).toMatch(c.expectPath);
            await page.waitForLoadState('networkidle').catch(() => { });
            await expect(page.locator('.app-error')).toHaveCount(0);
            await expect.poll(
                () => page.evaluate(() => document.body.innerText.trim().length),
                { timeout: 15_000, message: 'page should render some content' },
            ).toBeGreaterThan(10);
            expect(pageErrors, pageErrors.join('\n')).toEqual([]);
        });
    }
});
