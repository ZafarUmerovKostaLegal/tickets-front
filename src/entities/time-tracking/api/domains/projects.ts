import { apiFetch } from '@shared/api';
import {
    getTimeTrackingCached,
    setTimeTrackingCached,
    invalidateTimeTrackingListCache,
} from '../../lib/timeTrackingListCache';
import { isActiveTimeManagerProjectRow } from '../../lib/projectTimeEntry';
import {
    type PaginatedResult,
    type TimeTrackingPaginationParams,
    parseTimeTrackingPagedResponse,
    unwrapTimeTrackingListArray,
    throwIfNotOk,
    dashNum,
} from './httpShared';

export type TimeManagerClientTaskRow = {
    id: string;

    project_id: string;
    name: string;
    default_billable_rate: string | number | null;
    billable_by_default: boolean;
    billing_mode: 'hourly' | 'flat_fee';
    flat_fee_amount: string | number | null;
    flat_fee_currency: string | null;
    created_at: string;
    updated_at: string | null;
};
export type TimeManagerClientTaskCreatePayload = {
    name: string;
    defaultBillableRate?: number | null;
    billableByDefault?: boolean;
    billingMode?: 'hourly' | 'flat_fee';
    flatFeeAmount?: number | null;
    flatFeeCurrency?: string | null;
};
export type TimeManagerClientTaskPatchPayload = {
    name?: string;
    defaultBillableRate?: number | null;
    billableByDefault?: boolean;
    billingMode?: 'hourly' | 'flat_fee';
    flatFeeAmount?: number | null;
    flatFeeCurrency?: string | null;
};
export function normalizeTimeManagerProjectTask(raw: unknown): TimeManagerClientTaskRow {
    const r = raw as Record<string, unknown>;
    const projectIdRaw = r.project_id ?? r.projectId;
    const modeRaw = String(r.billing_mode ?? r.billingMode ?? 'hourly').trim().toLowerCase();
    const billingMode: 'hourly' | 'flat_fee' = modeRaw === 'flat_fee' || modeRaw === 'flat' || modeRaw === 'fixed' || modeRaw === 'fixed_fee'
        ? 'flat_fee'
        : 'hourly';
    return {
        id: String(r.id ?? ''),
        project_id: String(projectIdRaw ?? ''),
        name: String(r.name ?? ''),
        default_billable_rate: (r.default_billable_rate ?? r.defaultBillableRate ?? null) as string | number | null,
        billable_by_default: Boolean(r.billable_by_default ?? r.billableByDefault),
        billing_mode: billingMode,
        flat_fee_amount: (r.flat_fee_amount ?? r.flatFeeAmount ?? null) as string | number | null,
        flat_fee_currency: r.flat_fee_currency != null || r.flatFeeCurrency != null
            ? String(r.flat_fee_currency ?? r.flatFeeCurrency)
            : null,
        created_at: String(r.created_at ?? r.createdAt ?? ''),
        updated_at: r.updated_at != null
            ? String(r.updated_at)
            : r.updatedAt != null
                ? String(r.updatedAt)
                : null,
    };
}
export function projectTasksCollectionPath(clientId: string, projectId: string): string {
    return `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/tasks`;
}

export async function listProjectTasks(clientId: string, projectId: string): Promise<TimeManagerClientTaskRow[]> {
    const res = await apiFetch(projectTasksCollectionPath(clientId, projectId));
    await throwIfNotOk(res);
    const body = await res.json();
    if (!Array.isArray(body))
        return [];
    return body.map(normalizeTimeManagerProjectTask);
}
export async function getProjectTask(clientId: string, projectId: string, taskId: string): Promise<TimeManagerClientTaskRow> {
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`);
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function createProjectTask(clientId: string, projectId: string, body: TimeManagerClientTaskCreatePayload): Promise<TimeManagerClientTaskRow> {
    const res = await apiFetch(projectTasksCollectionPath(clientId, projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: body.name,
            defaultBillableRate: body.defaultBillableRate ?? null,
            billableByDefault: body.billableByDefault ?? true,
            billingMode: body.billingMode ?? 'hourly',
            flatFeeAmount: body.flatFeeAmount ?? null,
            flatFeeCurrency: body.flatFeeCurrency ?? null,
        }),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function patchProjectTask(clientId: string, projectId: string, taskId: string, patch: TimeManagerClientTaskPatchPayload): Promise<TimeManagerClientTaskRow> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name;
    if (patch.defaultBillableRate !== undefined)
        payload.defaultBillableRate = patch.defaultBillableRate;
    if (patch.billableByDefault !== undefined)
        payload.billableByDefault = patch.billableByDefault;
    if (patch.billingMode !== undefined)
        payload.billingMode = patch.billingMode;
    if (patch.flatFeeAmount !== undefined)
        payload.flatFeeAmount = patch.flatFeeAmount;
    if (patch.flatFeeCurrency !== undefined)
        payload.flatFeeCurrency = patch.flatFeeCurrency;
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function deleteProjectTask(clientId: string, projectId: string, taskId: string): Promise<void> {
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}

export type TimeTrackingProjectForExpense = {
    id: string;
    name: string;
    code: string | null;
    clientId: string;
    clientName: string;
    isArchived: boolean;
    isPaused?: boolean;
    
    currency?: string | null;
    recordsLanguage?: TimeManagerProjectRecordsLanguage;
    projectType?: string | null;
    endDate?: string | null;
};
export function normalizeProjectForExpense(raw: Record<string, unknown>): TimeTrackingProjectForExpense | null {
    const id = raw.id != null ? String(raw.id).trim() : '';
    if (!id)
        return null;
    const codeRaw = raw.code;
    const codeStr = codeRaw == null || codeRaw === '' ? '' : String(codeRaw).trim();
    const curRaw = raw.currency ?? raw.projectCurrency ?? raw.project_currency;
    const cur = curRaw != null && String(curRaw).trim() ? String(curRaw).trim().toUpperCase() : null;
    const pt = raw.projectType ?? raw.project_type;
    const end = raw.endDate ?? raw.end_date;
    const endStr = end != null && String(end).trim() ? String(end).trim().slice(0, 10) : null;
    const rlRaw = raw.recordsLanguage ?? raw.records_language;
    const rl = String(rlRaw ?? 'ENG').trim().toUpperCase();
    const recordsLanguage: TimeManagerProjectRecordsLanguage = rl === 'RU' ? 'RU' : 'ENG';
    const today = new Date().toISOString().slice(0, 10);
    const statusRaw = String(raw.status ?? '').trim().toLowerCase();
    const statusArchived = statusRaw === 'archived';
    const statusPaused = statusRaw === 'paused';
    const flaggedArchived = raw.isArchived === true || raw.is_archived === true || statusArchived;
    const flaggedPaused = raw.isPaused === true || raw.is_paused === true || statusPaused;
    const endDateArchived = Boolean(endStr && endStr < today);
    return {
        id,
        name: String(raw.name ?? '').trim() || '—',
        code: codeStr || null,
        clientId: String(raw.clientId ?? raw.client_id ?? '').trim(),
        clientName: String(raw.clientName ?? raw.client_name ?? '').trim() || '—',
        isArchived: flaggedArchived || endDateArchived,
        isPaused: flaggedPaused && !(flaggedArchived || endDateArchived),
        currency: cur,
        recordsLanguage,
        projectType: pt != null && String(pt).trim() ? String(pt).trim() : null,
        endDate: endStr,
    };
}
export function filterActiveProjectsForExpenses(rows: TimeTrackingProjectForExpense[], includeArchived?: boolean): TimeTrackingProjectForExpense[] {
    if (includeArchived)
        return rows;
    return rows.filter((p) => !p.isArchived && !p.isPaused);
}
export async function listProjectsForExpenses(options?: {
    includeArchived?: boolean;
}): Promise<TimeTrackingProjectForExpense[]>;
export async function listProjectsForExpenses(options: {
    includeArchived?: boolean;
} & TimeTrackingPaginationParams): Promise<PaginatedResult<TimeTrackingProjectForExpense>>;
export async function listProjectsForExpenses(options?: {
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
}): Promise<TimeTrackingProjectForExpense[] | PaginatedResult<TimeTrackingProjectForExpense>> {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    if (options?.limit != null) {
        qs.set('limit', String(options.limit));
        qs.set('offset', String(options.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/projects-for-expenses${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (options?.limit != null) {
        const off = options.offset ?? 0;
        const page = parseTimeTrackingPagedResponse(raw, (item) => {
            if (!item || typeof item !== 'object')
                return null;
            return normalizeProjectForExpense(item as Record<string, unknown>);
        }, { limit: options.limit, offset: off });
        return {
            ...page,
            items: filterActiveProjectsForExpenses(page.items, options?.includeArchived),
        };
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    const out: TimeTrackingProjectForExpense[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const row = normalizeProjectForExpense(item as Record<string, unknown>);
        if (row)
            out.push(row);
    }
    return filterActiveProjectsForExpenses(out, options?.includeArchived);
}
export type ProjectExpenseCategoryRow = {
    id: string;
    name: string;
    hasUnitPrice: boolean;
    isArchived: boolean;
};
export function normalizeProjectExpenseCategory(raw: Record<string, unknown>): ProjectExpenseCategoryRow | null {
    const id = raw.id != null ? String(raw.id).trim() : '';
    if (!id)
        return null;
    return {
        id,
        name: String(raw.name ?? '').trim() || '—',
        hasUnitPrice: raw.hasUnitPrice === true || raw.has_unit_price === true,
        isArchived: raw.isArchived === true || raw.is_archived === true,
    };
}
export async function listProjectExpenseCategories(projectId: string, options?: {
    includeArchived?: boolean;
}): Promise<ProjectExpenseCategoryRow[]> {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/projects/${encodeURIComponent(projectId)}/expense-categories${suffix}`);
    await throwIfNotOk(res);
    const arr = (await res.json()) as unknown[];
    if (!Array.isArray(arr))
        return [];
    const out: ProjectExpenseCategoryRow[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const row = normalizeProjectExpenseCategory(item as Record<string, unknown>);
        if (row)
            out.push(row);
    }
    return out;
}
export type TimeManagerProjectCurrency = 'USD' | 'UZS' | 'EUR' | 'RUB' | 'GBP';

export const TIME_TRACKING_PROJECT_CURRENCIES: readonly TimeManagerProjectCurrency[] = ['USD', 'UZS', 'EUR', 'RUB', 'GBP'];
export type TimeManagerProjectRecordsLanguage = 'RU' | 'ENG';
export const TIME_TRACKING_PROJECT_RECORDS_LANGUAGES: readonly TimeManagerProjectRecordsLanguage[] = ['ENG', 'RU'];
export type TimeManagerClientProjectRow = {
    id: string;
    client_id: string;
    name: string;
    code: string | null;
    currency?: string | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    report_visibility: string;
    records_language?: string | null;
    project_type: string;
    billable_rate_type: string | null;
    
    project_billable_rate_amount?: string | number | null;
    budget_type: string | null;
    budget_amount: string | number | null;

    progress_budget_amount?: string | number | null;
    budget_hours: string | number | null;
    budget_resets_every_month: boolean;
    budget_includes_expenses: boolean;
    send_budget_alerts: boolean;
    budget_alert_threshold_percent: string | number | null;
    fixed_fee_amount: string | number | null;
    package_hours_per_month?: string | number | null;
    package_fee_amount?: string | number | null;
    packageHoursPerMonth?: string | number | null;
    packageFeeAmount?: string | number | null;
    usage_count: number;
    deletable: boolean;
    created_at: string;
    updated_at: string | null;

    budgetDisplayValue?: string | number | null;
    budgetSpentValue?: string | number | null;
    budgetRemainingValue?: string | number | null;
    budgetProgressPercent?: string | number | null;
    loggedHoursValue?: string | number | null;
    hasBudgetConfigured?: boolean | null;

    budget_display_value?: string | number | null;
    budget_spent_value?: string | number | null;
    budget_remaining_value?: string | number | null;
    budget_progress_percent?: string | number | null;
    logged_hours_value?: string | number | null;
    has_budget_configured?: boolean | null;
    partnerAuthUserIds?: number[];
    participantAuthUserIds?: number[];
    partner_auth_user_ids?: number[];
    participant_auth_user_ids?: number[];
    is_archived?: boolean;
    isArchived?: boolean;
    is_paused?: boolean;
    isPaused?: boolean;
};

/** API may return `recordsLanguage` (alias) or `records_language`. */
export function readProjectRecordsLanguage(
    row: TimeManagerClientProjectRow | Record<string, unknown> | null | undefined,
): TimeManagerProjectRecordsLanguage {
    if (!row || typeof row !== 'object')
        return 'ENG';
    const raw = row as Record<string, unknown>;
    const v = String(raw.records_language ?? raw.recordsLanguage ?? 'ENG').trim().toUpperCase();
    return v === 'RU' ? 'RU' : 'ENG';
}

/** Normalize mixed camelCase/snake_case project payloads from the API. */
export function normalizeTimeManagerClientProjectRow(raw: unknown): TimeManagerClientProjectRow | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = String(o.id ?? '').trim();
    const clientId = String(o.client_id ?? o.clientId ?? '').trim();
    if (!id || !clientId)
        return null;
    const row = { ...o } as TimeManagerClientProjectRow;
    row.id = id;
    row.client_id = clientId;
    row.records_language = readProjectRecordsLanguage(o);
    if (o.clientId != null && row.client_id)
        (row as Record<string, unknown>).clientId = row.client_id;
    return row;
}

export function readTimeManagerProjectBillableRateAmount(row: TimeManagerClientProjectRow & { projectBillableRateAmount?: string | number | null }): string {
    const raw = row.project_billable_rate_amount ?? row.projectBillableRateAmount;
    if (raw == null || String(raw).trim() === '')
        return '';
    return String(raw);
}
export type TimeManagerProjectDashboardTotals = {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    internalCostAmount: number;
    internalCostsComplete: boolean;
    unbilledAmount: number;
    expenseAmountUzs: number;

    expenseEquivalentTotal: number;

    expenseAmountProject?: number;
    expenseCount: number;
};
export type TimeManagerProjectDashboardProgressWeek = {
    weekStart: string;
    cumulativeBillableAmount: number;
};
export type TimeManagerProjectDashboardHoursWeek = {
    weekStart: string;
    hours: number;
    billableHours?: number;
    nonBillableHours?: number;
};
export type TimeManagerProjectDashboardTaskMember = {
    userId: string;
    name: string;
    hours: number;
    billableAmount: number;
    internalCostAmount: number;
};
export type TimeManagerProjectDashboardTask = {
    taskId: string;
    name: string;
    billable: boolean;
    hours: number;
    billableAmount: number;
    internalCostAmount: number;
    members?: TimeManagerProjectDashboardTaskMember[];
};
export type TimeManagerProjectDashboardTeamMember = {
    userId: string;
    name: string;
    hours: number;
    billableHours?: number;
    nonBillableHours?: number;
    billableAmount?: number;
    internalCostAmount?: number;
};
export type TimeManagerProjectDashboardInvoice = {
    id: string;
    issuedAt?: string;
    amount: number;
    currency: string;
    status?: string;
};

export type TimeManagerProjectDashboardBudgetSlice = {
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number | null;
};

export type TimeManagerProjectDashboardBudget = {
    hasBudget: boolean;
    budgetBy: 'none' | 'money' | 'hours' | 'hours_and_money';
    currency: string;
    
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number | null;
    
    money?: TimeManagerProjectDashboardBudgetSlice;
    hours?: TimeManagerProjectDashboardBudgetSlice;
    percentUsedMoney?: number | null;
    percentUsedHours?: number | null;
};
export type TimeManagerProjectDashboard = {
    currency?: string;
    totals: TimeManagerProjectDashboardTotals;
    progressByWeek: TimeManagerProjectDashboardProgressWeek[];
    hoursByWeek: TimeManagerProjectDashboardHoursWeek[];
    tasks: TimeManagerProjectDashboardTask[];
    team: TimeManagerProjectDashboardTeamMember[];
    invoices: TimeManagerProjectDashboardInvoice[];
    budget?: TimeManagerProjectDashboardBudget | null;
};
export function dashStr(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
export function dashBool(v: unknown, fallback: boolean): boolean {
    if (typeof v === 'boolean')
        return v;
    return fallback;
}
export function normalizeProjectDashboard(raw: unknown): TimeManagerProjectDashboard {
    const emptyTotals: TimeManagerProjectDashboardTotals = {
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        billableAmount: 0,
        internalCostAmount: 0,
        internalCostsComplete: true,
        unbilledAmount: 0,
        expenseAmountUzs: 0,
        expenseEquivalentTotal: 0,
        expenseCount: 0,
    };
    if (!raw || typeof raw !== 'object') {
        return {
            totals: emptyTotals,
            progressByWeek: [],
            hoursByWeek: [],
            tasks: [],
            team: [],
            invoices: [],
        };
    }
    const o = raw as Record<string, unknown>;
    const tr = (o.totals && typeof o.totals === 'object' ? o.totals : {}) as Record<string, unknown>;
    const expenseAmountUzs = dashNum(tr.expense_amount_uzs ?? tr.expenseAmountUzs);
    const uzsRaw = tr.expense_amount_uzs ?? tr.expenseAmountUzs;
    const hasExplicitUzs = uzsRaw != null && String(uzsRaw).trim() !== '';
    const pickEquivFromTotals = (): number | undefined => {
        const keys = [
            'expense_equivalent_total',
            'expenseEquivalentTotal',
            'total_equivalent_amount',
            'totalEquivalentAmount',
            'expense_amount_project',
            'expenseAmountProject',
            'expense_amount_in_project',
            'expenseAmountInProject',
        ] as const;
        for (const k of keys) {
            const v = tr[k];
            if (v != null && String(v).trim() !== '') {
                const n = dashNum(v);
                if (Number.isFinite(n))
                    return n;
            }
        }
        const uni = tr.expense_amount ?? tr.expenseAmount;
        if (!hasExplicitUzs && uni != null && String(uni).trim() !== '') {
            const n = dashNum(uni);
            if (Number.isFinite(n))
                return n;
        }
        return undefined;
    };
    const equivResolved = pickEquivFromTotals();
    const expenseEquivalentTotal = equivResolved ?? 0;
    const totals: TimeManagerProjectDashboardTotals = {
        totalHours: dashNum(tr.total_hours ?? tr.totalHours),
        billableHours: dashNum(tr.billable_hours ?? tr.billableHours),
        nonBillableHours: dashNum(tr.non_billable_hours ?? tr.nonBillableHours),
        billableAmount: dashNum(tr.billable_amount ?? tr.billableAmount),
        internalCostAmount: dashNum(tr.internal_cost_amount ?? tr.internalCostAmount),
        internalCostsComplete: dashBool(tr.internal_costs_complete ?? tr.internalCostsComplete, true),
        unbilledAmount: dashNum(tr.unbilled_amount ?? tr.unbilledAmount),
        expenseAmountUzs,
        expenseEquivalentTotal,
        expenseAmountProject: expenseEquivalentTotal,
        expenseCount: Math.round(dashNum(tr.expense_count ?? tr.expenseCount)),
    };
    const progressRaw = o.progress_by_week ?? o.progressByWeek;
    const progressByWeek: TimeManagerProjectDashboardProgressWeek[] = Array.isArray(progressRaw)
        ? progressRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const ws = dashStr(x.week_start ?? x.weekStart) ?? '';
            return {
                weekStart: ws,
                cumulativeBillableAmount: dashNum(x.cumulative_billable_amount ?? x.cumulativeBillableAmount),
            };
        })
        : [];
    const hoursRaw = o.hours_by_week ?? o.hoursByWeek;
    const hoursByWeek: TimeManagerProjectDashboardHoursWeek[] = Array.isArray(hoursRaw)
        ? hoursRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const ws = dashStr(x.week_start ?? x.weekStart) ?? '';
            return {
                weekStart: ws,
                hours: dashNum(x.hours),
                billableHours: dashNum(x.billable_hours ?? x.billableHours),
                nonBillableHours: dashNum(x.non_billable_hours ?? x.nonBillableHours),
            };
        })
        : [];
    const tasksRaw = o.tasks;
    const tasks: TimeManagerProjectDashboardTask[] = Array.isArray(tasksRaw)
        ? tasksRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const id = dashStr(x.task_id ?? x.taskId) ?? '';
            const name = dashStr(x.name) ?? '—';
            const membersRaw = x.members ?? x.team ?? x.users;
            const members: TimeManagerProjectDashboardTaskMember[] = Array.isArray(membersRaw)
                ? membersRaw.map((mItem) => {
                    const m = mItem as Record<string, unknown>;
                    const uid = dashStr(m.user_id ?? m.userId) ?? '';
                    return {
                        userId: uid || `user-${Math.random().toString(36).slice(2)}`,
                        name: dashStr(m.name) ?? '—',
                        hours: dashNum(m.hours),
                        billableAmount: dashNum(m.billable_amount ?? m.billableAmount),
                        internalCostAmount: dashNum(m.internal_cost_amount ?? m.internalCostAmount),
                    };
                })
                : [];
            return {
                taskId: id || `task-${Math.random().toString(36).slice(2)}`,
                name,
                billable: dashBool(x.billable, true),
                hours: dashNum(x.hours),
                billableAmount: dashNum(x.billable_amount ?? x.billableAmount),
                internalCostAmount: dashNum(x.internal_cost_amount ?? x.internalCostAmount),
                members,
            };
        })
        : [];
    const teamRaw = o.team ?? o.team_members ?? o.members ?? o.project_team;
    const team: TimeManagerProjectDashboardTeamMember[] = Array.isArray(teamRaw)
        ? teamRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const uid = dashStr(x.user_id ?? x.userId) ?? '';
            return {
                userId: uid || `user-${Math.random().toString(36).slice(2)}`,
                name: dashStr(x.name) ?? '—',
                hours: dashNum(x.hours),
                billableHours: dashNum(x.billable_hours ?? x.billableHours),
                nonBillableHours: dashNum(x.non_billable_hours ?? x.nonBillableHours),
                billableAmount: dashNum(x.billable_amount ?? x.billableAmount),
                internalCostAmount: dashNum(x.internal_cost_amount ?? x.internalCostAmount),
            };
        })
        : [];
    const invRaw = o.invoices;
    const invoices: TimeManagerProjectDashboardInvoice[] = Array.isArray(invRaw)
        ? invRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const id = dashStr(x.id) ?? '';
            return {
                id: id || `inv-${Math.random().toString(36).slice(2)}`,
                issuedAt: dashStr(x.issued_at ?? x.issuedAt),
                amount: dashNum(x.amount),
                currency: dashStr(x.currency) ?? 'USD',
                status: dashStr(x.status),
            };
        })
        : [];
    let budget: TimeManagerProjectDashboardBudget | undefined;
    const bRaw = o.budget;
    const readPct = (v: unknown): number | null => {
        if (v == null || v === '')
            return null;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const readBudgetSlice = (raw: unknown): TimeManagerProjectDashboardBudgetSlice | null => {
        if (raw == null || typeof raw !== 'object')
            return null;
        const x = raw as Record<string, unknown>;
        return {
            budget: dashNum(x.budget ?? x.limit),
            spent: dashNum(x.spent),
            remaining: dashNum(x.remaining),
            percentUsed: readPct(x.percent_used ?? x.percentUsed),
        };
    };
    if (bRaw && typeof bRaw === 'object') {
        const b = bRaw as Record<string, unknown>;
        const hasBudget = dashBool(b.has_budget ?? b.hasBudget, false);
        const by = String(b.budget_by ?? b.budgetBy ?? '').toLowerCase().replace(/-/g, '_');
        const cur = dashStr(b.currency) ?? dashStr(o.currency) ?? 'USD';
        const pctRoot = readPct(b.percent_used ?? b.percentUsed);
        if (!hasBudget || by === 'none' || by === '') {
            budget = undefined;
        }
        else if (by === 'hours_and_money' || by === 'hoursandmoney') {
            const money = readBudgetSlice(b.budgetMoney ?? b.budget_money)
                ?? readBudgetSlice(b.money);
            const hours = readBudgetSlice(b.hoursBudget ?? b.hours_budget)
                ?? (b.budgetHours != null && typeof b.budgetHours === 'object'
                    ? readBudgetSlice(b.budgetHours)
                    : readBudgetSlice(b.hours));
            if (money && hours) {
                budget = {
                    hasBudget,
                    budgetBy: 'hours_and_money',
                    currency: cur,
                    budget: money.budget,
                    spent: money.spent,
                    remaining: money.remaining,
                    percentUsed: pctRoot,
                    money,
                    hours,
                    percentUsedMoney: readPct(b.percent_used_money ?? b.percentUsedMoney) ?? money.percentUsed,
                    percentUsedHours: readPct(b.percent_used_hours ?? b.percentUsedHours) ?? hours.percentUsed,
                };
            }
        }
        if (!budget && hasBudget && by !== 'none' && by !== '' && by !== 'hours_and_money' && by !== 'hoursandmoney') {
            const budgetBy: 'money' | 'hours' = by === 'hours' ? 'hours' : 'money';
            budget = {
                hasBudget,
                budgetBy,
                currency: cur,
                budget: dashNum(b.budget),
                spent: dashNum(b.spent),
                remaining: dashNum(b.remaining),
                percentUsed: pctRoot,
            };
        }
    }
    return {
        currency: dashStr(o.currency),
        totals,
        progressByWeek,
        hoursByWeek,
        tasks,
        team,
        invoices,
        ...(budget ? { budget } : {}),
    };
}
export type ProjectDashboardQuery = {
    dateFrom?: string;
    dateTo?: string;
};
export async function getClientProjectDashboard(clientId: string, projectId: string, query?: ProjectDashboardQuery): Promise<TimeManagerProjectDashboard | null> {
    const qs = new URLSearchParams();
    if (query?.dateFrom) {
        qs.set('dateFrom', query.dateFrom);
        qs.set('date_from', query.dateFrom);
    }
    if (query?.dateTo) {
        qs.set('dateTo', query.dateTo);
        qs.set('date_to', query.dateTo);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/dashboard${suffix}`);
    if (res.status === 404)
        return null;
    await throwIfNotOk(res);
    let body: unknown;
    try {
        body = await res.json();
    }
    catch {
        return null;
    }
    return normalizeProjectDashboard(body);
}
export type TimeManagerClientProjectCodeHint = {
    last_code: string | null;
    suggested_next: string | null;
};
export type TimeManagerInitialProjectAccessMember = {
    authUserId: number;

    billableHourlyAmount?: number | string | null;
};
export type TimeManagerClientProjectCreatePayload = {
    name: string;
    code?: string | null;
    currency?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    reportVisibility?: string;
    recordsLanguage?: TimeManagerProjectRecordsLanguage;
    projectType?: string;
    billableRateType?: string | null;
    
    projectBillableRateAmount?: string | number | null;
    budgetType?: string | null;
    budgetAmount?: string | number | null;
    progressBudgetAmount?: string | number | null;
    budgetHours?: string | number | null;
    budgetResetsEveryMonth?: boolean;
    budgetIncludesExpenses?: boolean;
    sendBudgetAlerts?: boolean;
    budgetAlertThresholdPercent?: string | number | null;
    fixedFeeAmount?: string | number | null;
    packageHoursPerMonth?: string | number | null;
    packageFeeAmount?: string | number | null;

    initialTimeTrackingUserAuthIds?: number[];

    initialTimeTrackingUserBillableHourlyAmounts?: (number | null)[];

    initialProjectAccessMembers?: TimeManagerInitialProjectAccessMember[];
};
export type TimeManagerClientProjectPatchPayload = {
    name?: string;
    code?: string | null;
    currency?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    reportVisibility?: string;
    recordsLanguage?: TimeManagerProjectRecordsLanguage;
    projectType?: string;
    billableRateType?: string | null;
    projectBillableRateAmount?: string | number | null;
    budgetType?: string | null;
    budgetAmount?: string | number | null;
    progressBudgetAmount?: string | number | null;
    budgetHours?: string | number | null;
    budgetResetsEveryMonth?: boolean;
    budgetIncludesExpenses?: boolean;
    sendBudgetAlerts?: boolean;
    budgetAlertThresholdPercent?: string | number | null;
    fixedFeeAmount?: string | number | null;
    packageHoursPerMonth?: string | number | null;
    packageFeeAmount?: string | number | null;
    isArchived?: boolean;
    isPaused?: boolean;
};
export function projectCreateBody(body: TimeManagerClientProjectCreatePayload): Record<string, unknown> {
    const o: Record<string, unknown> = { name: body.name };
    const members = body.initialProjectAccessMembers ?? [];
    const hasMembers = members.length > 0;
    const hasParallelBillableAmounts = body.initialTimeTrackingUserBillableHourlyAmounts != null
        && body.initialTimeTrackingUserBillableHourlyAmounts.length > 0;
    if (hasMembers && hasParallelBillableAmounts) {
        throw new Error(
            'Нельзя одновременно передавать initialProjectAccessMembers и initialTimeTrackingUserBillableHourlyAmounts',
        );
    }
    if (body.code !== undefined)
        o.code = body.code;
    if (body.currency !== undefined && body.currency !== null && String(body.currency).trim()) {
        o.currency = String(body.currency).trim();
    }
    if (body.startDate !== undefined)
        o.startDate = body.startDate;
    if (body.endDate !== undefined)
        o.endDate = body.endDate;
    if (body.notes !== undefined)
        o.notes = body.notes;
    if (body.reportVisibility !== undefined)
        o.reportVisibility = body.reportVisibility;
    if (body.recordsLanguage !== undefined)
        o.recordsLanguage = body.recordsLanguage;
    if (body.projectType !== undefined)
        o.projectType = body.projectType;
    if (body.billableRateType !== undefined)
        o.billableRateType = body.billableRateType;
    if (body.projectBillableRateAmount !== undefined)
        o.projectBillableRateAmount = body.projectBillableRateAmount;
    if (body.budgetType !== undefined)
        o.budgetType = body.budgetType;
    if (body.budgetAmount !== undefined)
        o.budgetAmount = body.budgetAmount;
    if (body.progressBudgetAmount !== undefined)
        o.progressBudgetAmount = body.progressBudgetAmount;
    if (body.budgetHours !== undefined)
        o.budgetHours = body.budgetHours;
    if (body.budgetResetsEveryMonth !== undefined)
        o.budgetResetsEveryMonth = body.budgetResetsEveryMonth;
    if (body.budgetIncludesExpenses !== undefined)
        o.budgetIncludesExpenses = body.budgetIncludesExpenses;
    if (body.sendBudgetAlerts !== undefined)
        o.sendBudgetAlerts = body.sendBudgetAlerts;
    if (body.budgetAlertThresholdPercent !== undefined)
        o.budgetAlertThresholdPercent = body.budgetAlertThresholdPercent;
    if (body.fixedFeeAmount !== undefined)
        o.fixedFeeAmount = body.fixedFeeAmount;
    if (body.packageHoursPerMonth !== undefined)
        o.packageHoursPerMonth = body.packageHoursPerMonth;
    if (body.packageFeeAmount !== undefined)
        o.packageFeeAmount = body.packageFeeAmount;
    if (hasMembers) {
        o.initialProjectAccessMembers = members.map((m) => {
            const row: Record<string, unknown> = { authUserId: m.authUserId };
            if (m.billableHourlyAmount != null && m.billableHourlyAmount !== '') {
                const raw = typeof m.billableHourlyAmount === 'number'
                    ? m.billableHourlyAmount
                    : parseFloat(String(m.billableHourlyAmount).replace(',', '.'));
                if (Number.isFinite(raw))
                    row.billableHourlyAmount = raw;
            }
            return row;
        });
    }
    else if (body.initialTimeTrackingUserAuthIds != null && body.initialTimeTrackingUserAuthIds.length > 0) {
        const rawIds = body.initialTimeTrackingUserAuthIds.filter((n) => Number.isFinite(n) && n > 0);
        const amtsIn = body.initialTimeTrackingUserBillableHourlyAmounts;
        const useAmts = amtsIn != null && amtsIn.length > 0;
        if (useAmts && amtsIn.length !== rawIds.length) {
            throw new Error(
                'initialTimeTrackingUserBillableHourlyAmounts должны совпадать по длине с initialTimeTrackingUserAuthIds',
            );
        }
        const seen = new Set<number>();
        const ids: number[] = [];
        const amtsOut: (number | null)[] = [];
        for (let i = 0; i < rawIds.length; i++) {
            const id = rawIds[i];
            if (seen.has(id))
                continue;
            seen.add(id);
            ids.push(id);
            if (useAmts) {
                const x = amtsIn[i];
                amtsOut.push(x != null && Number.isFinite(x) ? x : null);
            }
        }
        o.initialTimeTrackingUserAuthIds = ids;
        if (useAmts)
            o.initialTimeTrackingUserBillableHourlyAmounts = amtsOut;
    }
    return o;
}
export function projectPatchBody(patch: TimeManagerClientProjectPatchPayload): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    if (patch.name !== undefined)
        o.name = patch.name;
    if (patch.code !== undefined)
        o.code = patch.code;
    if (patch.currency !== undefined)
        o.currency = patch.currency;
    if (patch.startDate !== undefined)
        o.startDate = patch.startDate;
    if (patch.endDate !== undefined)
        o.endDate = patch.endDate;
    if (patch.notes !== undefined)
        o.notes = patch.notes;
    if (patch.reportVisibility !== undefined)
        o.reportVisibility = patch.reportVisibility;
    if (patch.recordsLanguage !== undefined)
        o.recordsLanguage = patch.recordsLanguage;
    if (patch.projectType !== undefined)
        o.projectType = patch.projectType;
    if (patch.billableRateType !== undefined)
        o.billableRateType = patch.billableRateType;
    if (patch.projectBillableRateAmount !== undefined)
        o.projectBillableRateAmount = patch.projectBillableRateAmount;
    if (patch.budgetType !== undefined)
        o.budgetType = patch.budgetType;
    if (patch.budgetAmount !== undefined)
        o.budgetAmount = patch.budgetAmount;
    if (patch.progressBudgetAmount !== undefined)
        o.progressBudgetAmount = patch.progressBudgetAmount;
    if (patch.budgetHours !== undefined)
        o.budgetHours = patch.budgetHours;
    if (patch.budgetResetsEveryMonth !== undefined)
        o.budgetResetsEveryMonth = patch.budgetResetsEveryMonth;
    if (patch.budgetIncludesExpenses !== undefined)
        o.budgetIncludesExpenses = patch.budgetIncludesExpenses;
    if (patch.sendBudgetAlerts !== undefined)
        o.sendBudgetAlerts = patch.sendBudgetAlerts;
    if (patch.budgetAlertThresholdPercent !== undefined)
        o.budgetAlertThresholdPercent = patch.budgetAlertThresholdPercent;
    if (patch.fixedFeeAmount !== undefined)
        o.fixedFeeAmount = patch.fixedFeeAmount;
    if (patch.packageHoursPerMonth !== undefined)
        o.packageHoursPerMonth = patch.packageHoursPerMonth;
    if (patch.packageFeeAmount !== undefined)
        o.packageFeeAmount = patch.packageFeeAmount;
    if (patch.isArchived !== undefined) {
        o.isArchived = patch.isArchived;
        o.is_archived = patch.isArchived;
    }
    if (patch.isPaused !== undefined) {
        o.isPaused = patch.isPaused;
        o.is_paused = patch.isPaused;
    }
    return o;
}
export async function getClientProjectCodeHint(clientId: string): Promise<TimeManagerClientProjectCodeHint> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/code-hint`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientProjectCodeHint;
}
export async function listClientProjects(clientId: string): Promise<TimeManagerClientProjectRow[]>;
export async function listClientProjects(clientId: string, pagination: TimeTrackingPaginationParams): Promise<PaginatedResult<TimeManagerClientProjectRow>>;
export async function listClientProjects(clientId: string, pagination?: TimeTrackingPaginationParams): Promise<TimeManagerClientProjectRow[] | PaginatedResult<TimeManagerClientProjectRow>> {
    const qs = new URLSearchParams();
    if (pagination) {
        qs.set('limit', String(pagination.limit));
        qs.set('offset', String(pagination.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (pagination) {
        const off = pagination.offset ?? 0;
        return parseTimeTrackingPagedResponse(raw, (item) => normalizeTimeManagerClientProjectRow(item) ?? (item as TimeManagerClientProjectRow), {
            limit: pagination.limit,
            offset: off,
        });
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    return arr.map((item) => normalizeTimeManagerClientProjectRow(item) ?? (item as TimeManagerClientProjectRow));
}

export type ProjectBudgetMetricsEntry = {
    budgetDisplayValue?: number | null;
    budgetSpentValue?: number | null;
    budgetRemainingValue?: number | null;
    budgetProgressPercent?: number | null;
    loggedHoursValue?: number | null;
    hasBudgetConfigured?: boolean | null;
};

export type ProjectBudgetMetricsMap = Record<string, ProjectBudgetMetricsEntry>;

export function isTimeTrackingUnavailableError(e: unknown): boolean {
    return e instanceof Error && /503|unavailable|недоступ/i.test(e.message);
}

export async function listAllClientProjectsMergedFallback(includeArchived: boolean): Promise<TimeManagerClientProjectRow[]> {
    const flat = await listProjectsForExpenses({ includeArchived }) as TimeTrackingProjectForExpense[];
    const acc = flat.map(projectForExpenseToPickerStub);
    acc.sort((a, b) => {
        const byClient = (a.client_id ?? '').localeCompare(b.client_id ?? '', 'ru', { sensitivity: 'base' });
        if (byClient !== 0)
            return byClient;
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
    return acc;
}

export function applyBudgetMetricsToProjects(
    projects: TimeManagerClientProjectRow[],
    metrics: ProjectBudgetMetricsMap,
): TimeManagerClientProjectRow[] {
    if (Object.keys(metrics).length === 0)
        return projects;
    return projects.map((p) => {
        const m = metrics[p.id];
        if (!m)
            return p;
        return {
            ...p,
            budget_display_value: m.budgetDisplayValue ?? p.budget_display_value,
            budget_spent_value: m.budgetSpentValue ?? p.budget_spent_value,
            budget_remaining_value: m.budgetRemainingValue ?? p.budget_remaining_value,
            budget_progress_percent: m.budgetProgressPercent ?? p.budget_progress_percent,
            logged_hours_value: m.loggedHoursValue ?? p.logged_hours_value,
            has_budget_configured: m.hasBudgetConfigured ?? p.has_budget_configured,
        };
    });
}

export const PROJECT_BUDGET_METRICS_CHUNK = 40;
const PROJECT_BUDGET_METRICS_TTL_MS = 30_000;
type ProjectBudgetMetricsCacheEntry = {
    value: ProjectBudgetMetricsEntry | null;
    expiresAt: number;
};
const projectBudgetMetricsCache = new Map<string, ProjectBudgetMetricsCacheEntry>();
const projectBudgetMetricsInflight = new Map<string, Promise<void>>();

export function invalidateProjectBudgetMetricsCache(projectIds?: readonly string[]): void {
    if (!projectIds) {
        projectBudgetMetricsCache.clear();
        return;
    }
    for (const id of projectIds)
        projectBudgetMetricsCache.delete(id.trim());
}

function readCachedProjectBudgetMetric(projectId: string): ProjectBudgetMetricsCacheEntry | null {
    const cached = projectBudgetMetricsCache.get(projectId);
    if (!cached)
        return null;
    if (cached.expiresAt <= Date.now()) {
        projectBudgetMetricsCache.delete(projectId);
        return null;
    }
    return cached;
}

function startProjectBudgetMetricsChunk(chunk: string[]): Promise<void> {
    const qs = new URLSearchParams({ ids: chunk.join(',') });
    const job = (async () => {
        const res = await apiFetch(`/api/v1/time-tracking/projects/budget-metrics?${qs}`);
        await throwIfNotOk(res);
        const part = await res.json() as ProjectBudgetMetricsMap;
        const expiresAt = Date.now() + PROJECT_BUDGET_METRICS_TTL_MS;
        for (const id of chunk) {
            projectBudgetMetricsCache.set(id, {
                value: part[id] ?? null,
                expiresAt,
            });
        }
    })();
    for (const id of chunk)
        projectBudgetMetricsInflight.set(id, job);
    const clear = () => {
        for (const id of chunk) {
            if (projectBudgetMetricsInflight.get(id) === job)
                projectBudgetMetricsInflight.delete(id);
        }
    };
    void job.then(clear, clear);
    return job;
}

export async function fetchProjectsBudgetMetrics(projectIds: string[]): Promise<ProjectBudgetMetricsMap> {
    const ids = [...new Set(projectIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (ids.length === 0)
        return {};

    const waiting = new Set<Promise<void>>();
    const missing: string[] = [];
    for (const id of ids) {
        if (readCachedProjectBudgetMetric(id))
            continue;
        const pending = projectBudgetMetricsInflight.get(id);
        if (pending)
            waiting.add(pending);
        else
            missing.push(id);
    }
    for (let i = 0; i < missing.length; i += PROJECT_BUDGET_METRICS_CHUNK) {
        waiting.add(startProjectBudgetMetricsChunk(missing.slice(i, i + PROJECT_BUDGET_METRICS_CHUNK)));
    }

    if (waiting.size > 0)
        await Promise.all(waiting);

    const merged: ProjectBudgetMetricsMap = {};
    for (const id of ids) {
        const cached = readCachedProjectBudgetMetric(id);
        if (cached?.value)
            merged[id] = cached.value;
    }
    return merged;
}

export async function listAllClientProjectsMerged(includeArchived = false): Promise<TimeManagerClientProjectRow[]> {
    const cacheKey = `projects:v3:${includeArchived}`;
    const cached = getTimeTrackingCached<TimeManagerClientProjectRow[]>('projects', cacheKey);
    if (cached)
        return cached;
    const qs = new URLSearchParams();
    if (includeArchived)
        qs.set('includeArchived', 'true');
    qs.set('includeBudgetMetrics', 'false');
    const suffix = qs.toString() ? `?${qs}` : '';
    try {
        const res = await apiFetch(`/api/v1/time-tracking/projects${suffix}`);
        await throwIfNotOk(res);
        const raw = await res.json();
        const arr = unwrapTimeTrackingListArray(raw);
        const acc = (arr ?? []).map((item) => normalizeTimeManagerClientProjectRow(item) ?? (item as TimeManagerClientProjectRow));
        const rows = includeArchived ? acc : acc.filter((p) => isActiveTimeManagerProjectRow(p));
        rows.sort((a, b) => {
            const byClient = (a.client_id ?? '').localeCompare(b.client_id ?? '', 'ru', { sensitivity: 'base' });
            if (byClient !== 0)
                return byClient;
            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });
        setTimeTrackingCached('projects', cacheKey, rows);
        return rows;
    }
    catch (e) {
        if (!isTimeTrackingUnavailableError(e))
            throw e;
        const acc = await listAllClientProjectsMergedFallback(includeArchived);
        setTimeTrackingCached('projects', cacheKey, acc);
        return acc;
    }
}
export async function listAllClientProjectsForClientMerged(clientId: string): Promise<TimeManagerClientProjectRow[]> {
    const cid = clientId.trim();
    const all = await listAllClientProjectsMerged(false);
    const rows = all.filter((p) => (p.client_id ?? '').trim() === cid);
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return rows;
}
function coerceClientProjectRow(raw: unknown): TimeManagerClientProjectRow {
    const normalized = normalizeTimeManagerClientProjectRow(raw);
    if (normalized)
        return normalized;
    const o = (raw && typeof raw === 'object' ? raw : {}) as TimeManagerClientProjectRow;
    return { ...o, records_language: readProjectRecordsLanguage(o) };
}
export async function getClientProject(clientId: string, projectId: string): Promise<TimeManagerClientProjectRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`);
    await throwIfNotOk(res);
    return coerceClientProjectRow(await res.json());
}
export async function createClientProject(clientId: string, body: TimeManagerClientProjectCreatePayload): Promise<TimeManagerClientProjectRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectCreateBody(body)),
    });
    await throwIfNotOk(res);
    const created = coerceClientProjectRow(await res.json());
    invalidateTimeTrackingListCache();
    invalidateProjectBudgetMetricsCache([created.id]);
    return created;
}
export async function patchClientProject(clientId: string, projectId: string, patch: TimeManagerClientProjectPatchPayload): Promise<TimeManagerClientProjectRow> {
    const payload = projectPatchBody(patch);
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    const updated = coerceClientProjectRow(await res.json());
    invalidateTimeTrackingListCache();
    invalidateProjectBudgetMetricsCache([projectId]);
    return updated;
}
export async function deleteClientProject(clientId: string, projectId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
    invalidateTimeTrackingListCache();
    invalidateProjectBudgetMetricsCache([projectId]);
}
export function projectForExpenseToPickerStub(p: TimeTrackingProjectForExpense): TimeManagerClientProjectRow {
    const cur = (p.currency ?? '').trim().toUpperCase();
    const safeCur = TIME_TRACKING_PROJECT_CURRENCIES.includes(cur as TimeManagerProjectCurrency) ? cur : 'USD';
    return {
        id: p.id,
        client_id: p.clientId,
        name: p.name,
        code: p.code,
        currency: safeCur,
        start_date: null,
        end_date: p.endDate ?? null,
        notes: null,
        report_visibility: '',
        records_language: p.recordsLanguage ?? 'ENG',
        project_type: (p.projectType ?? '').trim() || 'time_and_materials',
        billable_rate_type: null,
        project_billable_rate_amount: null,
        budget_type: null,
        budget_amount: null,
        progress_budget_amount: null,
        budget_hours: null,
        budget_resets_every_month: false,
        budget_includes_expenses: false,
        send_budget_alerts: false,
        budget_alert_threshold_percent: null,
        fixed_fee_amount: null,
        usage_count: 0,
        deletable: false,
        created_at: '',
        updated_at: null,
        is_archived: p.isArchived,
        isArchived: p.isArchived,
        is_paused: Boolean(p.isPaused),
        isPaused: Boolean(p.isPaused),
    };
}
export async function listAllClientProjectsForPicker(): Promise<TimeManagerClientProjectRow[]> {
    const cacheKey = 'picker:active:v2';
    const cached = getTimeTrackingCached<TimeManagerClientProjectRow[]>('picker', cacheKey);
    if (cached)
        return cached;
    const flat = await listProjectsForExpenses({ includeArchived: false }) as TimeTrackingProjectForExpense[];
    if (flat.length === 0)
        return [];
    const sorted = [...flat].sort((a, b) => {
        const cmp = a.clientName.localeCompare(b.clientName, 'ru', { sensitivity: 'base' });
        if (cmp !== 0)
            return cmp;
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
    const out = sorted.map(projectForExpenseToPickerStub);
    setTimeTrackingCached('picker', cacheKey, out);
    return out;
}
