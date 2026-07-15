import { describe, expect, it } from 'vitest';
import { finalizeBudgetReportRow, type BudgetRow } from './reports';

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
