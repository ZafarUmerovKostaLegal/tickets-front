import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock, listProjectsMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
    listProjectsMock: vi.fn(),
}));

vi.mock('@shared/api', () => ({ apiFetch: apiFetchMock }));
vi.mock('@entities/time-tracking', () => ({ listProjectsForExpenses: listProjectsMock }));

import {
    fetchApprovalRoutingMeta,
    fetchExchangeRate,
    fetchExpenseTypes,
    fetchExpenses,
    fetchProjects,
} from './expensesApi';

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('expenses API request policies', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
        listProjectsMock.mockReset();
    });

    it('reuses reference data through query caches', async () => {
        apiFetchMock.mockImplementation((path: string) => {
            if (path === '/api/v1/expense-types')
                return Promise.resolve(json([{ id: 1, name: 'Travel' }]));
            if (path.startsWith('/api/v1/exchange-rates'))
                return Promise.resolve(json({ date: '2026-07-27', rate: 12_500, pairLabel: 'USD/UZS' }));
            return Promise.resolve(json({ lowLimitUzs: 100, lowTierEnabled: true, hardAmountLimitUzs: 1_000 }));
        });

        await fetchExpenseTypes();
        await fetchExpenseTypes();
        await fetchExchangeRate('2026-07-27T12:00:00');
        await fetchExchangeRate('2026-07-27');
        await fetchApprovalRoutingMeta();
        await fetchApprovalRoutingMeta();

        expect(apiFetchMock).toHaveBeenCalledTimes(3);
    });

    it('builds a paginated filtered list request with cancellation support', async () => {
        apiFetchMock.mockResolvedValue(json({
            items: [],
            total: 0,
            skip: 20,
            limit: 20,
            total_amount_uzs: '1 250,5',
            total_equivalent_amount: 100,
        }));
        const controller = new AbortController();

        await expect(fetchExpenses({
            status: 'draft',
            q: ' taxi ',
            skip: 20,
            limit: 20,
            projectId: ' project-1 ',
        }, { signal: controller.signal })).resolves.toMatchObject({
            totalAmountUzs: 1250.5,
            totalEquivalentAmount: 100,
        });

        const [path, init] = apiFetchMock.mock.calls[0];
        expect(path).toContain('status=draft');
        expect(path).toContain('q=+taxi+');
        expect(path).toContain('projectId=project-1');
        expect(init).toMatchObject({ signal: controller.signal, getReuseWindowMs: 2_000 });
    });

    it('filters archived projects from the expense picker', async () => {
        listProjectsMock.mockResolvedValue([
            { id: 'active', name: 'Active', isArchived: false },
            { id: 'archived', name: 'Archived', isArchived: true },
        ]);
        await expect(fetchProjects()).resolves.toEqual([{ id: 'active', name: 'Active' }]);
    });
});
