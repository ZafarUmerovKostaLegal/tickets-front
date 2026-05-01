import type { TimeManagerClientProjectRow, TimeManagerClientRow } from '@entities/time-tracking';
import type { ProjectRow, ProjectStatus, ProjectType } from '@entities/time-tracking/model/types';
function toNum(v: string | number | null | undefined): number | undefined {
    if (v === null || v === undefined || v === '')
        return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}
function readProjectBudgetValue(p: TimeManagerClientProjectRow, ...keys: string[]): number | undefined {
    const raw = p as Record<string, unknown>;
    for (const key of keys) {
        const v = raw[key];
        const n = toNum(v as string | number | null | undefined);
        if (n !== undefined)
            return n;
    }
    return undefined;
}
function readProjectBudgetBool(p: TimeManagerClientProjectRow, ...keys: string[]): boolean | undefined {
    const raw = p as Record<string, unknown>;
    for (const key of keys) {
        const v = raw[key];
        if (typeof v === 'boolean')
            return v;
        if (typeof v === 'number')
            return v !== 0;
        if (typeof v === 'string') {
            const n = v.trim().toLowerCase();
            if (n === 'true' || n === '1')
                return true;
            if (n === 'false' || n === '0')
                return false;
        }
    }
    return undefined;
}
export function mapClientProjectToProjectRow(p: TimeManagerClientProjectRow, client: TimeManagerClientRow): ProjectRow {
    let type: ProjectType;
    if (p.project_type === 'fixed_fee')
        type = 'Фиксированная ставка';
    else if (p.project_type === 'non_billable')
        type = 'Без бюджета';
    else
        type = 'Время и материалы';
    const budgetDisplay = readProjectBudgetValue(p, 'budgetDisplayValue', 'budget_display_value');
    const budgetSpent = readProjectBudgetValue(p, 'budgetSpentValue', 'budget_spent_value', 'budget_spent', 'budgetSpent');
    const budgetRemaining = readProjectBudgetValue(p, 'budgetRemainingValue', 'budget_remaining_value', 'budget_remaining', 'budgetRemaining');
    const budgetProgress = readProjectBudgetValue(p, 'budgetProgressPercent', 'budget_progress_percent', 'progress_percent', 'progressPercent');
    const loggedHours = readProjectBudgetValue(p, 'loggedHoursValue', 'logged_hours_value', 'hours_logged');
    const hasBudgetConfigured = readProjectBudgetBool(p, 'hasBudgetConfigured', 'has_budget_configured', 'has_budget');
    let budget: number | undefined = budgetDisplay;
    if (p.project_type === 'fixed_fee') {
        budget = budget ?? toNum(p.budget_amount) ?? toNum(p.fixed_fee_amount);
    }
    else if (p.budget_type === 'total_project_fees' || p.budget_type === 'money') {
        budget = budget ?? toNum(p.budget_amount) ?? toNum(p.progress_budget_amount);
    }
    else if (p.budget_type === 'hours_and_money') {
        budget = budget ?? toNum(p.budget_amount) ?? toNum(p.progress_budget_amount);
    }
    if (budget === undefined && p.project_type !== 'fixed_fee') {
        const ba = toNum(p.budget_amount);
        const pb = toNum(p.progress_budget_amount);
        if (ba != null || pb != null)
            budget = ba ?? pb;
    }
    const spent = budgetSpent
        ?? (budget !== undefined && budgetRemaining !== undefined ? Math.max(0, budget - budgetRemaining) : 0);
    const today = new Date().toISOString().slice(0, 10);
    const end = p.end_date?.slice(0, 10);
    const status: ProjectStatus = end && end < today ? 'archived' : 'active';
    const projectCur = (p.currency ?? '').trim();
    const clientCur = (client.currency ?? '').trim();
    return {
        id: p.id,
        name: p.name,
        client: client.name,
        clientId: client.id,
        type,
        budget,
        spent,
        remaining: budgetRemaining,
        progressPercent: budgetProgress,
        loggedHours,
        costs: 0,
        currency: projectCur || clientCur || 'USD',
        status,
        hasBudgetConfigured,
        budgetIncludesExpenses: Boolean(p.budget_includes_expenses),
        deletable: Boolean(p.deletable),
    };
}
