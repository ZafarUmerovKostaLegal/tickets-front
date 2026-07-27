import { apiFetch } from '@shared/api';
import { pickAllowedSnapshotOverrides } from '../../lib/reportSnapshotOverrides';
import {
    reportCacheGet,
    reportCacheSet,
} from '../../lib/reportApiCache';
import { buildReportDownloadFilename, reportExportProjectFallback } from '../../lib/reportDownloadFilename';
import { displayReportClientLabel, displayReportProjectLabel } from '../../lib/expenseReportDisplay';
import {
    reportsThrowIfNotOk,
} from './httpShared';
import { listAllTimeManagerClientsMerged, type TimeManagerClientRow } from './clients';
import { listAllClientProjectsMerged, type TimeManagerClientProjectRow } from './projects';

export type ReportTypeIdApi = 'time' | 'contractor' | 'uninvoiced';
export type ReportGroupIdApi = 'tasks' | 'clients' | 'projects' | 'team';
export type ReportSortId = 'date_asc' | 'date_desc' | 'hours_asc' | 'hours_desc';
export type ReportsMeta = {
    reportTypes: ReportTypeIdApi[];
    groupOptions: ReportGroupIdApi[];
    pageSizeMax: number;
    currencies: string[];
};
export type ReportsFilterUser = {
    id: number;
    displayName: string;
    email: string;
    initials?: string | null;
};
export type ReportMoneyAmount = {
    value: number;
    currency: string;
};
export type ReportsSummaryTime = {
    reportType: 'time';
    period: {
        dateFrom: string;
        dateTo: string;
    };
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: ReportMoneyAmount;
    unbilledAmount: ReportMoneyAmount;
};
export type ReportsSummaryContractor = {
    reportType: 'contractor';
    period: {
        dateFrom: string;
        dateTo: string;
    };
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: ReportMoneyAmount;
    contractorHours: number;
    contractorCost: ReportMoneyAmount;
};
export type ReportsSummaryUninvoiced = {
    reportType: 'uninvoiced';
    period: {
        dateFrom: string;
        dateTo: string;
    };
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: ReportMoneyAmount;
    uninvoicedHours: number;
    amountToInvoice: ReportMoneyAmount;
};
export type ReportsSummary = ReportsSummaryTime | ReportsSummaryContractor | ReportsSummaryUninvoiced;
export type ReportsTableParams = {
    reportType: ReportTypeIdApi;
    dateFrom: string;
    dateTo: string;
    group?: ReportGroupIdApi;
    sort?: ReportSortId;
    page?: number;
    pageSize?: number;
    userIds?: number[];
    projectIds?: string[];
    clientIds?: string[];
    includeFixedFeeProjects?: boolean;
};
export type ReportRowAggregate = {
    projectId?: string;
    clientId?: string;
    clientName?: string;
    taskId?: string;
    userId?: number;
    name: string;
    code?: string | null;
    hours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    currency: string;
    invoicedAmount: number;
};
export type ReportTableRow = ReportRowAggregate;
export type ReportsTableResponse = {
    rows: ReportTableRow[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
};
export type ReportSavedViewFilters = Omit<ReportsTableParams, 'page' | 'pageSize'>;
export type ReportSavedView = {
    id: string;
    name: string;
    ownerUserId: number;
    filters: ReportSavedViewFilters;
    createdAt: string;
    updatedAt: string | null;
};
export type ReportSnapshotRow = {
    id: string;
    sortOrder: number;
    sourceType: string;
    sourceId: string;
    data: Record<string, unknown>;
    
    effective?: Record<string, unknown> | null;
    overrides: Record<string, unknown> | null;
    editedByUserId: number | null;
    editedAt: string | null;
};
export type ReportSnapshot = {
    id: string;
    name: string;
    reportType: ReportTypeIdApi;
    groupBy: ReportGroupIdApi | null;
    filters: Record<string, unknown>;
    version: number;
    createdByUserId: number;
    createdAt: string;
    updatedAt: string | null;
    rowCount: number;
    rows?: ReportSnapshotRow[];
};
export function buildReportsQs(params: ReportsTableParams & {
    format?: string;
}): string {
    const qs = new URLSearchParams();
    qs.set('reportType', params.reportType);
    qs.set('dateFrom', params.dateFrom);
    qs.set('dateTo', params.dateTo);
    qs.set('from', params.dateFrom);
    qs.set('to', params.dateTo);
    if (params.group)
        qs.set('group', params.group);
    if (params.sort)
        qs.set('sort', params.sort);
    if (params.page != null)
        qs.set('page', String(params.page));
    if (params.pageSize != null)
        qs.set('pageSize', String(params.pageSize));
    if (params.userIds?.length)
        qs.set('userIds', params.userIds.join(','));
    if (params.projectIds?.length)
        qs.set('projectIds', params.projectIds.join(','));
    if (params.clientIds?.length)
        qs.set('clientIds', params.clientIds.join(','));
    if (params.includeFixedFeeProjects != null)
        qs.set('includeFixedFeeProjects', String(params.includeFixedFeeProjects));
    if (params.format)
        qs.set('format', params.format);
    return qs.toString();
}
export async function fetchReportsMeta(): Promise<ReportsMeta> {
    const res = await apiFetch('/api/v1/time-tracking/reports/meta');
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportsMeta>;
}
export async function fetchReportsUsersForFilter(): Promise<ReportsFilterUser[]> {
    const res = await apiFetch('/api/v1/time-tracking/reports/users-for-filter');
    await reportsThrowIfNotOk(res);
    const raw = (await res.json()) as unknown[];
    return raw.map((item) => {
        const o = item as Record<string, unknown>;
        const id = Number(o.id ?? o.authUserId ?? o.auth_user_id);
        const displayName = String(o.displayName ?? o.display_name ?? '').trim();
        const email = String(o.email ?? '');
        const initialsRaw = o.initials;
        const initials = typeof initialsRaw === 'string' && initialsRaw.trim()
            ? initialsRaw.trim()
            : null;
        return {
            id: Number.isFinite(id) ? id : 0,
            displayName: displayName || email || `user ${id}`,
            email,
            initials,
        };
    }).sort((a, b) => {
        const la = a.displayName.trim() || a.email.trim();
        const lb = b.displayName.trim() || b.email.trim();
        const cmp = la.localeCompare(lb, 'ru', { sensitivity: 'base', numeric: true });
        if (cmp !== 0)
            return cmp;
        return a.email.localeCompare(b.email, 'ru', { sensitivity: 'base', numeric: true });
    });
}
export async function fetchReportsSummary(params: Pick<ReportsTableParams, 'reportType' | 'dateFrom' | 'dateTo' | 'userIds' | 'projectIds' | 'clientIds' | 'includeFixedFeeProjects'>): Promise<ReportsSummary> {
    const qs = buildReportsQs({ ...params, group: undefined, sort: undefined });
    const res = await apiFetch(`/api/v1/time-tracking/reports/summary?${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportsSummary>;
}
export async function fetchReportsTable(params: ReportsTableParams): Promise<ReportsTableResponse> {
    const qs = buildReportsQs(params);
    const res = await apiFetch(`/api/v1/time-tracking/reports/table?${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportsTableResponse>;
}
export async function exportReportsTable(params: ReportsTableParams & {
    format: 'csv' | 'json';
}): Promise<{
    blob: Blob;
    filename: string;
}> {
    const qs = buildReportsQs(params);
    const res = await apiFetch(`/api/v1/time-tracking/reports/table/export?${qs}`);
    await reportsThrowIfNotOk(res);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const filename = cd.split('filename=')[1]?.replace(/"/g, '').trim() || `report.${params.format}`;
    return { blob, filename };
}
export async function listReportSavedViews(ownerUserId?: number): Promise<ReportSavedView[]> {
    const qs = ownerUserId != null ? `?ownerUserId=${ownerUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSavedView[]>;
}
export async function createReportSavedView(body: {
    name: string;
    filters: ReportSavedViewFilters;
}, ownerUserId?: number): Promise<ReportSavedView> {
    const qs = ownerUserId != null ? `?ownerUserId=${ownerUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSavedView>;
}
export async function updateReportSavedView(id: string, body: Partial<{
    name: string;
    filters: ReportSavedViewFilters;
}>): Promise<ReportSavedView> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSavedView>;
}
export async function deleteReportSavedView(id: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reportsThrowIfNotOk(res);
}
export async function listReportSnapshots(createdByUserId?: number): Promise<ReportSnapshot[]> {
    const qs = createdByUserId != null ? `?createdByUserId=${createdByUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot[]>;
}
export async function createReportSnapshot(body: {
    name: string;
    reportType: ReportTypeIdApi;
    groupBy?: ReportGroupIdApi | null;
    filters: ReportSavedViewFilters;
}, createdByUserId?: number): Promise<ReportSnapshot> {
    const qs = createdByUserId != null ? `?createdByUserId=${createdByUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot>;
}
export async function getReportSnapshot(id: string): Promise<ReportSnapshot> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot>;
}
export async function patchReportSnapshotRow(snapshotId: string, rowId: string, overrides: Record<string, unknown>, editedByUserId?: number): Promise<ReportSnapshotRow> {
    const qs = editedByUserId != null ? `?editedByUserId=${editedByUserId}` : '';
    const safe = pickAllowedSnapshotOverrides(overrides);
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(snapshotId)}/rows/${encodeURIComponent(rowId)}${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: safe }),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshotRow>;
}
export async function rebuildReportSnapshot(id: string): Promise<ReportSnapshot> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}/rebuild-from-source`, { method: 'POST' });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot>;
}
export async function deleteReportSnapshot(id: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reportsThrowIfNotOk(res);
}
export async function exportReportSnapshot(id: string, format: 'csv' | 'json'): Promise<{
    blob: Blob;
    filename: string;
}> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}/export?format=${format}`);
    await reportsThrowIfNotOk(res);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const filename = cd.split('filename=')[1]?.replace(/"/g, '').trim() || `snapshot-${id}.${format}`;
    return { blob, filename };
}

export type ReportPagination = {
    page: number;
    per_page: number;
    total_pages: number;
    total_entries: number;
    next_page: number | null;
    previous_page: number | null;
};
export type ReportMeta = {
    report_type: string;
    group_by: string | null;
    from: string;
    to: string;
    generated_at: string;

    totals_all_groups?: ReportTotals | null;
};

export type ReportTotals = {
    total_hours?: number | null;
    billable_hours?: number | null;
    non_billable_hours?: number | null;
    billable_amount?: number | null;
    total_amount?: number | null;
    reimbursable_amount?: number | null;
    uninvoiced_hours?: number | null;
    uninvoiced_amount?: number | null;
    uninvoiced_expenses?: number | null;
    currency?: string | null;

    by_currency?: Array<Record<string, unknown>> | null;
};

export type ReportResponse<T> = {
    results: T[];
    pagination: ReportPagination;
    meta: ReportMeta;

    summary?: ReportTotals | null;

    totals?: ReportTotals | null;
};

export type ReportFiltersV2 = {
    dateFrom: string;
    dateTo: string;
    client_id?: string;
    project_id?: string;
    user_id?: string;
    task_id?: string;
    is_billable?: boolean;
    include_fixed_fee?: boolean;
    page?: number;
    per_page?: number;
    
    pageSizeMax?: number;
    
    confirmed_payment_only?: boolean;
    partner_confirmed_only?: boolean;

    partner_auth_user_id?: number;

    
    team_filter_enabled?: boolean;
    team_filter_partner_auth_user_id?: number;
    team_id?: string;
};

export type TimeReportEntryLogItem = {
    
    id?: string | null;
    work_date: string;
    recorded_at: string;
    hours: number;
    billable_hours?: number | null;
    billable_amount?: number | null;
    
    amount_to_pay?: number | null;
    billable_currency?: string | null;
    billableCurrency?: string | null;
    currency?: string | null;
    task_id?: string | null;
    task_name?: string | null;
    project_id?: string | null;
    project_name?: string | null;
    project_code?: string | null;
    client_id?: string | null;
    client_name?: string | null;
    notes?: string | null;
    description?: string | null;
    is_billable?: boolean | null;
    billable?: boolean | null;
    time_entry_id?: string | null;
    task_billable_by_default?: boolean | null;
    is_invoiced?: boolean | null;
    is_paid?: boolean | null;
    is_week_submitted?: boolean | null;
    employee_name?: string | null;
    employee_initials?: string | null;
    employee_position?: string | null;
    auth_user_id?: number | null;
    billable_rate?: number | null;
    cost_rate?: number | null;
    cost_amount?: number | null;
    external_reference_url?: string | null;
    scope_color?: string | null;
    scopeColor?: string | null;
    invoice_id?: string | null;
    invoice_number?: string | null;
    
    source_entry_count?: number | null;
    voided_at?: string | null;
    voided_by_auth_user_id?: number | null;
    void_kind?: string | null;
    is_voided?: boolean | null;
    
    expense_request_id?: string | null;
    entry_kind?: string | null;
    line_kind?: string | null;
};

export type TimeReportEntryLine = TimeReportEntryLogItem;
export type RUBTime = {
    user_id: number;
    user_name: string;
    initials?: string | null;
    avatar_url: string | null;
    total_hours: number;
    billable_hours: number;
    billable_amount: number;
    currency: string;
    last_recorded_at?: string | null;
    entries?: TimeReportEntryLogItem[];
    entries_total?: number;
    entries_truncated?: boolean;
    
    project_breakdown?: TimeReportEntryLogItem[];
};
export type RUBExpense = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    total_amount: number;
    billable_amount: number;

    status?: string | null;
    expense_status?: string | null;

    project_id?: string | null;
    project_name?: string | null;
};
export type RUBUninvoiced = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    uninvoiced_hours: number;
    uninvoiced_amount: number;
    currency: string;
};
export type RUBBudget = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    hours_logged: number;
    amount_logged: number;
    currency?: string;
};
export type TimeRowClients = {
    client_id: string;
    client_name: string;
    
    report_group_id?: string;
    
    group_currency?: string;
    total_hours: number;
    billable_hours: number;
    currency: string;
    billable_amount: number;
    last_recorded_at?: string | null;
    users: RUBTime[];
};
export type TimeRowProjects = TimeRowClients & {
    project_id: string;
    project_name: string;
};

export type TimeRowTasks = {
    task_id: string;
    task_name: string;
    project_id?: string;
    project_name?: string;
    client_id?: string;
    client_name?: string;
    total_hours: number;
    billable_hours: number;
    currency: string;
    billable_amount: number;
    last_recorded_at?: string | null;
    users: RUBTime[];
};

export type TimeRowTeam = {
    user_id: number;
    user_name: string;
    initials?: string | null;
    avatar_url: string | null;
    is_contractor?: boolean;
    total_hours: number;
    billable_hours: number;
    billable_amount: number;
    currency: string;
    last_recorded_at?: string | null;
};

export type TimeReportRow = TimeRowClients | TimeRowProjects | TimeRowTasks | TimeRowTeam;

export type TimeReportGroupPath = 'clients' | 'projects' | 'tasks' | 'team';
export type ExpRowClients = {
    client_id: string;
    client_name: string;
    total_amount: number;
    billable_amount: number;
    currency: string;
    
    report_group_id?: string;
    group_currency?: string;
    users: RUBExpense[];
};
export type ExpRowProjects = ExpRowClients & {
    project_id: string;
    project_name: string;
};
export type ExpRowCategories = {
    expense_category_id: string | null;
    expense_category_name: string;
    total_amount: number;
    billable_amount: number;
    currency: string;
    users: RUBExpense[];
};
export type ExpRowTeam = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    is_contractor: boolean;
    total_amount: number;
    billable_amount: number;
    currency: string;
};
export type UninvoicedRow = {
    client_id: string;
    client_name: string;
    project_id: string;
    project_name: string;
    currency: string;
    total_hours: number;
    uninvoiced_hours: number;
    uninvoiced_expenses: number;
    uninvoiced_amount: number;
    users: RUBUninvoiced[];
};
export type BudgetRow = {
    client_id: string;
    client_name: string;
    project_id: string;
    project_name: string;
    budget_is_monthly: boolean;
    budget_by: 'none' | 'hours' | 'money' | 'hours_and_money';

    has_budget?: boolean;
    is_active: boolean;
    budget: number;
    budget_spent: number;
    budget_remaining: number;

    progress_percent?: number;
    currency?: string;

    budget_hours_budget?: number;
    budget_hours_spent?: number;
    budget_hours_remaining?: number;

    budget_money_budget?: number;
    budget_money_spent?: number;
    budget_money_remaining?: number;
    users: RUBBudget[];
};
const REPORT_ENTRY_LOG_CAMEL_TO_SNAKE: readonly [
    string,
    string
][] = [
        ['workDate', 'work_date'],
        ['recordedAt', 'recorded_at'],
        ['billableHours', 'billable_hours'],
        ['billableAmount', 'billable_amount'],
        ['taskName', 'task_name'],
        ['taskId', 'task_id'],
        ['taskTitle', 'task_title'],
        ['projectName', 'project_name'],
        ['projectId', 'project_id'],
        ['clientName', 'client_name'],
        ['clientId', 'client_id'],
        ['billableCurrency', 'billable_currency'],
        ['isBillable', 'is_billable'],
        ['timeEntryId', 'time_entry_id'],
        ['workDescription', 'work_description'],
        ['Description', 'description'],
        ['Notes', 'notes'],
        ['Memo', 'memo'],
        ['taskSummary', 'task_summary'],
        ['taskLabel', 'task_label'],
        ['activityName', 'activity_name'],
        ['ticketTitle', 'ticket_title'],
        ['taskBillableByDefault', 'task_billable_by_default'],
        ['isInvoiced', 'is_invoiced'],
        ['isPaid', 'is_paid'],
        ['isWeekSubmitted', 'is_week_submitted'],
        ['employeeName', 'employee_name'],
        ['employeeInitials', 'employee_initials'],
        ['employeePosition', 'employee_position'],
        ['authUserId', 'auth_user_id'],
        ['billableRate', 'billable_rate'],
        ['amountToPay', 'amount_to_pay'],
        ['costRate', 'cost_rate'],
        ['costAmount', 'cost_amount'],
        ['externalReferenceUrl', 'external_reference_url'],
        ['scopeColor', 'scope_color'],
        ['invoiceId', 'invoice_id'],
        ['invoiceNumber', 'invoice_number'],
        ['projectCode', 'project_code'],
        ['sourceEntryCount', 'source_entry_count'],
        ['voidedAt', 'voided_at'],
        ['voidedByAuthUserId', 'voided_by_auth_user_id'],
        ['voidKind', 'void_kind'],
        ['isVoided', 'is_voided'],
        ['expenseRequestId', 'expense_request_id'],
        ['expenseId', 'expense_id'],
        ['entryKind', 'entry_kind'],
        ['lineKind', 'line_kind'],
    ];
export const REPORT_ENTRY_LOG_NEST_KEYS = [
    'time_entry',
    'timeEntry',
    'entry',
    'payload',
    'item',
    'record',
    'data',
    'meta',
] as const;
export function mergeReportEntryNestedFields(merged: Record<string, unknown>): void {
    for (const nk of REPORT_ENTRY_LOG_NEST_KEYS) {
        const inner = merged[nk];
        if (inner == null || typeof inner !== 'object' || Array.isArray(inner))
            continue;
        const rec = inner as Record<string, unknown>;
        for (const [k, v] of Object.entries(rec)) {
            if (v === undefined)
                continue;
            const cur = merged[k];
            const curEmpty = cur === undefined ||
                cur === null ||
                cur === '' ||
                (typeof cur === 'string' && !String(cur).trim());
            if (curEmpty)
                merged[k] = v;
        }
        delete merged[nk];
    }
}

export function reportJsonSnakeScalarEmpty(v: unknown): boolean {
    if (v === undefined || v === null)
        return true;
    if (typeof v === 'string' && !v.trim())
        return true;
    return false;
}
export function coerceReportNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}
export function parseReportHoursField(v: unknown): number | undefined {
    const n = coerceReportNumber(v);
    if (n !== undefined)
        return n;
    if (typeof v === 'string' && v.includes(':')) {
        const parts = v.split(':').map((x) => parseInt(x.trim(), 10));
        const hh = parts[0];
        const mm = parts[1] ?? 0;
        if (Number.isFinite(hh) && Number.isFinite(mm))
            return hh + mm / 60;
    }
    return undefined;
}
export function normalizeReportEntryLogItem(entry: unknown): unknown {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry))
        return entry;
    const merged: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    mergeReportEntryNestedFields(merged);
    for (const [camel, snake] of REPORT_ENTRY_LOG_CAMEL_TO_SNAKE) {
        if (Object.prototype.hasOwnProperty.call(merged, camel)) {
            if (reportJsonSnakeScalarEmpty(merged[snake]))
                merged[snake] = merged[camel];
            delete merged[camel];
        }
    }
    const hoursParsed = parseReportHoursField(merged.hours ?? merged.duration);
    if (hoursParsed !== undefined)
        merged.hours = hoursParsed;
    delete merged.duration;
    const bh = coerceReportNumber(merged.billable_hours);
    if (bh !== undefined)
        merged.billable_hours = bh;
    const ba = coerceReportNumber(merged.billable_amount);
    if (ba !== undefined)
        merged.billable_amount = ba;
    const pickStr = (key: string): string | undefined => {
        const v = merged[key];
        return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const notes0 = pickStr('notes');
    const desc0 = pickStr('description');
    const altText = pickStr('note') ??
        pickStr('comment') ??
        pickStr('memo') ??
        pickStr('message') ??
        pickStr('body') ??
        pickStr('work_description') ??
        pickStr('activity_notes') ??
        pickStr('public_notes') ??
        pickStr('private_notes') ??
        pickStr('narrative') ??
        pickStr('details');
    if (!notes0 && !desc0 && altText) {
        merged.notes = altText;
        merged.description = altText;
    }
    else {
        if (!notes0 && desc0)
            merged.notes = desc0;
        if (!desc0 && notes0)
            merged.description = notes0;
        if (!notes0 && typeof merged.note === 'string' && merged.note.trim())
            merged.notes = merged.note.trim();
        if (!desc0 && typeof merged.comment === 'string' && merged.comment.trim()) {
            merged.description = merged.comment.trim();
        }
    }
    delete merged.note;
    delete merged.comment;
    delete merged.memo;
    delete merged.message;
    delete merged.body;
    delete merged.activity_notes;
    delete merged.work_description;
    delete merged.public_notes;
    delete merged.private_notes;
    delete merged.narrative;
    if (typeof merged.details === 'string')
        delete merged.details;
    if (!merged.task_name && typeof merged.task_title === 'string' && merged.task_title.trim()) {
        merged.task_name = merged.task_title.trim();
    }
    delete merged.task_title;
    if (!merged.task_name && typeof merged.task_summary === 'string' && merged.task_summary.trim()) {
        merged.task_name = merged.task_summary.trim();
    }
    delete merged.task_summary;
    if (!merged.task_name && typeof merged.task_label === 'string' && merged.task_label.trim()) {
        merged.task_name = merged.task_label.trim();
    }
    delete merged.task_label;
    if (!merged.task_name && typeof merged.activity_name === 'string' && merged.activity_name.trim()) {
        merged.task_name = merged.activity_name.trim();
    }
    delete merged.activity_name;
    if (!merged.task_name && typeof merged.ticket_title === 'string' && merged.ticket_title.trim()) {
        merged.task_name = merged.ticket_title.trim();
    }
    delete merged.ticket_title;
    const proj = merged.project;
    if (proj && typeof proj === 'object' && !Array.isArray(proj)) {
        const rec = proj as Record<string, unknown>;
        if (!merged.project_name) {
            const pn = rec.name ?? rec.project_name ?? rec.title;
            if (typeof pn === 'string' && pn.trim())
                merged.project_name = pn;
        }
        if (!merged.project_id) {
            const pid = rec.id ?? rec.project_id ?? rec.projectId;
            if (pid != null && String(pid).trim())
                merged.project_id = String(pid).trim();
        }
    }
    delete merged.project;
    const task = merged.task;
    if (!merged.task_name && typeof task === 'string' && task.trim()) {
        merged.task_name = task.trim();
    }
    else if (!merged.task_name && task && typeof task === 'object' && !Array.isArray(task)) {
        const rec = task as Record<string, unknown>;
        const tn = rec.name ?? rec.task_name ?? rec.title ?? rec.label;
        if (typeof tn === 'string' && tn.trim())
            merged.task_name = tn.trim();
    }
    delete merged.task;
    const cli = merged.client;
    if (cli && typeof cli === 'object' && !Array.isArray(cli)) {
        const rec = cli as Record<string, unknown>;
        if (!merged.client_name) {
            const cn = rec.name ?? rec.client_name ?? rec.title;
            if (typeof cn === 'string' && cn.trim())
                merged.client_name = cn;
        }
        if (!merged.client_id) {
            const cid = rec.id ?? rec.client_id ?? rec.clientId;
            if (cid != null && String(cid).trim())
                merged.client_id = String(cid).trim();
        }
    }
    delete merged.client;
    const ib = merged.is_billable;
    if (ib !== undefined && ib !== null && typeof ib !== 'boolean') {
        const s = String(ib).trim().toLowerCase();
        merged.is_billable = s === 'true' || s === '1' || s === 'yes' || s === 'on';
    }
    const entryId = merged.id ?? merged.time_entry_id;
    if (entryId != null && String(entryId).trim() !== '') {
        const sid = String(entryId).trim();
        merged.time_entry_id = sid;
        merged.id = sid;
    }
    for (const nk of ['amount_to_pay', 'billable_rate', 'cost_rate', 'cost_amount']) {
        const c = coerceReportNumber(merged[nk]);
        if (c !== undefined)
            merged[nk] = c;
    }
    const sec = coerceReportNumber(merged.source_entry_count);
    if (sec !== undefined)
        merged.source_entry_count = Math.max(0, Math.round(sec));
    const auid = coerceReportNumber(merged.auth_user_id);
    if (auid !== undefined)
        merged.auth_user_id = Math.round(auid);
    return merged;
}
const REPORT_V2_CAMEL_TO_SNAKE: readonly [
    string,
    string
][] = [
        ['totalHours', 'total_hours'],
        ['billableHours', 'billable_hours'],
        ['billableAmount', 'billable_amount'],
        ['clientId', 'client_id'],
        ['clientName', 'client_name'],
        ['projectId', 'project_id'],
        ['projectName', 'project_name'],
        ['taskId', 'task_id'],
        ['taskName', 'task_name'],
        ['taskTitle', 'task_name'],
        ['userId', 'user_id'],
        ['userName', 'user_name'],
        ['initials', 'initials'],
        ['avatarUrl', 'avatar_url'],
        ['weeklyCapacity', 'weekly_capacity'],
        ['isContractor', 'is_contractor'],
        ['totalAmount', 'total_amount'],
        ['expenseCategoryId', 'expense_category_id'],
        ['expenseCategoryName', 'expense_category_name'],
        ['uninvoicedHours', 'uninvoiced_hours'],
        ['uninvoicedAmount', 'uninvoiced_amount'],
        ['uninvoicedExpenses', 'uninvoiced_expenses'],
        ['budgetIsMonthly', 'budget_is_monthly'],
        ['budgetBy', 'budget_by'],
        ['hasBudget', 'has_budget'],
        ['isActive', 'is_active'],
        ['budgetAmount', 'budget'],
        ['budgetSpent', 'budget_spent'],
        ['budgetRemaining', 'budget_remaining'],
        ['progressPercent', 'progress_percent'],
        ['budgetHoursBudget', 'budget_hours_budget'],
        ['budgetHoursSpent', 'budget_hours_spent'],
        ['budgetHoursRemaining', 'budget_hours_remaining'],
        ['budgetMoneyBudget', 'budget_money_budget'],
        ['budgetMoneySpent', 'budget_money_spent'],
        ['budgetMoneyRemaining', 'budget_money_remaining'],
        ['hoursLogged', 'hours_logged'],
        ['amountLogged', 'amount_logged'],
        ['entriesTotal', 'entries_total'],
        ['entriesTruncated', 'entries_truncated'],
        ['projectBreakdown', 'project_breakdown'],
        ['reportGroupId', 'report_group_id'],
        ['groupCurrency', 'group_currency'],
        ['expenseStatus', 'expense_status'],
        ['workflowStatus', 'workflow_status'],
    ];

export function scrubExpenseReportAggregateRow(merged: Record<string, unknown>): void {
    if (!Array.isArray(merged.users))
        return;
    if ('total_hours' in merged || 'uninvoiced_hours' in merged)
        return;
    const ta = coerceReportNumber(merged.total_amount);
    const ba = coerceReportNumber(merged.billable_amount);
    if (ta === undefined && ba === undefined)
        return;
    if ('hours_logged' in merged && 'amount_logged' in merged && !('total_amount' in merged))
        return;
    if ('client_id' in merged)
        merged.client_id = merged.client_id == null || merged.client_id === '' ? '' : String(merged.client_id).trim();
    if ('project_id' in merged)
        merged.project_id = merged.project_id == null || merged.project_id === '' ? '' : String(merged.project_id).trim();
    if ('client_name' in merged)
        merged.client_name = merged.client_name == null ? '' : String(merged.client_name).trim();
    if ('project_name' in merged)
        merged.project_name = merged.project_name == null ? '' : String(merged.project_name).trim();
    if ('expense_category_name' in merged)
        merged.expense_category_name = merged.expense_category_name == null ? '' : String(merged.expense_category_name).trim();
}

export function scrubRubExpenseRollupUser(merged: Record<string, unknown>): Record<string, unknown> {
    const uid = merged.user_id;
    const hasUser = uid != null && (typeof uid === 'number' || typeof uid === 'string');
    if (!hasUser || 'total_hours' in merged)
        return merged;
    const hasExpenseAmounts = coerceReportNumber(merged.total_amount) !== undefined
        || coerceReportNumber(merged.billable_amount) !== undefined;
    if (!hasExpenseAmounts)
        return merged;
    merged.user_name = merged.user_name == null ? '' : String(merged.user_name).trim();
    const st = merged.status ?? merged.expense_status ?? merged.workflow_status;
    if (st != null && String(st).trim())
        merged.status = String(st).trim();
    return merged;
}

export function normalizeReportV2RowDeep(row: unknown): unknown {
    if (row == null || typeof row !== 'object')
        return row;
    if (Array.isArray(row))
        return row.map(normalizeReportV2RowDeep);
    const merged: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const [camel, snake] of REPORT_V2_CAMEL_TO_SNAKE) {
        if (Object.prototype.hasOwnProperty.call(merged, camel)) {
            if (reportJsonSnakeScalarEmpty(merged[snake]))
                merged[snake] = merged[camel];
            delete merged[camel];
        }
    }
    const projRow = merged.project;
    if (projRow && typeof projRow === 'object' && !Array.isArray(projRow)) {
        const rec = projRow as Record<string, unknown>;
        if (reportJsonSnakeScalarEmpty(merged.project_name)) {
            const pn = rec.name ?? rec.project_name ?? rec.title ?? rec.projectName;
            if (typeof pn === 'string' && pn.trim())
                merged.project_name = pn.trim();
        }
        if (reportJsonSnakeScalarEmpty(merged.project_id)) {
            const pid = rec.id ?? rec.project_id ?? rec.projectId;
            if (pid != null && String(pid).trim())
                merged.project_id = String(pid).trim();
        }
    }
    delete merged.project;
    const cliRow = merged.client;
    if (cliRow && typeof cliRow === 'object' && !Array.isArray(cliRow)) {
        const rec = cliRow as Record<string, unknown>;
        if (reportJsonSnakeScalarEmpty(merged.client_name)) {
            const cn = rec.name ?? rec.client_name ?? rec.title ?? rec.clientName;
            if (typeof cn === 'string' && cn.trim())
                merged.client_name = cn.trim();
        }
        if (reportJsonSnakeScalarEmpty(merged.client_id)) {
            const cid = rec.id ?? rec.client_id ?? rec.clientId;
            if (cid != null && String(cid).trim())
                merged.client_id = String(cid).trim();
        }
    }
    delete merged.client;
    const taskRow = merged.task;
    if (taskRow && typeof taskRow === 'object' && !Array.isArray(taskRow)) {
        const rec = taskRow as Record<string, unknown>;
        if (reportJsonSnakeScalarEmpty(merged.task_name)) {
            const tn = rec.name ?? rec.task_name ?? rec.title ?? rec.taskName ?? rec.label;
            if (typeof tn === 'string' && tn.trim())
                merged.task_name = tn.trim();
        }
        if (reportJsonSnakeScalarEmpty(merged.task_id)) {
            const tid = rec.id ?? rec.task_id ?? rec.taskId;
            if (tid != null && String(tid).trim())
                merged.task_id = String(tid).trim();
        }
    }
    delete merged.task;
    if (reportJsonSnakeScalarEmpty(merged.task_name) && !reportJsonSnakeScalarEmpty(merged.task_id)) {
        for (const k of ['task_title', 'activity_name', 'title', 'label']) {
            const v = merged[k];
            if (typeof v === 'string' && v.trim()) {
                merged.task_name = v.trim();
                delete merged[k];
                break;
            }
        }
    }
    if (Array.isArray(merged.users)) {
        merged.users = merged.users.map((u) => normalizeReportV2RowDeep(u));
    }
    if (Array.isArray(merged.entries)) {
        merged.entries = merged.entries.map((e) => normalizeReportEntryLogItem(e));
    }
    if (Array.isArray(merged.project_breakdown)) {
        merged.project_breakdown = merged.project_breakdown.map((e) => normalizeReportEntryLogItem(e)) as unknown[];
    }
    scrubExpenseReportAggregateRow(merged);
    return scrubRubExpenseRollupUser(merged);
}

export function parseReportTotals(raw: unknown): ReportTotals | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const r = raw as Record<string, unknown>;
    const num = (k1: string, k2?: string): number | null => {
        const v = r[k1] ?? (k2 ? r[k2] : undefined);
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const str = (k1: string, k2?: string): string | null => {
        const v = r[k1] ?? (k2 ? r[k2] : undefined);
        return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    const byCur = r.by_currency ?? r.byCurrency;
    return {
        total_hours: num('total_hours', 'totalHours'),
        billable_hours: num('billable_hours', 'billableHours'),
        non_billable_hours: num('non_billable_hours', 'nonBillableHours'),
        billable_amount: num('billable_amount', 'billableAmount'),
        total_amount: num('total_amount', 'totalAmount'),
        reimbursable_amount: num('reimbursable_amount', 'reimbursableAmount'),
        uninvoiced_hours: num('uninvoiced_hours', 'uninvoicedHours'),
        uninvoiced_amount: num('uninvoiced_amount', 'uninvoicedAmount'),
        uninvoiced_expenses: num('uninvoiced_expenses', 'uninvoicedExpenses'),
        currency: str('currency'),
        by_currency: Array.isArray(byCur) ? byCur as Array<Record<string, unknown>> : null,
    };
}

export function normalizeReportV2Response<T>(data: ReportResponse<T>): ReportResponse<T> {
    const p = data.pagination as unknown as Record<string, unknown>;
    const pagination: ReportPagination = {
        page: Number(p?.page ?? 1),
        per_page: Number(p?.per_page ?? p?.perPage ?? 100),
        total_pages: Number(p?.total_pages ?? p?.totalPages ?? 1),
        total_entries: Number(p?.total_entries ?? p?.totalEntries ?? 0),
        next_page: (p?.next_page ?? p?.nextPage ?? null) as number | null,
        previous_page: (p?.previous_page ?? p?.previousPage ?? null) as number | null,
    };
    const m = data.meta as unknown as Record<string, unknown>;
    const rawTotalsAllGroups = m?.totals_all_groups ?? m?.totalsAllGroups
        ?? (data as unknown as Record<string, unknown>).totals_all_groups
        ?? (data as unknown as Record<string, unknown>).totalsAllGroups;
    const meta: ReportMeta = {
        report_type: String(m?.report_type ?? m?.reportType ?? ''),
        group_by: (m?.group_by ?? m?.groupBy ?? null) as string | null,
        from: String(m?.from ?? m?.date_from ?? m?.dateFrom ?? ''),
        to: String(m?.to ?? m?.date_to ?? m?.dateTo ?? ''),
        generated_at: String(m?.generated_at ?? m?.generatedAt ?? ''),
        totals_all_groups: parseReportTotals(rawTotalsAllGroups),
    };
    const rawSummary = (data as unknown as Record<string, unknown>).summary
        ?? m?.summary;
    const rawTotals = (data as unknown as Record<string, unknown>).totals
        ?? m?.totals;
    return {
        ...data,
        pagination,
        meta,
        summary: parseReportTotals(rawSummary),
        totals: parseReportTotals(rawTotals),
        results: (data.results ?? []).map((r) => normalizeReportV2RowDeep(r)) as T[],
    };
}
export function buildReportV2Qs(filters: ReportFiltersV2): string {
    const p = new URLSearchParams();
    p.set('dateFrom', filters.dateFrom);
    p.set('dateTo', filters.dateTo);
    p.set('from', filters.dateFrom);
    p.set('to', filters.dateTo);
    const clientId = filters.client_id?.trim();
    if (clientId)
        p.set('client_id', clientId);
    const projectId = filters.project_id?.trim();
    if (projectId)
        p.set('project_id', projectId);
    const uidParam = filters.user_id?.trim();
    if (uidParam)
        p.set('user_id', uidParam);
    const tid = filters.task_id?.trim();
    if (tid)
        p.set('task_id', tid);
    if (filters.is_billable !== undefined)
        p.set('is_billable', String(filters.is_billable));
    if (filters.include_fixed_fee === false)
        p.set('include_fixed_fee', 'false');
    if (filters.confirmed_payment_only === true)
        p.set('confirmed_payment_only', 'true');
    if (filters.partner_confirmed_only === true)
        p.set('partnerConfirmedOnly', 'true');
    if (filters.partner_auth_user_id != null && filters.partner_auth_user_id > 0)
        p.set('partner_auth_user_id', String(filters.partner_auth_user_id));
    p.set('page', String(filters.page ?? 1));
    const cap = filters.pageSizeMax != null && filters.pageSizeMax > 0
        ? Math.min(filters.pageSizeMax, 5000)
        : 500;
    const pp = Math.min(Math.max(filters.per_page ?? 100, 1), cap);
    p.set('per_page', String(pp));
    return p.toString();
}
export async function fetchTimeReport(groupBy: TimeReportGroupPath, filters: ReportFiltersV2): Promise<ReportResponse<TimeReportRow>> {
    const qs = buildReportV2Qs(filters);
    const cacheKey = `time/${groupBy}?${qs}`;
    const cached = reportCacheGet<ReportResponse<TimeReportRow>>(cacheKey);
    if (cached) return cached;
    const res = await apiFetch(`/api/v1/time-tracking/reports/time/${groupBy}?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<TimeReportRow>;
    const result = normalizeReportV2Response(data);
    reportCacheSet(cacheKey, result);
    return result;
}
export function reportV2ListChunkSize(filters: { pageSizeMax?: number }): number {
    const c = filters.pageSizeMax != null && filters.pageSizeMax > 0
        ? Math.min(filters.pageSizeMax, 5000)
        : 500;
    return Math.min(500, c);
}
export async function fetchAllTimeReportPagesForGroup<T>(groupBy: TimeReportGroupPath, filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<T[]> {
    const maxIter = Math.min(Math.max(options?.maxPages ?? 250, 1), 500);
    const out: T[] = [];
    let page = 1;
    const perChunk = reportV2ListChunkSize(filters);
    for (let i = 0; i < maxIter; i++) {
        const data = await fetchTimeReport(groupBy, { ...filters, page, per_page: perChunk } as ReportFiltersV2);
        out.push(...(data.results as T[]));
        const np = data.pagination.next_page;
        if (np == null || page >= data.pagination.total_pages)
            break;
        page = np;
    }
    return out;
}
export function fetchAllTimeReportClientRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<TimeRowClients[]> {
    return fetchAllTimeReportPagesForGroup<TimeRowClients>('clients', filters, options);
}
export function fetchAllTimeReportProjectRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<TimeRowProjects[]> {
    return fetchAllTimeReportPagesForGroup<TimeRowProjects>('projects', filters, options);
}
export function fetchAllTimeReportTaskRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<TimeRowTasks[]> {
    return fetchAllTimeReportPagesForGroup<TimeRowTasks>('tasks', filters, options);
}
export function fetchAllTimeReportTeamRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<TimeRowTeam[]> {
    return fetchAllTimeReportPagesForGroup<TimeRowTeam>('team', filters, options);
}
export async function fetchAllPagedReportRows<T>(fetchPage: (page: number, perPage: number) => Promise<ReportResponse<T>>, options?: {
    maxPages?: number;
    perPage?: number;
}): Promise<T[]> {
    const maxIter = Math.min(Math.max(options?.maxPages ?? 250, 1), 500);
    const perPage = Math.min(Math.max(options?.perPage ?? 500, 1), 500);
    const out: T[] = [];
    let page = 1;
    for (let i = 0; i < maxIter; i++) {
        const data = await fetchPage(page, perPage);
        out.push(...data.results);
        const np = data.pagination.next_page;
        if (np == null || page >= data.pagination.total_pages)
            break;
        page = np;
    }
    return out;
}
export async function fetchAllExpenseReportRows(groupBy: 'clients' | 'projects' | 'categories' | 'team', filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<ExpRowClients[] | ExpRowProjects[] | ExpRowCategories[] | ExpRowTeam[]> {
    const perPage = reportV2ListChunkSize(filters);
    const rows = await fetchAllPagedReportRows<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>((page, perPg) => fetchExpenseReport(groupBy, { ...filters, page, per_page: perPg } as ReportFiltersV2), { ...options, perPage });
    return rows as ExpRowClients[] | ExpRowProjects[] | ExpRowCategories[] | ExpRowTeam[];
}
export async function fetchAllUninvoicedReportRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<UninvoicedRow[]> {
    const perPage = reportV2ListChunkSize(filters);
    return fetchAllPagedReportRows((page, perPg) => fetchUninvoicedReport({ ...filters, page, per_page: perPg } as ReportFiltersV2), { ...options, perPage });
}
export async function fetchAllBudgetReportRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<BudgetRow[]> {
    const perPage = reportV2ListChunkSize(filters);
    return fetchAllPagedReportRows((page, perPg) => fetchBudgetReport({ ...filters, page, per_page: perPg } as ReportFiltersV2), { ...options, perPage });
}
export async function fetchExpenseReport(groupBy: 'clients' | 'projects' | 'categories' | 'team', filters: ReportFiltersV2): Promise<ReportResponse<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>> {
    const qs = buildReportV2Qs(filters);
    const cacheKey = `expenses/${groupBy}?${qs}`;
    const cached = reportCacheGet<ReportResponse<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>>(cacheKey);
    if (cached) return cached;
    const res = await apiFetch(`/api/v1/time-tracking/reports/expenses/${groupBy}?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>;
    const result = normalizeReportV2Response(data);
    reportCacheSet(cacheKey, result);
    return result;
}
export async function fetchUninvoicedReport(filters: ReportFiltersV2): Promise<ReportResponse<UninvoicedRow>> {
    const qs = buildReportV2Qs(filters);
    const cacheKey = `uninvoiced?${qs}`;
    const cached = reportCacheGet<ReportResponse<UninvoicedRow>>(cacheKey);
    if (cached) return cached;
    const res = await apiFetch(`/api/v1/time-tracking/reports/uninvoiced?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<UninvoicedRow>;
    const result = normalizeReportV2Response(data);
    reportCacheSet(cacheKey, result);
    return result;
}
export function coerceBudgetReportNumeric(v: unknown): number | undefined {
    if (v == null || v === '')
        return undefined;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : undefined;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}

export function finalizeBudgetReportRow(row: BudgetRow): BudgetRow {
    const raw = row as Record<string, unknown>;
    const nestedBudget = raw.budget && typeof raw.budget === 'object' && !Array.isArray(raw.budget)
        ? raw.budget as Record<string, unknown>
        : null;
    const byRaw = String(row.budget_by ?? raw.budgetBy ?? nestedBudget?.budgetBy ?? '').toLowerCase().replace(/-/g, '_');
    let budget_by: BudgetRow['budget_by'] = 'none';
    if (byRaw === 'hours')
        budget_by = 'hours';
    else if (byRaw === 'money')
        budget_by = 'money';
    else if (byRaw === 'hours_and_money' || byRaw === 'hoursandmoney')
        budget_by = 'hours_and_money';
    const hb = coerceBudgetReportNumeric(raw.budget_hours_budget) ??
        coerceBudgetReportNumeric(raw.budgetHoursBudget) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_hours_budget) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetHoursBudget);
    const hs = coerceBudgetReportNumeric(raw.budget_hours_spent) ??
        coerceBudgetReportNumeric(raw.budgetHoursSpent) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_hours_spent) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetHoursSpent);
    const hr = coerceBudgetReportNumeric(raw.budget_hours_remaining) ??
        coerceBudgetReportNumeric(raw.budgetHoursRemaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_hours_remaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetHoursRemaining);
    const mb = coerceBudgetReportNumeric(raw.budget_money_budget) ??
        coerceBudgetReportNumeric(raw.budgetMoneyBudget) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_money_budget) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetMoneyBudget);
    const ms = coerceBudgetReportNumeric(raw.budget_money_spent) ??
        coerceBudgetReportNumeric(raw.budgetMoneySpent) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_money_spent) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetMoneySpent);
    const mr = coerceBudgetReportNumeric(raw.budget_money_remaining) ??
        coerceBudgetReportNumeric(raw.budgetMoneyRemaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_money_remaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetMoneyRemaining);
    const budgetAmount = coerceBudgetReportNumeric(raw.budgetAmount) ??
        coerceBudgetReportNumeric(raw.budget_amount) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetAmount) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_amount) ??
        coerceBudgetReportNumeric(raw.budget);
    const budgetSpent = coerceBudgetReportNumeric(raw.budgetSpent) ??
        coerceBudgetReportNumeric(raw.budget_spent_amount) ??
        coerceBudgetReportNumeric(raw.budget_spent) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetSpent) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_spent_amount) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_spent);
    const budgetRemaining = coerceBudgetReportNumeric(raw.budgetRemaining) ??
        coerceBudgetReportNumeric(raw.budget_remaining_amount) ??
        coerceBudgetReportNumeric(raw.budget_remaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetRemaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_remaining_amount) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_remaining);
    const progressPercent = coerceBudgetReportNumeric(raw.progressPercent) ??
        coerceBudgetReportNumeric(raw.progress_percent) ??
        coerceBudgetReportNumeric(nestedBudget?.progressPercent) ??
        coerceBudgetReportNumeric(nestedBudget?.progress_percent);
    if (budget_by === 'none') {
        const hasHoursAxis = Number.isFinite(hb) || Number.isFinite(hs) || Number.isFinite(hr);
        const hasMoneyAxis = Number.isFinite(mb) || Number.isFinite(ms) || Number.isFinite(mr)
            || Number.isFinite(budgetAmount) || Number.isFinite(budgetSpent) || Number.isFinite(budgetRemaining);
        budget_by = hasHoursAxis && hasMoneyAxis
            ? 'hours_and_money'
            : hasHoursAxis
                ? 'hours'
                : hasMoneyAxis
                    ? 'money'
                    : 'none';
    }
    const explicitHas = raw.has_budget ?? raw.hasBudget;
    const has_budget = explicitHas === true
        ? true
        : explicitHas === false
            ? false
            : budget_by !== 'none' && (
                (Number.isFinite(budgetAmount) && (budgetAmount as number) > 0)
                || (Number.isFinite(hb) && (hb as number) > 0)
                || (Number.isFinite(mb) && (mb as number) > 0)
            );
    return {
        ...row,
        budget_by,
        has_budget,
        ...(budgetAmount !== undefined ? { budget: budgetAmount } : {}),
        ...(budgetSpent !== undefined ? { budget_spent: budgetSpent } : {}),
        ...(budgetRemaining !== undefined ? { budget_remaining: budgetRemaining } : {}),
        ...(progressPercent !== undefined ? { progress_percent: progressPercent } : {}),
        ...(hb !== undefined ? { budget_hours_budget: hb } : {}),
        ...(hs !== undefined ? { budget_hours_spent: hs } : {}),
        ...(hr !== undefined ? { budget_hours_remaining: hr } : {}),
        ...(mb !== undefined ? { budget_money_budget: mb } : {}),
        ...(ms !== undefined ? { budget_money_spent: ms } : {}),
        ...(mr !== undefined ? { budget_money_remaining: mr } : {}),
    };
}
export async function fetchBudgetReport(filters: ReportFiltersV2): Promise<ReportResponse<BudgetRow>> {
    const qs = buildReportV2Qs(filters);
    const cacheKey = `project-budget?${qs}`;
    const cached = reportCacheGet<ReportResponse<BudgetRow>>(cacheKey);
    if (cached) return cached;
    const res = await apiFetch(`/api/v1/time-tracking/reports/project-budget?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<BudgetRow>;
    const norm = normalizeReportV2Response(data);
    const result = {
        ...norm,
        results: norm.results.map((r) => finalizeBudgetReportRow(r as BudgetRow)),
    };
    reportCacheSet(cacheKey, result);
    return result;
}
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export async function resolveReportExportDownloadFilename(
    reportType: 'time' | 'expenses' | 'uninvoiced' | 'project-budget',
    groupBy: string | null,
    filters: ReportFiltersV2,
    ext: string,
    exportOpts?: ReportExportOptions,
): Promise<string> {
    if (exportOpts?.downloadFilename?.trim())
        return exportOpts.downloadFilename.trim();

    let clientName = exportOpts?.clientName?.trim() ?? '';
    let projectName = exportOpts?.projectName?.trim() ?? '';
    const clientId = filters.client_id?.trim() ?? '';
    const projectId = filters.project_id?.trim() ?? '';

    if ((!clientName || !projectName) && (clientId || projectId)) {
        try {
            const needClients = Boolean((clientId && !clientName) || (projectId && !clientName));
            const needProjects = Boolean(projectId && !projectName);
            const [clients, projects] = await Promise.all([
                needClients ? listAllTimeManagerClientsMerged(true) : Promise.resolve([] as TimeManagerClientRow[]),
                needProjects ? listAllClientProjectsMerged(true) : Promise.resolve([] as TimeManagerClientProjectRow[]),
            ]);
            const projectRow = projectId ? projects.find((project) => project.id === projectId) : undefined;
            if (!projectName && projectRow?.name?.trim())
                projectName = projectRow.name.trim();
            if (!clientName && clientId) {
                const clientRow = clients.find((client) => client.id === clientId);
                if (clientRow?.name?.trim())
                    clientName = clientRow.name.trim();
            }
            if (!clientName && projectRow?.client_id?.trim()) {
                const projectClientId = projectRow.client_id.trim();
                const clientRow = clients.find((client) => client.id === projectClientId);
                if (clientRow?.name?.trim())
                    clientName = clientRow.name.trim();
                else if (!clientName)
                    clientName = displayReportClientLabel('', projectClientId);
            }
        }
        catch {
            // keep partial labels
        }
    }

    if (!clientName)
        clientName = clientId ? displayReportClientLabel('', clientId) : 'Все клиенты';
    if (!projectName)
        projectName = projectId ? displayReportProjectLabel('', projectId) : reportExportProjectFallback(reportType, groupBy);

    return buildReportDownloadFilename({
        clientName,
        projectName,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        extension: ext,
    });
}
export type ReportExportOptions = {
    timeExport?: 'detail' | 'summary';
    clientName?: string;
    projectName?: string;
    downloadFilename?: string;
};
export async function exportReportV2(reportType: 'time' | 'expenses' | 'uninvoiced' | 'project-budget', groupBy: string | null, filters: ReportFiltersV2, format: 'csv' | 'xlsx', exportOpts?: ReportExportOptions): Promise<void> {
    const apiSegment = reportType;
    const mergedFilters: ReportFiltersV2 = filters;
    const base = '/api/v1/time-tracking/reports';
    const path = groupBy ? `/${apiSegment}/${groupBy}/export` : `/${apiSegment}/export`;
    const p = new URLSearchParams();
    p.set('format', format);
    p.set('dateFrom', mergedFilters.dateFrom);
    p.set('dateTo', mergedFilters.dateTo);
    p.set('from', mergedFilters.dateFrom);
    p.set('to', mergedFilters.dateTo);
    if (reportType === 'time' && exportOpts?.timeExport)
        p.set('export', exportOpts.timeExport);
    if (mergedFilters.client_id?.trim())
        p.set('client_id', mergedFilters.client_id.trim());
    if (mergedFilters.project_id?.trim())
        p.set('project_id', mergedFilters.project_id.trim());
    const uidExport = mergedFilters.user_id?.trim();
    if (uidExport)
        p.set('user_id', uidExport);
    if (mergedFilters.task_id?.trim())
        p.set('task_id', mergedFilters.task_id.trim());
    if (mergedFilters.is_billable !== undefined)
        p.set('is_billable', String(mergedFilters.is_billable));
    if (mergedFilters.include_fixed_fee === false)
        p.set('include_fixed_fee', 'false');
    if (mergedFilters.confirmed_payment_only === true)
        p.set('confirmed_payment_only', 'true');
    const accept = format === 'xlsx'
        ? `${XLSX_MIME}, application/octet-stream, */*`
        : 'text/csv, text/plain, application/octet-stream, */*';
    const res = await apiFetch(`${base}${path}?${p.toString()}`, {
        headers: { Accept: accept },
    });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = (await res.clone().json()) as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch {
            try {
                const t = await res.text();
                if (t && t.length < 500)
                    msg = t;
            }
            catch { }
        }
        throw new Error(msg);
    }
    const buf = await res.arrayBuffer();
    const ctRaw = res.headers.get('content-type') ?? '';
    const ctLower = ctRaw.toLowerCase();
    if (ctLower.includes('application/json') || ctLower.includes('text/html')) {
        const t = new TextDecoder('utf-8').decode(buf);
        let msg = 'Сервер вернул ответ без файла';
        try {
            const j = JSON.parse(t) as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch {
            if (t.length < 600)
                msg = t;
        }
        throw new Error(msg);
    }
    if (format === 'xlsx' && buf.byteLength > 0) {
        const sig = new Uint8Array(buf.slice(0, 4));
        const isZip = sig[0] === 0x50 && sig[1] === 0x4b && (sig[2] === 0x03 || sig[2] === 0x05 || sig[2] === 0x07);
        if (!isZip) {
            const t = new TextDecoder('utf-8').decode(buf);
            if (t.trimStart().startsWith('{')) {
                let detail = 'Ошибка выгрузки Excel';
                try {
                    const j = JSON.parse(t) as {
                        detail?: string;
                    };
                    if (j.detail)
                        detail = j.detail;
                }
                catch { }
                throw new Error(detail);
            }
            throw new Error('Ответ сервера не похож на файл Excel (.xlsx). Проверьте, что бэкенд отдаёт XLSX для format=xlsx.');
        }
    }
    let mime = format === 'xlsx' ? XLSX_MIME : 'text/csv;charset=utf-8';
    if (format === 'xlsx' && ctLower.includes('spreadsheet')) {
        mime = ctRaw.split(';')[0].trim();
    }
    else if (format === 'csv' && ctLower.includes('text/csv')) {
        mime = `${ctRaw.split(';')[0].trim()};charset=utf-8`;
    }
    const blob = new Blob([buf], { type: mime });
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const resolvedFilename = await resolveReportExportDownloadFilename(reportType, groupBy, mergedFilters, ext, exportOpts);
    const filename = resolvedFilename.toLowerCase().endsWith(`.${ext}`)
        ? resolvedFilename
        : `${resolvedFilename.replace(/\.(csv|xlsx|xls)$/i, '')}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
