import type { Page, Route } from '@playwright/test';
import type { MockUser } from './users';
import {
    CHAT_MESSAGES,
    CHAT_ROOMS,
    DAILY_ATTENDANCE_REPORT,
    EXPENSE_TYPES,
    SAMPLE_TICKET,
    TICKET_PRIORITIES,
    TICKET_STATUSES,
    TODO_BOARD,
    TODO_BOARDS_LIST,
    TT_CLIENT,
    TT_PROJECT,
    WORKDAY_SETTINGS,
} from './mock-data';

export type ApiMockOptions = {
    user: MockUser;
    overrides?: Record<string, unknown>;
};

function json(route: Route, body: unknown, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(body),
    });
}

function emptyList(route: Route) {
    return json(route, []);
}

function emptyObject(route: Route) {
    return json(route, {});
}

function emptyPaged(route: Route) {
    return json(route, { items: [], total: 0, has_more: false });
}

function matchPath(url: URL): string {
    return url.pathname;
}

function resolveOverride(path: string, overrides?: Record<string, unknown>): unknown | undefined {
    if (!overrides)
        return undefined;
    if (path in overrides)
        return overrides[path];
    for (const [key, value] of Object.entries(overrides)) {
        if (key.endsWith('*') && path.startsWith(key.slice(0, -1)))
            return value;
    }
    return undefined;
}

async function handleApiRoute(route: Route, options: ApiMockOptions): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = matchPath(url);
    const method = request.method().toUpperCase();

    if (!path.startsWith('/api/v1/') && !path.startsWith('/cbu-json')) {
        await route.continue();
        return;
    }

    const override = resolveOverride(path, options.overrides);
    if (override !== undefined) {
        await json(route, override);
        return;
    }

    
    if (path === '/api/v1/users/me' && method === 'GET') {
        await json(route, options.user);
        return;
    }
    if (path.startsWith('/api/v1/auth/')) {
        await json(route, { ok: true });
        return;
    }

    
    if (path === '/api/v1/users' && method === 'GET') {
        const url = new URL(route.request().url());
        const limit = url.searchParams.get('limit');
        if (limit != null) {
            await json(route, {
                items: [options.user],
                total: 1,
                skip: Number(url.searchParams.get('skip') || 0),
                limit: Number(limit),
                summary: {
                    total: 1,
                    active: 1,
                    blocked: 0,
                    archived: 0,
                    roles: [{ name: options.user.role || 'Сотрудник', count: 1 }],
                },
            });
            return;
        }
        await json(route, [options.user]);
        return;
    }
    if (path === '/api/v1/users/microsoft' && method === 'GET') {
        await emptyList(route);
        return;
    }
    if (path === '/api/v1/positions' && method === 'GET') {
        await json(route, { positions: ['Юрист', 'Партнёр', 'Сотрудник'] });
        return;
    }
    if (path === '/api/v1/users/partners' || path === '/api/v1/users/public') {
        await json(route, { items: [] });
        return;
    }
    if (path.startsWith('/api/v1/users/') && path.endsWith('/public')) {
        await json(route, options.user);
        return;
    }
    if (/^\/api\/v1\/users\/\d+$/.test(path) && method === 'GET') {
        await json(route, options.user);
        return;
    }

    
    if (path === '/api/v1/tickets/statuses') {
        await json(route, TICKET_STATUSES);
        return;
    }
    if (path === '/api/v1/tickets/priorities') {
        await json(route, TICKET_PRIORITIES);
        return;
    }
    if (path === '/api/v1/tickets' && method === 'GET') {
        await json(route, [SAMPLE_TICKET]);
        return;
    }
    if (path === '/api/v1/tickets' && method === 'POST') {
        await json(route, { ...SAMPLE_TICKET, uuid: 'new-ticket-uuid' }, 201);
        return;
    }
    if (path === `/api/v1/tickets/${SAMPLE_TICKET.uuid}`) {
        await json(route, SAMPLE_TICKET);
        return;
    }
    if (path.startsWith('/api/v1/tickets/') && path.endsWith('/comments')) {
        await emptyList(route);
        return;
    }

    
    if (path.startsWith('/api/v1/notifications')) {
        if (method === 'GET')
            await emptyList(route);
        else
            await json(route, { ok: true });
        return;
    }

    
    if (path === '/api/v1/todos/boards') {
        await json(route, TODO_BOARDS_LIST);
        return;
    }
    if (path === '/api/v1/todos/boards/current' || path === '/api/v1/todos/board' || /^\/api\/v1\/todos\/boards\/\d+$/.test(path)) {
        await json(route, TODO_BOARD);
        return;
    }
    if (path === '/api/v1/todos/calendar/status') {
        await json(route, { connected: false });
        return;
    }
    if (path.startsWith('/api/v1/todos/calendar/')) {
        if (method === 'GET')
            await emptyObject(route);
        else
            await json(route, { ok: true });
        return;
    }
    if (path.startsWith('/api/v1/todos/')) {
        if (method === 'GET')
            await emptyList(route);
        else
            await json(route, TODO_BOARD);
        return;
    }

    
    if (path === '/api/v1/chat/rooms') {
        await json(route, CHAT_ROOMS);
        return;
    }
    if (path.startsWith('/api/v1/chat/rooms/') && path.endsWith('/messages')) {
        await json(route, CHAT_MESSAGES);
        return;
    }
    if (path.startsWith('/api/v1/chat/')) {
        if (method === 'GET')
            await emptyObject(route);
        else
            await json(route, { id: 1, ok: true });
        return;
    }

    
    if (path === '/api/v1/expense-types') {
        await json(route, EXPENSE_TYPES);
        return;
    }
    if (path.startsWith('/api/v1/exchange-rates')) {
        await json(route, { date: '2024-06-01', rates: { USD: 12500, EUR: 13500 } });
        return;
    }
    if (path === '/api/v1/time-tracking/invoices/fx-rates/ensure' && method === 'POST') {
        await json(route, { ok: true, dates: ['2026-07-30'], currency: 'UZS' });
        return;
    }
    if (path.startsWith('/api/v1/expenses')) {
        if (method === 'GET')
            await emptyList(route);
        else
            await json(route, { id: 'exp-1', status: 'draft' });
        return;
    }

    
    if (path.startsWith('/api/v1/time-tracking/')) {
        if (path === '/api/v1/time-tracking/clients' && method === 'GET') {
            await json(route, [TT_CLIENT]);
            return;
        }
        if (path.match(/^\/api\/v1\/time-tracking\/clients\/[^/]+$/) && method === 'GET') {
            await json(route, TT_CLIENT);
            return;
        }
        if (path.match(/^\/api\/v1\/time-tracking\/clients\/[^/]+\/projects\/[^/]+$/) && method === 'GET') {
            await json(route, TT_PROJECT);
            return;
        }
        if (path.includes('/projects') && method === 'GET') {
            await json(route, [TT_PROJECT]);
            return;
        }
        if (path.includes('/reports/meta')) {
            await json(route, { pageSizeMax: 500, currencies: ['USD'] });
            return;
        }
        if (path.includes('/reports') || path.includes('/statistics') || path.includes('/invoices')) {
            await emptyPaged(route);
            return;
        }
        if (path.includes('/clients') || path.includes('/users')) {
            if (method === 'GET')
                await emptyList(route);
            else
                await json(route, { ok: true });
            return;
        }
        if (path.includes('/time-entries') || path.includes('/entries')) {
            await emptyList(route);
            return;
        }
        if (path.includes('/team-workload')) {
            await json(route, { members: [], totals: {} });
            return;
        }
        if (path.includes('/dashboard')) {
            await json(route, { budget: null, spent: 0 });
            return;
        }
        if (method === 'GET')
            await emptyObject(route);
        else
            await json(route, { ok: true });
        return;
    }

    
    if (path.startsWith('/api/v1/vacations/')) {
        if (path.includes('employees') && method === 'GET')
            await json(route, { items: [], year: new Date().getFullYear() });
        else if (method === 'GET')
            await emptyList(route);
        else
            await json(route, { ok: true });
        return;
    }

    
    if (path.startsWith('/api/v1/attendance/')) {
        if (path.includes('report/daily'))
            await json(route, DAILY_ATTENDANCE_REPORT);
        else if (path.includes('workday'))
            await json(route, WORKDAY_SETTINGS);
        else if (path.includes('report/range'))
            await json(route, { items: [], summary: DAILY_ATTENDANCE_REPORT.summary });
        else if (method === 'GET')
            await json(route, []);
        else
            await json(route, { ok: true });
        return;
    }

    
    if (path.startsWith('/api/v1/inventory')) {
        if (method === 'GET' && path === '/api/v1/inventory/items') {
            await json(route, {
                items: [],
                total: 0,
                skip: 0,
                limit: 24,
                in_use_count: 0,
                in_stock_count: 0,
                archived_count: 0,
            });
            return;
        }
        if (method === 'GET')
            await emptyList(route);
        else
            await json(route, { id: 1 });
        return;
    }

    
    if (path.startsWith('/api/v1/contacts')) {
        await emptyList(route);
        return;
    }

    
    if (path === '/api/v1/correspondence/stats') {
        await json(route, { incomingTotal: 0, outgoingTotal: 0, approvalTotal: 0, incomingNewTotal: 0 });
        return;
    }
    if (path.startsWith('/api/v1/correspondence')) {
        if (method === 'GET')
            await json(route, { items: [], total: 0, skip: 0, limit: 8 });
        else
            await json(route, { id: '1' });
        return;
    }

    
    if (path.startsWith('/api/v1/call-schedule/')) {
        if (path.endsWith('/calendars'))
            await json(route, { mailbox: 'info@kostalegal.com', calendars: [{ id: 'primary', name: 'Календарь' }] });
        else if (path.includes('/files-counts'))
            await json(route, { counts: {} });
        else if (/\/days\/[^/]+\/files\/[^/]+\/file$/.test(path) && method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/pdf',
                body: Buffer.from('%PDF-demo'),
                headers: { 'Content-Disposition': 'attachment; filename="brief.pdf"' },
            });
        }
        else if (/\/days\/[^/]+\/files$/.test(path) && method === 'GET')
            await json(route, []);
        else if (/\/days\/[^/]+\/files$/.test(path) && method === 'POST') {
            await json(route, {
                id: 'file-1',
                day: '2026-08-03',
                originalName: 'brief.pdf',
                contentType: 'application/pdf',
                sizeBytes: 9,
                uploadedByUserId: 1,
                uploadedAt: new Date().toISOString(),
            });
        }
        else if (path.includes('/events'))
            await json(route, { events: [] });
        else
            await json(route, { ok: true });
        return;
    }

    
    if (path.startsWith('/api/v1/media/')) {
        await route.fulfill({ status: 404, body: 'not found' });
        return;
    }

    
    if (path.startsWith('/cbu-json')) {
        await json(route, [{ Ccy: 'USD', Rate: '12500', Date: '2024-06-01' }]);
        return;
    }

    
    if (method === 'GET')
        await emptyList(route);
    else
        await json(route, { ok: true });
}

export async function installApiMocks(page: Page, options: ApiMockOptions): Promise<void> {
    await page.unroute('**/api/v1/**').catch(() => {});
    await page.unroute('**/cbu-json/**').catch(() => {});

    await page.route('**/api/v1/**', (route) => handleApiRoute(route, options));
    await page.route('**/cbu-json/**', (route) => handleApiRoute(route, options));

    await page.routeWebSocket(/\/api\/v1\/.*\/ws/, (ws) => {
        ws.onMessage(() => {
            
        });
    });
}

export async function installFailingMe(page: Page): Promise<void> {
    await page.route('**/api/v1/users/me', (route) =>
        route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Service unavailable' }) }),
    );
}
