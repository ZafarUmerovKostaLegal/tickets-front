import type { BudgetRow } from '../api';

/** Лимиты и факт по часам для строки отчёта «Бюджет проектов». */
export function budgetReportHoursMetrics(r: BudgetRow): { budget: number; spent: number; remaining: number } {
    if (r.budget_by === 'none')
        return { budget: 0, spent: 0, remaining: 0 };
    if (r.budget_by === 'hours_and_money') {
        const lim = r.budget_hours_budget;
        if (lim != null && lim > 0)
            return {
                budget: lim,
                spent: r.budget_hours_spent ?? r.budget_spent,
                remaining: r.budget_hours_remaining ?? r.budget_remaining,
            };
        return { budget: r.budget, spent: r.budget_spent, remaining: r.budget_remaining };
    }
    if (r.budget_by === 'hours')
        return { budget: r.budget, spent: r.budget_spent, remaining: r.budget_remaining };
    return { budget: 0, spent: 0, remaining: 0 };
}

/** Лимиты и факт по деньгам для строки отчёта «Бюджет проектов». */
export function budgetReportMoneyMetrics(r: BudgetRow): { budget: number; spent: number; remaining: number } {
    if (r.budget_by === 'none')
        return { budget: 0, spent: 0, remaining: 0 };
    if (r.budget_by === 'hours_and_money') {
        const lim = r.budget_money_budget;
        if (lim != null && lim > 0)
            return {
                budget: lim,
                spent: r.budget_money_spent ?? r.budget_spent,
                remaining: r.budget_money_remaining ?? r.budget_remaining,
            };
        return { budget: r.budget, spent: r.budget_spent, remaining: r.budget_remaining };
    }
    if (r.budget_by === 'money')
        return { budget: r.budget, spent: r.budget_spent, remaining: r.budget_remaining };
    return { budget: 0, spent: 0, remaining: 0 };
}

/** Процент освоения для подсветки строки (в режиме hours_and_money — максимум из двух осей). */
export function budgetReportRowProgressPercent(r: BudgetRow): number {
    if (r.budget_by === 'none' || r.has_budget === false)
        return 0;
    if (r.progress_percent != null && Number.isFinite(r.progress_percent))
        return Math.max(0, Math.round(r.progress_percent));
    const hm = budgetReportMoneyMetrics(r);
    const hh = budgetReportHoursMetrics(r);
    if (r.budget_by === 'hours_and_money') {
        const pM = hm.budget > 0 ? (hm.spent / hm.budget) * 100 : 0;
        const pH = hh.budget > 0 ? (hh.spent / hh.budget) * 100 : 0;
        return Math.round(Math.max(pM, pH));
    }
    const slice = r.budget_by === 'hours' ? hh : hm;
    if (slice.budget <= 0)
        return 0;
    return Math.round((slice.spent / slice.budget) * 100);
}
