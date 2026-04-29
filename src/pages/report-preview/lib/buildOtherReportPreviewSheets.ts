import type { BudgetRow, ExpRowCategories, ExpRowClients, ExpRowProjects, ExpRowTeam, RUBBudget, RUBExpense, RUBUninvoiced, UninvoicedRow, } from '@entities/time-tracking';
export type ExpenseGroup = 'clients' | 'projects' | 'categories' | 'team';
export type ExpensePreviewLine = {
    lineKey: string;
    user_name: string;
    total_amount: number;
    billable_amount: number;
};
export type ExpensePreviewSheet = {
    sheetId: string;
    titlePrimary: string;
    titleSecondary: string;
    total_amount: number;
    billable_amount: number;
    currency: string;
    lines: ExpensePreviewLine[];
};
function linesFromExpenseUsers(users: RUBExpense[] | undefined, prefix: string): ExpensePreviewLine[] {
    return (users ?? []).map((u, i) => ({
        lineKey: `${prefix}-${u.user_id}-${i}`,
        user_name: u.user_name,
        total_amount: Number(u.total_amount) || 0,
        billable_amount: Number(u.billable_amount) || 0,
    }));
}
export function buildExpensePreviewSheets(groupBy: ExpenseGroup, rows: ExpRowClients[] | ExpRowProjects[] | ExpRowCategories[] | ExpRowTeam[]): ExpensePreviewSheet[] {
    if (groupBy === 'team') {
        return (rows as ExpRowTeam[]).map((r) => ({
            sheetId: String(r.user_id),
            titlePrimary: r.user_name,
            titleSecondary: r.is_contractor ? 'Подрядчик' : '',
            total_amount: Number(r.total_amount) || 0,
            billable_amount: Number(r.billable_amount) || 0,
            currency: r.currency,
            lines: [
                {
                    lineKey: `t-${r.user_id}`,
                    user_name: r.user_name,
                    total_amount: Number(r.total_amount) || 0,
                    billable_amount: Number(r.billable_amount) || 0,
                },
            ],
        }));
    }
    if (groupBy === 'clients') {
        return (rows as ExpRowClients[]).map((r) => ({
            sheetId: r.client_id,
            titlePrimary: r.client_name,
            titleSecondary: '',
            total_amount: Number(r.total_amount) || 0,
            billable_amount: Number(r.billable_amount) || 0,
            currency: r.currency,
            lines: linesFromExpenseUsers(r.users, r.client_id),
        }));
    }
    if (groupBy === 'categories') {
        return (rows as ExpRowCategories[]).map((r, i) => {
            const sid = r.expense_category_id ?? `cat-${i}`;
            return {
                sheetId: sid,
                titlePrimary: r.expense_category_name || '—',
                titleSecondary: '',
                total_amount: Number(r.total_amount) || 0,
                billable_amount: Number(r.billable_amount) || 0,
                currency: r.currency,
                lines: linesFromExpenseUsers(r.users, sid),
            };
        });
    }
    return (rows as ExpRowProjects[]).map((r) => ({
        sheetId: r.project_id,
        titlePrimary: r.project_name,
        titleSecondary: r.client_name,
        total_amount: Number(r.total_amount) || 0,
        billable_amount: Number(r.billable_amount) || 0,
        currency: r.currency,
        lines: linesFromExpenseUsers(r.users, r.project_id),
    }));
}
export type UninvoicedPreviewSheet = {
    sheetId: string;
    titlePrimary: string;
    titleSecondary: string;
    currency: string;
    total_hours: number;
    uninvoiced_hours: number;
    uninvoiced_amount: number;
    uninvoiced_expenses: number;
    lines: {
        lineKey: string;
        user_name: string;
        uninvoiced_hours: number;
        uninvoiced_amount: number;
    }[];
};
export function buildUninvoicedPreviewSheets(rows: UninvoicedRow[]): UninvoicedPreviewSheet[] {
    return rows.map((r) => ({
        sheetId: r.project_id,
        titlePrimary: r.project_name,
        titleSecondary: r.client_name,
        currency: r.currency,
        total_hours: r.total_hours,
        uninvoiced_hours: r.uninvoiced_hours,
        uninvoiced_amount: r.uninvoiced_amount,
        uninvoiced_expenses: r.uninvoiced_expenses,
        lines: (r.users ?? []).map((u: RUBUninvoiced, i) => ({
            lineKey: `${r.project_id}-${u.user_id}-${i}`,
            user_name: u.user_name,
            uninvoiced_hours: u.uninvoiced_hours,
            uninvoiced_amount: u.uninvoiced_amount,
        })),
    }));
}
export type BudgetPreviewSheet = {
    sheetId: string;
    titlePrimary: string;
    titleSecondary: string;
    budget_by: 'hours' | 'money' | 'hours_and_money';
    budget: number;
    budget_spent: number;
    budget_remaining: number;
    currency: string;
    lines: {
        lineKey: string;
        user_name: string;
        hours_logged: number;
        amount_logged: number;
    }[];
};
export function buildBudgetPreviewSheets(rows: BudgetRow[]): BudgetPreviewSheet[] {
    return rows.map((r) => ({
        sheetId: r.project_id,
        titlePrimary: r.project_name,
        titleSecondary: r.client_name,
        budget_by: r.budget_by,
        budget: r.budget,
        budget_spent: r.budget_spent,
        budget_remaining: r.budget_remaining,
        currency: (r.currency ?? '').trim() || '—',
        lines: (r.users ?? []).map((u: RUBBudget, i) => ({
            lineKey: `${r.project_id}-${u.user_id}-${i}`,
            user_name: u.user_name,
            hours_logged: u.hours_logged,
            amount_logged: u.amount_logged,
        })),
    }));
}
