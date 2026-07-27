import { describe, expect, it, vi } from 'vitest';
import {
    buildReportsQs,
    buildReportV2Qs,
    fetchAllPagedReportRows,
    finalizeBudgetReportRow,
    normalizeReportV2Response,
    parseReportHoursField,
    reportV2ListChunkSize,
    type BudgetRow,
    type ReportResponse,
} from './reports';

function row(partial: Record<string, unknown> = {}): BudgetRow {
    return {
        client_id: 'c1',
        client_name: 'Client',
        project_id: 'p1',
        project_name: 'Alpha',
        budget_is_monthly: false,
        budget_by: 'none',
        is_active: true,
        budget: Number.NaN,
        budget_spent: Number.NaN,
        budget_remaining: Number.NaN,
        users: [],
        ...partial,
    } as BudgetRow;
}

describe('finalizeBudgetReportRow', () => {
    it('infers hours axis from nested budget object fields', () => {
        const out = finalizeBudgetReportRow(row({
            budget: {
                budgetHoursBudget: 40,
                budgetHoursSpent: 10,
            },
        }));
        expect(out.budget_by).toBe('hours');
        expect(out.has_budget).toBe(true);
        expect(out.budget_hours_budget).toBe(40);
        expect(out.budget_hours_spent).toBe(10);
    });

    it('infers money axis and hours_and_money when both present', () => {
        const moneyOnly = finalizeBudgetReportRow(row({
            budget_money_budget: 1000,
            budget_money_spent: 250,
        }));
        expect(moneyOnly.budget_by).toBe('money');

        const both = finalizeBudgetReportRow(row({
            budget_hours_budget: 20,
            budget_money_budget: 500,
        }));
        expect(both.budget_by).toBe('hours_and_money');
    });

    it('keeps explicit budget_by', () => {
        expect(finalizeBudgetReportRow(row({ budget_by: 'hours_and_money' })).budget_by).toBe('hours_and_money');
        expect(finalizeBudgetReportRow(row({ budget_by: 'hours' })).budget_by).toBe('hours');
    });
});

describe('report request helpers', () => {
    it('builds stable query strings without empty optional filters', () => {
        const legacy = new URLSearchParams(buildReportsQs({
            reportType: 'time',
            dateFrom: '2026-07-01',
            dateTo: '2026-07-31',
            group: 'projects',
            page: 2,
            pageSize: 100,
            userIds: [2, 1],
            includeFixedFeeProjects: false,
        }));
        expect(legacy.get('from')).toBe('2026-07-01');
        expect(legacy.get('userIds')).toBe('2,1');
        expect(legacy.get('includeFixedFeeProjects')).toBe('false');

        const v2 = new URLSearchParams(buildReportV2Qs({
            dateFrom: '2026-07-01',
            dateTo: '2026-07-31',
            client_id: ' client-1 ',
            project_id: ' ',
            user_id: '1,2',
            is_billable: false,
            include_fixed_fee: false,
            partner_confirmed_only: true,
            page: 3,
            per_page: 10_000,
            pageSizeMax: 2_000,
        }));
        expect(v2.get('client_id')).toBe('client-1');
        expect(v2.has('project_id')).toBe(false);
        expect(v2.get('per_page')).toBe('2000');
        expect(v2.get('partnerConfirmedOnly')).toBe('true');
    });

    it('normalizes pagination aliases and report rows', () => {
        const raw = {
            results: [{
                userId: 7,
                totalHours: '3,5',
                projectBreakdown: [{ workDate: '2026-07-27', hours: '1.25' }],
            }],
            pagination: {
                page: 1,
                perPage: 50,
                totalPages: 2,
                totalEntries: 75,
                nextPage: 2,
                previousPage: null,
            },
            meta: { reportType: 'time', groupBy: 'team', dateFrom: '2026-07-01', dateTo: '2026-07-31' },
            totals: { totalHours: '3.5', billableAmount: '100' },
        } as unknown as ReportResponse<Record<string, unknown>>;

        const normalized = normalizeReportV2Response(raw);
        expect(normalized.pagination).toMatchObject({ per_page: 50, total_pages: 2, next_page: 2 });
        expect(normalized.results[0]).toMatchObject({ user_id: 7, total_hours: 3.5 });
        expect(normalized.totals).toMatchObject({ total_hours: 3.5, billable_amount: 100 });
        expect(parseReportHoursField('1 234,50')).toBe(1234.5);
        expect(reportV2ListChunkSize({ pageSizeMax: 200 })).toBe(200);
        expect(reportV2ListChunkSize({ pageSizeMax: 5_000 })).toBe(500);
    });

    it('stops paginated loading when its consumer aborts', async () => {
        const controller = new AbortController();
        const fetchPage = vi.fn(async () => {
            controller.abort();
            return {
                results: [{ id: 1 }],
                pagination: {
                    page: 1,
                    per_page: 1,
                    total_pages: 2,
                    total_entries: 2,
                    next_page: 2,
                    previous_page: null,
                },
                meta: { report_type: 'time', group_by: null, from: '', to: '', generated_at: '' },
            };
        });

        await expect(fetchAllPagedReportRows(fetchPage, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetchPage).toHaveBeenCalledTimes(1);
    });
});
