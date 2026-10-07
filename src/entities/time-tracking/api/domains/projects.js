import { apiFetch } from '@shared/api';
import { getTimeTrackingCached, setTimeTrackingCached, invalidateTimeTrackingListCache, } from '../../lib/timeTrackingListCache';
import { isActiveTimeManagerProjectRow } from '../../lib/projectTimeEntry';
import { parseTimeTrackingPagedResponse, unwrapTimeTrackingListArray, throwIfNotOk, dashNum, isTimeTrackingUnavailableError, } from './httpShared';
function normalizeProjectScopeDefinition(raw) {
    const r = (raw ?? {});
    return {
        projectId: String(r.projectId ?? r.project_id ?? ''),
        color: String(r.color ?? '').trim().toUpperCase(),
        description: String(r.description ?? '').trim(),
        createdAt: String(r.createdAt ?? r.created_at ?? ''),
        updatedAt: r.updatedAt != null || r.updated_at != null
            ? String(r.updatedAt ?? r.updated_at)
            : null,
    };
}
function projectScopeDefinitionsPath(projectId) {
    return `/api/v1/time-tracking/projects/${encodeURIComponent(projectId)}/scope-definitions`;
}
export async function listProjectScopeDefinitions(projectId) {
    const res = await apiFetch(projectScopeDefinitionsPath(projectId));
    await throwIfNotOk(res);
    const body = await res.json();
    return Array.isArray(body) ? body.map(normalizeProjectScopeDefinition) : [];
}
export async function upsertProjectScopeDefinition(projectId, color, description) {
    const res = await apiFetch(projectScopeDefinitionsPath(projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, description }),
    });
    await throwIfNotOk(res);
    return normalizeProjectScopeDefinition(await res.json());
}
export function normalizeTimeManagerProjectTask(raw) {
    const r = raw;
    const projectIdRaw = r.project_id ?? r.projectId;
    const modeRaw = String(r.billing_mode ?? r.billingMode ?? 'hourly').trim().toLowerCase();
    const billingMode = modeRaw === 'flat_fee' || modeRaw === 'flat' || modeRaw === 'fixed' || modeRaw === 'fixed_fee'
        ? 'flat_fee'
        : 'hourly';
    return {
        id: String(r.id ?? ''),
        project_id: String(projectIdRaw ?? ''),
        name: String(r.name ?? ''),
        default_billable_rate: (r.default_billable_rate ?? r.defaultBillableRate ?? null),
        billable_by_default: Boolean(r.billable_by_default ?? r.billableByDefault),
        billing_mode: billingMode,
        flat_fee_amount: (r.flat_fee_amount ?? r.flatFeeAmount ?? null),
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
export function projectTasksCollectionPath(clientId, projectId) {
    return `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/tasks`;
}
export async function listProjectTasks(clientId, projectId, opts) {
    const res = await apiFetch(projectTasksCollectionPath(clientId, projectId), {
        getReuseWindowMs: opts?.bypassGetReuse ? 0 : 10_000,
        ...(opts?.bypassGetReuse ? { cache: 'no-store' } : {}),
    });
    await throwIfNotOk(res);
    const body = await res.json();
    if (!Array.isArray(body))
        return [];
    return body.map(normalizeTimeManagerProjectTask);
}
export async function getProjectTask(clientId, projectId, taskId) {
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`);
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function createProjectTask(clientId, projectId, body) {
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
export async function patchProjectTask(clientId, projectId, taskId, patch) {
    const payload = {};
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
export async function deleteProjectTask(clientId, projectId, taskId) {
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export function normalizeProjectForExpense(raw) {
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
    const recordsLanguage = rl === 'RU' ? 'RU' : 'ENG';
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
export function filterActiveProjectsForExpenses(rows, includeArchived) {
    if (includeArchived)
        return rows;
    return rows.filter((p) => !p.isArchived && !p.isPaused);
}
export async function listProjectsForExpenses(options) {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    if (options?.limit != null) {
        qs.set('limit', String(options.limit));
        qs.set('offset', String(options.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/projects-for-expenses${suffix}`, { getReuseWindowMs: 15_000 });
    await throwIfNotOk(res);
    const raw = await res.json();
    if (options?.limit != null) {
        const off = options.offset ?? 0;
        const page = parseTimeTrackingPagedResponse(raw, (item) => {
            if (!item || typeof item !== 'object')
                return null;
            return normalizeProjectForExpense(item);
        }, { limit: options.limit, offset: off });
        return {
            ...page,
            items: filterActiveProjectsForExpenses(page.items, options?.includeArchived),
        };
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    const out = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const row = normalizeProjectForExpense(item);
        if (row)
            out.push(row);
    }
    return filterActiveProjectsForExpenses(out, options?.includeArchived);
}
export function normalizeProjectExpenseCategory(raw) {
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
export async function listProjectExpenseCategories(projectId, options) {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/projects/${encodeURIComponent(projectId)}/expense-categories${suffix}`);
    await throwIfNotOk(res);
    const arr = (await res.json());
    if (!Array.isArray(arr))
        return [];
    const out = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const row = normalizeProjectExpenseCategory(item);
        if (row)
            out.push(row);
    }
    return out;
}
export const TIME_TRACKING_PROJECT_CURRENCIES = ['USD', 'UZS', 'EUR', 'RUB', 'GBP'];
export const TIME_TRACKING_PROJECT_RECORDS_LANGUAGES = ['ENG', 'RU'];
/** True when project allows invoices without fully_confirmed partner period. */
export function projectSkipsPartnerInvoiceConfirmation(row) {
    if (!row || typeof row !== 'object')
        return false;
    const o = row;
    return o.skip_partner_invoice_confirmation === true || o.skipPartnerInvoiceConfirmation === true;
}
/** API may return `recordsLanguage` (alias) or `records_language`. */
export function readProjectRecordsLanguage(row) {
    if (!row || typeof row !== 'object')
        return 'ENG';
    const raw = row;
    const v = String(raw.records_language ?? raw.recordsLanguage ?? 'ENG').trim().toUpperCase();
    return v === 'RU' ? 'RU' : 'ENG';
}
/** Normalize mixed camelCase/snake_case project payloads from the API. */
function coalesceProjectNumericField(o, snake, camel) {
    const snakeVal = o[snake];
    if (snakeVal != null && String(snakeVal).trim() !== '')
        return snakeVal;
    const camelVal = o[camel];
    if (camelVal != null && String(camelVal).trim() !== '')
        return camelVal;
    if (snakeVal !== undefined)
        return snakeVal;
    if (camelVal !== undefined)
        return camelVal;
    return undefined;
}
export function normalizeTimeManagerClientProjectRow(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = String(o.id ?? '').trim();
    const clientId = String(o.client_id ?? o.clientId ?? '').trim();
    if (!id || !clientId)
        return null;
    const row = { ...o };
    row.id = id;
    row.client_id = clientId;
    row.records_language = readProjectRecordsLanguage(o);
    const skipPartner = o.skip_partner_invoice_confirmation === true || o.skipPartnerInvoiceConfirmation === true;
    row.skip_partner_invoice_confirmation = skipPartner;
    row.skipPartnerInvoiceConfirmation = skipPartner;
    // Out schema aliases progress/package/rate fields; hydrate snake_case for form + list consumers.
    const progressBudget = coalesceProjectNumericField(o, 'progress_budget_amount', 'progressBudgetAmount');
    if (progressBudget !== undefined) {
        row.progress_budget_amount = progressBudget;
        row.progressBudgetAmount = progressBudget;
    }
    const packageHours = coalesceProjectNumericField(o, 'package_hours_per_month', 'packageHoursPerMonth');
    if (packageHours !== undefined) {
        row.package_hours_per_month = packageHours;
        row.packageHoursPerMonth = packageHours;
    }
    const packageFee = coalesceProjectNumericField(o, 'package_fee_amount', 'packageFeeAmount');
    if (packageFee !== undefined) {
        row.package_fee_amount = packageFee;
        row.packageFeeAmount = packageFee;
    }
    const projectRate = coalesceProjectNumericField(o, 'project_billable_rate_amount', 'projectBillableRateAmount');
    if (projectRate !== undefined)
        row.project_billable_rate_amount = projectRate;
    const budgetAmount = coalesceProjectNumericField(o, 'budget_amount', 'budgetAmount');
    if (budgetAmount !== undefined)
        row.budget_amount = budgetAmount;
    const budgetHours = coalesceProjectNumericField(o, 'budget_hours', 'budgetHours');
    if (budgetHours !== undefined)
        row.budget_hours = budgetHours;
    const budgetType = o.budget_type ?? o.budgetType;
    if (budgetType !== undefined)
        row.budget_type = budgetType == null ? null : String(budgetType);
    if (o.clientId != null && row.client_id)
        row.clientId = row.client_id;
    return row;
}
export function readTimeManagerProjectBillableRateAmount(row) {
    const raw = row.project_billable_rate_amount ?? row.projectBillableRateAmount;
    if (raw == null || String(raw).trim() === '')
        return '';
    return String(raw);
}
export function dashStr(v) {
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
export function dashBool(v, fallback) {
    if (typeof v === 'boolean')
        return v;
    return fallback;
}
export function normalizeProjectDashboard(raw) {
    const emptyTotals = {
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
    const o = raw;
    const tr = (o.totals && typeof o.totals === 'object' ? o.totals : {});
    const expenseAmountUzs = dashNum(tr.expense_amount_uzs ?? tr.expenseAmountUzs);
    const uzsRaw = tr.expense_amount_uzs ?? tr.expenseAmountUzs;
    const hasExplicitUzs = uzsRaw != null && String(uzsRaw).trim() !== '';
    const pickEquivFromTotals = () => {
        const keys = [
            'expense_equivalent_total',
            'expenseEquivalentTotal',
            'total_equivalent_amount',
            'totalEquivalentAmount',
            'expense_amount_project',
            'expenseAmountProject',
            'expense_amount_in_project',
            'expenseAmountInProject',
        ];
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
    const totals = {
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
    const progressByWeek = Array.isArray(progressRaw)
        ? progressRaw.map((item) => {
            const x = item;
            const ws = dashStr(x.week_start ?? x.weekStart) ?? '';
            return {
                weekStart: ws,
                cumulativeBillableAmount: dashNum(x.cumulative_billable_amount ?? x.cumulativeBillableAmount),
            };
        })
        : [];
    const hoursRaw = o.hours_by_week ?? o.hoursByWeek;
    const hoursByWeek = Array.isArray(hoursRaw)
        ? hoursRaw.map((item) => {
            const x = item;
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
    const tasks = Array.isArray(tasksRaw)
        ? tasksRaw.map((item) => {
            const x = item;
            const id = dashStr(x.task_id ?? x.taskId) ?? '';
            const name = dashStr(x.name) ?? '—';
            const membersRaw = x.members ?? x.team ?? x.users;
            const members = Array.isArray(membersRaw)
                ? membersRaw.map((mItem) => {
                    const m = mItem;
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
    const team = Array.isArray(teamRaw)
        ? teamRaw.map((item) => {
            const x = item;
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
    const invoices = Array.isArray(invRaw)
        ? invRaw.map((item) => {
            const x = item;
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
    let budget;
    const bRaw = o.budget;
    const readPct = (v) => {
        if (v == null || v === '')
            return null;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const readBudgetSlice = (raw) => {
        if (raw == null || typeof raw !== 'object')
            return null;
        const x = raw;
        return {
            budget: dashNum(x.budget ?? x.limit),
            spent: dashNum(x.spent),
            remaining: dashNum(x.remaining),
            percentUsed: readPct(x.percent_used ?? x.percentUsed),
        };
    };
    if (bRaw && typeof bRaw === 'object') {
        const b = bRaw;
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
            const budgetBy = by === 'hours' ? 'hours' : 'money';
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
export async function getClientProjectDashboard(clientId, projectId, query) {
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
    let body;
    try {
        body = await res.json();
    }
    catch {
        return null;
    }
    return normalizeProjectDashboard(body);
}
export function projectCreateBody(body) {
    const o = { name: body.name };
    const members = body.initialProjectAccessMembers ?? [];
    const hasMembers = members.length > 0;
    const hasParallelBillableAmounts = body.initialTimeTrackingUserBillableHourlyAmounts != null
        && body.initialTimeTrackingUserBillableHourlyAmounts.length > 0;
    if (hasMembers && hasParallelBillableAmounts) {
        throw new Error('Нельзя одновременно передавать initialProjectAccessMembers и initialTimeTrackingUserBillableHourlyAmounts');
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
    if (body.skipPartnerInvoiceConfirmation !== undefined)
        o.skipPartnerInvoiceConfirmation = body.skipPartnerInvoiceConfirmation;
    if (hasMembers) {
        o.initialProjectAccessMembers = members.map((m) => {
            const row = { authUserId: m.authUserId };
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
            throw new Error('initialTimeTrackingUserBillableHourlyAmounts должны совпадать по длине с initialTimeTrackingUserAuthIds');
        }
        const seen = new Set();
        const ids = [];
        const amtsOut = [];
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
    if (body.initialTaskNames !== undefined)
        o.initialTaskNames = body.initialTaskNames;
    return o;
}
export function projectPatchBody(patch) {
    const o = {};
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
    if (patch.skipPartnerInvoiceConfirmation !== undefined) {
        o.skipPartnerInvoiceConfirmation = patch.skipPartnerInvoiceConfirmation;
        o.skip_partner_invoice_confirmation = patch.skipPartnerInvoiceConfirmation;
    }
    return o;
}
export async function getClientProjectCodeHint(clientId) {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/code-hint`);
    await throwIfNotOk(res);
    return (await res.json());
}
export async function listClientProjects(clientId, pagination) {
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
        return parseTimeTrackingPagedResponse(raw, (item) => normalizeTimeManagerClientProjectRow(item) ?? item, {
            limit: pagination.limit,
            offset: off,
        });
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    return arr.map((item) => normalizeTimeManagerClientProjectRow(item) ?? item);
}
export async function listAllClientProjectsMergedFallback(includeArchived) {
    const flat = await listProjectsForExpenses({ includeArchived });
    const acc = flat.map(projectForExpenseToPickerStub);
    acc.sort((a, b) => {
        const byClient = (a.client_id ?? '').localeCompare(b.client_id ?? '', 'ru', { sensitivity: 'base' });
        if (byClient !== 0)
            return byClient;
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
    return acc;
}
export function applyBudgetMetricsToProjects(projects, metrics) {
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
const projectBudgetMetricsCache = new Map();
const projectBudgetMetricsInflight = new Map();
export function invalidateProjectBudgetMetricsCache(projectIds) {
    if (!projectIds) {
        projectBudgetMetricsCache.clear();
        return;
    }
    for (const id of projectIds)
        projectBudgetMetricsCache.delete(id.trim());
}
function readCachedProjectBudgetMetric(projectId) {
    const cached = projectBudgetMetricsCache.get(projectId);
    if (!cached)
        return null;
    if (cached.expiresAt <= Date.now()) {
        projectBudgetMetricsCache.delete(projectId);
        return null;
    }
    return cached;
}
function startProjectBudgetMetricsChunk(chunk) {
    const qs = new URLSearchParams({ ids: chunk.join(',') });
    const job = (async () => {
        const res = await apiFetch(`/api/v1/time-tracking/projects/budget-metrics?${qs}`);
        await throwIfNotOk(res);
        const part = await res.json();
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
export async function fetchProjectsBudgetMetrics(projectIds) {
    const ids = [...new Set(projectIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (ids.length === 0)
        return {};
    const waiting = new Set();
    const missing = [];
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
    const merged = {};
    for (const id of ids) {
        const cached = readCachedProjectBudgetMetric(id);
        if (cached?.value)
            merged[id] = cached.value;
    }
    return merged;
}
export async function listAllClientProjectsMerged(includeArchived = false) {
    const cacheKey = `projects:v3:${includeArchived}`;
    const cached = getTimeTrackingCached('projects', cacheKey);
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
        const acc = (arr ?? []).map((item) => normalizeTimeManagerClientProjectRow(item) ?? item);
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
export async function listAllClientProjectsForClientMerged(clientId) {
    const cid = clientId.trim();
    const all = await listAllClientProjectsMerged(false);
    const rows = all.filter((p) => (p.client_id ?? '').trim() === cid);
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return rows;
}
function coerceClientProjectRow(raw) {
    const normalized = normalizeTimeManagerClientProjectRow(raw);
    if (normalized)
        return normalized;
    const o = (raw && typeof raw === 'object' ? raw : {});
    return { ...o, records_language: readProjectRecordsLanguage(o) };
}
export async function getClientProject(clientId, projectId) {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`);
    await throwIfNotOk(res);
    return coerceClientProjectRow(await res.json());
}
export async function createClientProject(clientId, body) {
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
export async function patchClientProject(clientId, projectId, patch) {
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
export async function deleteClientProject(clientId, projectId) {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
    invalidateTimeTrackingListCache();
    invalidateProjectBudgetMetricsCache([projectId]);
}
export function projectForExpenseToPickerStub(p) {
    const cur = (p.currency ?? '').trim().toUpperCase();
    const safeCur = TIME_TRACKING_PROJECT_CURRENCIES.includes(cur) ? cur : 'USD';
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
export async function listAllClientProjectsForPicker() {
    const cacheKey = 'picker:active:v2';
    const cached = getTimeTrackingCached('picker', cacheKey);
    if (cached)
        return cached;
    const flat = await listProjectsForExpenses({ includeArchived: false });
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
