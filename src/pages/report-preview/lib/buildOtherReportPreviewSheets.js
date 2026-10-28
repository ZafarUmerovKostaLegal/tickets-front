import { displayReportClientLabel, displayReportProjectLabel, } from '@entities/time-tracking';
function linesFromExpenseUsers(users, prefix) {
    return (users ?? []).map((u, i) => ({
        lineKey: `${prefix}-${u.user_id}-${i}`,
        user_name: u.user_name?.trim() ? u.user_name : `Сотрудник ${u.user_id}`,
        total_amount: Number(u.total_amount) || 0,
        billable_amount: Number(u.billable_amount) || 0,
    }));
}
export function buildExpensePreviewSheets(groupBy, rows) {
    if (groupBy === 'team') {
        return rows.map((r) => ({
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
        return rows.map((r) => ({
            sheetId: r.client_id || `cli-${displayReportClientLabel(r.client_name, r.client_id)}`,
            titlePrimary: displayReportClientLabel(r.client_name, r.client_id),
            titleSecondary: '',
            total_amount: Number(r.total_amount) || 0,
            billable_amount: Number(r.billable_amount) || 0,
            currency: r.currency,
            lines: linesFromExpenseUsers(r.users, r.client_id),
        }));
    }
    if (groupBy === 'categories') {
        return rows.map((r, i) => {
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
    return rows.map((r) => ({
        sheetId: r.project_id || `prj-${displayReportProjectLabel(r.project_name, r.project_id)}`,
        titlePrimary: displayReportProjectLabel(r.project_name, r.project_id),
        titleSecondary: displayReportClientLabel(r.client_name, r.client_id),
        total_amount: Number(r.total_amount) || 0,
        billable_amount: Number(r.billable_amount) || 0,
        currency: r.currency,
        lines: linesFromExpenseUsers(r.users, r.project_id),
    }));
}
export function buildUninvoicedPreviewSheets(rows) {
    return rows.map((r) => ({
        sheetId: r.project_id,
        titlePrimary: r.project_name,
        titleSecondary: r.client_name,
        currency: r.currency,
        total_hours: r.total_hours,
        uninvoiced_hours: r.uninvoiced_hours,
        uninvoiced_amount: r.uninvoiced_amount,
        uninvoiced_expenses: r.uninvoiced_expenses,
        lines: (r.users ?? []).map((u, i) => ({
            lineKey: `${r.project_id}-${u.user_id}-${i}`,
            user_name: u.user_name,
            uninvoiced_hours: u.uninvoiced_hours,
            uninvoiced_amount: u.uninvoiced_amount,
        })),
    }));
}
export function buildBudgetPreviewSheets(rows) {
    return rows.map((r) => ({
        sheetId: r.project_id,
        titlePrimary: r.project_name,
        titleSecondary: r.client_name,
        budget_by: r.budget_by,
        budget: r.budget,
        budget_spent: r.budget_spent,
        budget_remaining: r.budget_remaining,
        currency: (r.currency ?? '').trim() || '—',
        lines: (r.users ?? []).map((u, i) => ({
            lineKey: `${r.project_id}-${u.user_id}-${i}`,
            user_name: u.user_name,
            hours_logged: u.hours_logged,
            amount_logged: u.amount_logged,
        })),
    }));
}
