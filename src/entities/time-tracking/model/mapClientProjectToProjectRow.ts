import type { TimeManagerClientProjectRow, TimeManagerClientRow } from '@entities/time-tracking';
import type { ProjectRow, ProjectStatus, ProjectType } from '@entities/time-tracking/model/types';
function toNum(v: string | number | null | undefined): number | undefined {
    if (v === null || v === undefined || v === '')
        return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}
export function mapClientProjectToProjectRow(p: TimeManagerClientProjectRow, client: TimeManagerClientRow): ProjectRow {
    let type: ProjectType;
    if (p.project_type === 'fixed_fee')
        type = 'Фиксированная ставка';
    else if (p.project_type === 'non_billable')
        type = 'Без бюджета';
    else
        type = 'Время и материалы';
    let budget: number | undefined;
    if (p.project_type === 'fixed_fee') {
        budget = toNum(p.budget_amount) ?? toNum(p.fixed_fee_amount);
    }
    else if (p.budget_type === 'total_project_fees' || p.budget_type === 'money') {
        budget = toNum(p.budget_amount);
    }
    else if (p.budget_type === 'hours_and_money') {
        budget = toNum(p.budget_amount);
    }
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
        spent: 0,
        costs: 0,
        currency: projectCur || clientCur || 'USD',
        status,
        budgetIncludesExpenses: Boolean(p.budget_includes_expenses),
        deletable: Boolean(p.deletable),
    };
}
