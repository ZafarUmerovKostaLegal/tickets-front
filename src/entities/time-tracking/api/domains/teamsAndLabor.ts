import { apiFetch } from '@shared/api';
import { throwIfNotOk } from './httpShared';
import { readTimeTrackingUserStr } from './usersAndRates';

export type TeamWorkloadSummary = {
    total_hours: string | number;
    team_capacity_hours: string | number;
    team_weekly_capacity_hours?: string | number;
    billable_hours: string | number;
    non_billable_hours: string | number;
    team_workload_percent: number;
};
export type TeamWorkloadMember = {
    auth_user_id: number;
    display_name?: string | null;
    email: string;
    picture?: string | null;
    capacity_hours: string | number;
    total_hours: string | number;
    billable_hours: string | number;
    non_billable_hours: string | number;
    workload_percent: number;
    active_entry_count?: number;
    reporting_week_submitted?: boolean;
};
export type TeamWorkloadResponse = {
    date_from: string;
    date_to: string;
    period_days: number;
    summary: TeamWorkloadSummary;
    members: TeamWorkloadMember[];
    project_id?: string | null;
    client_id?: string | null;
    project_name?: string | null;
};
export function normalizeTeamWorkloadMember(raw: unknown): TeamWorkloadMember | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const uid = Number(o.auth_user_id ?? o.authUserId);
    if (!Number.isFinite(uid) || uid <= 0)
        return null;
    const num = (v: unknown): string | number => {
        if (typeof v === 'number' || typeof v === 'string')
            return v;
        return 0;
    };
    return {
        auth_user_id: uid,
        display_name: (o.display_name ?? o.displayName) as string | null | undefined,
        email: String(o.email ?? ''),
        picture: (o.picture as string | null | undefined) ?? null,
        capacity_hours: num(o.capacity_hours ?? o.capacityHours),
        total_hours: num(o.total_hours ?? o.totalHours),
        billable_hours: num(o.billable_hours ?? o.billableHours),
        non_billable_hours: num(o.non_billable_hours ?? o.nonBillableHours),
        workload_percent: Number(o.workload_percent ?? o.workloadPercent ?? 0),
        active_entry_count: Number(o.active_entry_count ?? o.activeEntryCount ?? 0) || 0,
        reporting_week_submitted: Boolean(o.reporting_week_submitted ?? o.reportingWeekSubmitted),
    };
}
export function normalizeTeamWorkloadResponse(raw: unknown): TeamWorkloadResponse {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const membersRaw = Array.isArray(o.members) ? o.members : [];
    const summary = (o.summary && typeof o.summary === 'object' ? o.summary : {}) as TeamWorkloadSummary;
    return {
        date_from: String(o.date_from ?? o.dateFrom ?? ''),
        date_to: String(o.date_to ?? o.dateTo ?? ''),
        period_days: Number(o.period_days ?? o.periodDays ?? 0),
        summary,
        members: membersRaw.map(normalizeTeamWorkloadMember).filter((m): m is TeamWorkloadMember => m != null),
        project_id: (o.project_id ?? o.projectId) as string | null | undefined,
        client_id: (o.client_id ?? o.clientId) as string | null | undefined,
        project_name: (o.project_name ?? o.projectName) as string | null | undefined,
    };
}
export async function getTeamWorkload(from: string, to: string, options?: {
    includeArchived?: boolean;
}): Promise<TeamWorkloadResponse> {
    const qs = new URLSearchParams({ from, to });
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const res = await apiFetch(`/api/v1/time-tracking/team-workload?${qs}`);
    await throwIfNotOk(res);
    const result = normalizeTeamWorkloadResponse(await res.json());
    return result;
}

export async function getProjectTeamWorkload(clientId: string, projectId: string, from: string, to: string, options?: {
    includeArchived?: boolean;
}): Promise<TeamWorkloadResponse> {
    const qs = new URLSearchParams({ from, to });
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/team-workload?${qs}`);
    await throwIfNotOk(res);
    return (await res.json()) as TeamWorkloadResponse;
}

export type TimeTrackingTeamMemberPreview = {
    auth_user_id: number;
    display_name?: string | null;
    email: string;
};

export type TimeTrackingTeamRow = {
    id: string;
    name: string;
    partner_auth_user_id: number;
    partner_display_name?: string | null;
    member_auth_user_ids: number[];
    members?: TimeTrackingTeamMemberPreview[];
    is_archived: boolean;
    created_at?: string;
    updated_at?: string | null;
};

export type TimeTrackingTeamCreatePayload = {
    name: string;
    partnerAuthUserId: number;
    memberAuthUserIds: number[];
};

export type TimeTrackingTeamPatchPayload = {
    name?: string;
    partnerAuthUserId?: number;
    memberAuthUserIds?: number[];
    isArchived?: boolean;
};

export function normalizeTimeTrackingTeamMemberPreview(raw: unknown): TimeTrackingTeamMemberPreview | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const auth_user_id = Number(o.auth_user_id ?? o.authUserId);
    if (!Number.isFinite(auth_user_id) || auth_user_id <= 0)
        return null;
    const email = readTimeTrackingUserStr(o.email) ?? '';
    return {
        auth_user_id,
        email,
        display_name: readTimeTrackingUserStr(o.display_name) ?? readTimeTrackingUserStr(o.displayName),
    };
}

export function normalizeTimeTrackingTeamRow(raw: unknown): TimeTrackingTeamRow | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = o.id != null ? String(o.id).trim() : '';
    if (!id)
        return null;
    const name = readTimeTrackingUserStr(o.name) ?? '';
    const partner_auth_user_id = Number(o.partner_auth_user_id ?? o.partnerAuthUserId);
    if (!Number.isFinite(partner_auth_user_id) || partner_auth_user_id <= 0)
        return null;
    const memberRaw = o.member_auth_user_ids ?? o.memberAuthUserIds ?? o.members;
    let member_auth_user_ids: number[] = [];
    if (Array.isArray(memberRaw)) {
        if (memberRaw.length > 0 && memberRaw[0] != null && typeof memberRaw[0] === 'object') {
            const members = memberRaw
                .map((item) => normalizeTimeTrackingTeamMemberPreview(item))
                .filter((x): x is TimeTrackingTeamMemberPreview => x != null);
            member_auth_user_ids = members.map((m) => m.auth_user_id);
        }
        else {
            member_auth_user_ids = memberRaw
                .map((v) => Number(v))
                .filter((n) => Number.isFinite(n) && n > 0);
        }
    }
    const members = Array.isArray(o.members)
        ? o.members.map((item) => normalizeTimeTrackingTeamMemberPreview(item)).filter((x): x is TimeTrackingTeamMemberPreview => x != null)
        : undefined;
    return {
        id,
        name,
        partner_auth_user_id,
        partner_display_name: readTimeTrackingUserStr(o.partner_display_name) ?? readTimeTrackingUserStr(o.partnerDisplayName),
        member_auth_user_ids,
        members,
        is_archived: o.is_archived === true || o.isArchived === true,
        created_at: readTimeTrackingUserStr(o.created_at) ?? readTimeTrackingUserStr(o.createdAt) ?? undefined,
        updated_at: readTimeTrackingUserStr(o.updated_at) ?? readTimeTrackingUserStr(o.updatedAt),
    };
}

export function parseTimeTrackingTeamsResponse(raw: unknown): TimeTrackingTeamRow[] {
    let arr: unknown[] = [];
    if (Array.isArray(raw))
        arr = raw;
    else if (raw && typeof raw === 'object') {
        const o = raw as { items?: unknown[]; data?: unknown[] };
        if (Array.isArray(o.items))
            arr = o.items;
        else if (Array.isArray(o.data))
            arr = o.data;
    }
    return arr.map((item) => normalizeTimeTrackingTeamRow(item)).filter((x): x is TimeTrackingTeamRow => x != null);
}

export async function listTimeTrackingTeams(options?: { includeArchived?: boolean }): Promise<TimeTrackingTeamRow[]> {
    const qs = options?.includeArchived ? '?include_archived=true' : '';
    const res = await apiFetch(`/api/v1/time-tracking/teams${qs}`);
    await throwIfNotOk(res);
    return parseTimeTrackingTeamsResponse(await res.json());
}

export async function createTimeTrackingTeam(body: TimeTrackingTeamCreatePayload): Promise<TimeTrackingTeamRow> {
    const name = body.name.trim();
    if (!name)
        throw new Error('Укажите название команды');
    const res = await apiFetch('/api/v1/time-tracking/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            partnerAuthUserId: body.partnerAuthUserId,
            memberAuthUserIds: body.memberAuthUserIds,
        }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingTeamRow(await res.json());
    if (!row)
        throw new Error('Некорректный ответ сервера');
    return row;
}

export async function patchTimeTrackingTeam(teamId: string, patch: TimeTrackingTeamPatchPayload): Promise<TimeTrackingTeamRow> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name.trim();
    if (patch.partnerAuthUserId !== undefined)
        payload.partnerAuthUserId = patch.partnerAuthUserId;
    if (patch.memberAuthUserIds !== undefined)
        payload.memberAuthUserIds = patch.memberAuthUserIds;
    if (patch.isArchived !== undefined)
        payload.isArchived = patch.isArchived;
    const res = await apiFetch(`/api/v1/time-tracking/teams/${encodeURIComponent(teamId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingTeamRow(await res.json());
    if (!row)
        throw new Error('Некорректный ответ сервера');
    return row;
}

export async function deleteTimeTrackingTeam(teamId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/teams/${encodeURIComponent(teamId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}

export type LaborStatisticsFilterOption = { id: string; name: string; email?: string; client_id?: string };

export type LaborStatisticsMeta = {
    partners: LaborStatisticsFilterOption[];
    teams: LaborStatisticsFilterOption[];
    clients: LaborStatisticsFilterOption[];
    projects: Array<LaborStatisticsFilterOption & { client_id?: string }>;
    work_types: LaborStatisticsFilterOption[];
    lawyers: LaborStatisticsFilterOption[];
    project_statuses: LaborStatisticsFilterOption[];
};

export type LaborStatisticsKpiApi = {
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    paid_amount: number;
    paid_currency: string;
    rate_per_hour: number;
    billable_amount: number;
    billable_currency: string;
    accrued_rate_per_hour: number;
};

export type LaborStatisticsStackedChartRow = {
    id: string;
    name: string;
    billable_hours: number;
    non_billable_hours: number;
};

export type LaborStatisticsTeamFinanceRow = {
    team_id: string;
    team_name: string;
    hours: number;
    billable_hours: number;
    billable_amount: number;
    paid_amount: number;
    currency: string;
};

export type LaborStatisticsChartsApi = {
    hours_by_day: Array<{ date: string; date_label: string; billable_hours: number; total_hours: number }>;
    by_users: LaborStatisticsStackedChartRow[];
    by_projects: LaborStatisticsStackedChartRow[];
    by_clients: LaborStatisticsStackedChartRow[];
    by_project_status: LaborStatisticsStackedChartRow[];
    by_teams: LaborStatisticsStackedChartRow[];
    by_work_type: Array<{ name: string; value: number; hours: number }>;
    hours_by_project_ranking: Array<{ name: string; value: number; hours: number }>;
    hours_by_task: Array<{ name: string; value: number; hours: number }>;
    hours_vs_payment: Array<{ name: string; hours: number; payment: number; billable_amount?: number; currency: string }>;
    payment_efficiency_ranking: Array<{ name: string; hours: number; payment: number; billable_amount?: number; rate_per_hour: number; currency: string }>;
    by_teams_finance: LaborStatisticsTeamFinanceRow[];
};

export type LaborStatisticsDetailRowApi = {
    id: string;
    partner_id: string;
    partner_name: string;
    partner_initials: string;
    team_id: string;
    team_name: string;
    lawyer_id: string;
    lawyer_name: string;
    lawyer_initials: string;
    client_id: string;
    client_name: string;
    project_id: string;
    project_name: string;
    project_active: boolean;
    project_status_id: string;
    project_status: string;
    task_id: string;
    task_name: string;
    work_type_id: string;
    work_type: string;
    period_from: string;
    period_to: string;
    period_label: string;
    hours: number;
    billable_hours: number;
    billable_amount: number;
    payment: number;
    currency: string;
};

export type LaborStatisticsResponse = {
    kpi: LaborStatisticsKpiApi;
    detail: { rows: LaborStatisticsDetailRowApi[]; total: number; page: number; per_page: number };
    charts: LaborStatisticsChartsApi;
};

export function normalizeLaborMetaOption(raw: unknown): LaborStatisticsFilterOption | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = o.id != null ? String(o.id).trim() : '';
    const name = o.name != null ? String(o.name).trim() : '';
    if (!id || !name)
        return null;
    const email = o.email != null ? String(o.email) : undefined;
    const client_id = o.client_id != null
        ? String(o.client_id)
        : o.clientId != null
            ? String(o.clientId)
            : undefined;
    return { id, name, email, client_id };
}

export function metaList(o: Record<string, unknown>, snake: string, camel: string): LaborStatisticsFilterOption[] {
    const raw = Array.isArray(o[snake]) ? o[snake] : Array.isArray(o[camel]) ? o[camel] : [];
    return (raw as unknown[])
        .map((item) => normalizeLaborMetaOption(item))
        .filter((x): x is LaborStatisticsFilterOption => x != null);
}

export function normalizeLaborStatisticsMeta(raw: unknown): LaborStatisticsMeta {
    const empty: LaborStatisticsMeta = {
        partners: [],
        teams: [],
        clients: [],
        projects: [],
        work_types: [],
        lawyers: [],
        project_statuses: [],
    };
    if (raw == null || typeof raw !== 'object')
        return empty;
    const o = raw as Record<string, unknown>;
    return {
        partners: metaList(o, 'partners', 'partners'),
        teams: metaList(o, 'teams', 'teams'),
        clients: metaList(o, 'clients', 'clients'),
        projects: metaList(o, 'projects', 'projects'),
        work_types: metaList(o, 'work_types', 'workTypes'),
        lawyers: metaList(o, 'lawyers', 'lawyers'),
        project_statuses: metaList(o, 'project_statuses', 'projectStatuses'),
    };
}

export function strField(o: Record<string, unknown>, snake: string, camel?: string): string {
    const v = o[snake] ?? (camel ? o[camel] : undefined);
    return v != null ? String(v).trim() : '';
}

export function normalizeLaborStatisticsDetailRow(raw: unknown): LaborStatisticsDetailRowApi | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = strField(o, 'id');
    if (!id)
        return null;
    return {
        id,
        partner_id: strField(o, 'partner_id', 'partnerId'),
        partner_name: strField(o, 'partner_name', 'partnerName'),
        partner_initials: strField(o, 'partner_initials', 'partnerInitials'),
        team_id: strField(o, 'team_id', 'teamId'),
        team_name: strField(o, 'team_name', 'teamName'),
        lawyer_id: strField(o, 'lawyer_id', 'lawyerId'),
        lawyer_name: strField(o, 'lawyer_name', 'lawyerName'),
        lawyer_initials: strField(o, 'lawyer_initials', 'lawyerInitials'),
        client_id: strField(o, 'client_id', 'clientId'),
        client_name: strField(o, 'client_name', 'clientName'),
        project_id: strField(o, 'project_id', 'projectId'),
        project_name: strField(o, 'project_name', 'projectName'),
        project_active: o.project_active === true || o.projectActive === true,
        project_status_id: strField(o, 'project_status_id', 'projectStatusId'),
        project_status: strField(o, 'project_status', 'projectStatus'),
        task_id: strField(o, 'task_id', 'taskId'),
        task_name: strField(o, 'task_name', 'taskName'),
        work_type_id: strField(o, 'work_type_id', 'workTypeId'),
        work_type: strField(o, 'work_type', 'workType'),
        period_from: strField(o, 'period_from', 'periodFrom'),
        period_to: strField(o, 'period_to', 'periodTo'),
        period_label: strField(o, 'period_label', 'periodLabel'),
        hours: num(o.hours),
        billable_hours: num(o.billable_hours ?? o.billableHours),
        billable_amount: num(o.billable_amount ?? o.billableAmount),
        payment: num(o.payment),
        currency: strField(o, 'currency') || 'USD',
    };
}

export function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function normalizeLaborStatisticsStackedChartRow(raw: unknown): LaborStatisticsStackedChartRow | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const name = strField(o, 'name');
    if (!name)
        return null;
    const id = strField(o, 'id')
        || strField(o, 'lawyer_id', 'lawyerId')
        || strField(o, 'project_id', 'projectId')
        || strField(o, 'client_id', 'clientId')
        || strField(o, 'project_status_id', 'projectStatusId')
        || strField(o, 'team_id', 'teamId')
        || strField(o, 'user_id', 'userId')
        || name;
    return {
        id,
        name,
        billable_hours: num(o.billable_hours ?? o.billableHours),
        non_billable_hours: num(o.non_billable_hours ?? o.nonBillableHours),
    };
}

export function chartStackedList(chartsRaw: Record<string, unknown>, snake: string, camel: string): LaborStatisticsStackedChartRow[] {
    const raw = Array.isArray(chartsRaw[snake]) ? chartsRaw[snake] : Array.isArray(chartsRaw[camel]) ? chartsRaw[camel] : [];
    return (raw as unknown[])
        .map((item) => normalizeLaborStatisticsStackedChartRow(item))
        .filter((x): x is LaborStatisticsStackedChartRow => x != null);
}

export function normalizeLaborStatisticsResponse(raw: unknown): LaborStatisticsResponse {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const kpiRaw = (o.kpi && typeof o.kpi === 'object' ? o.kpi : {}) as Record<string, unknown>;
    const detailRaw = (o.detail && typeof o.detail === 'object' ? o.detail : {}) as Record<string, unknown>;
    const chartsRaw = (o.charts && typeof o.charts === 'object' ? o.charts : {}) as Record<string, unknown>;
    const rowsRaw = Array.isArray(detailRaw.rows) ? detailRaw.rows : [];
    const rows = rowsRaw
        .map((item) => normalizeLaborStatisticsDetailRow(item))
        .filter((x): x is LaborStatisticsDetailRowApi => x != null);
    const chartList = <T,>(key: string): T[] => (Array.isArray(chartsRaw[key]) ? chartsRaw[key] as T[] : []);
    return {
        kpi: {
            total_hours: num(kpiRaw.total_hours ?? kpiRaw.totalHours),
            billable_hours: num(kpiRaw.billable_hours ?? kpiRaw.billableHours),
            non_billable_hours: num(kpiRaw.non_billable_hours ?? kpiRaw.nonBillableHours),
            paid_amount: num(kpiRaw.paid_amount ?? kpiRaw.paidAmount),
            paid_currency: String(kpiRaw.paid_currency ?? kpiRaw.paidCurrency ?? 'USD'),
            rate_per_hour: num(kpiRaw.rate_per_hour ?? kpiRaw.ratePerHour),
            billable_amount: num(kpiRaw.billable_amount ?? kpiRaw.billableAmount),
            billable_currency: String(kpiRaw.billable_currency ?? kpiRaw.billableCurrency ?? kpiRaw.paid_currency ?? kpiRaw.paidCurrency ?? 'USD'),
            accrued_rate_per_hour: num(kpiRaw.accrued_rate_per_hour ?? kpiRaw.accruedRatePerHour),
        },
        detail: {
            rows,
            total: num(detailRaw.total),
            page: Math.max(1, num(detailRaw.page) || 1),
            per_page: Math.max(1, num(detailRaw.per_page) || 50),
        },
        charts: {
            hours_by_day: chartList('hours_by_day').length
                ? chartList('hours_by_day')
                : chartList('hoursByDay'),
            by_users: chartStackedList(chartsRaw, 'by_users', 'byUsers'),
            by_projects: chartStackedList(chartsRaw, 'by_projects', 'byProjects'),
            by_clients: chartStackedList(chartsRaw, 'by_clients', 'byClients'),
            by_project_status: chartStackedList(chartsRaw, 'by_project_status', 'byProjectStatus'),
            by_teams: chartStackedList(chartsRaw, 'by_teams', 'byTeams'),
            by_work_type: chartList('by_work_type').length ? chartList('by_work_type') : chartList('byWorkType'),
            hours_by_project_ranking: chartList('hours_by_project_ranking').length
                ? chartList('hours_by_project_ranking')
                : chartList('hoursByProjectRanking'),
            hours_by_task: chartList('hours_by_task').length ? chartList('hours_by_task') : chartList('hoursByTask'),
            hours_vs_payment: chartList('hours_vs_payment').length
                ? chartList('hours_vs_payment')
                : chartList('hoursVsPayment'),
            payment_efficiency_ranking: chartList('payment_efficiency_ranking').length
                ? chartList('payment_efficiency_ranking')
                : chartList('paymentEfficiencyRanking'),
            by_teams_finance: normalizeTeamFinanceList(chartsRaw),
        },
    };
}

export function normalizeTeamFinanceList(chartsRaw: Record<string, unknown>): LaborStatisticsTeamFinanceRow[] {
    const raw = Array.isArray(chartsRaw.by_teams_finance)
        ? chartsRaw.by_teams_finance
        : Array.isArray(chartsRaw.byTeamsFinance)
            ? chartsRaw.byTeamsFinance
            : [];
    return (raw as unknown[]).map((item) => {
        const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
            team_id: strField(o, 'team_id', 'teamId'),
            team_name: strField(o, 'team_name', 'teamName') || '—',
            hours: num(o.hours),
            billable_hours: num(o.billable_hours ?? o.billableHours),
            billable_amount: num(o.billable_amount ?? o.billableAmount),
            paid_amount: num(o.paid_amount ?? o.paidAmount),
            currency: strField(o, 'currency') || 'USD',
        };
    });
}

export type LaborStatisticsQuery = {
    dateFrom: string;
    dateTo: string;
    partnerId?: string;
    teamId?: string;
    clientId?: string;
    projectId?: string;
    workTypeId?: string;
    lawyerId?: string;
    projectStatusId?: string;
    activeProjectsOnly?: boolean;
    q?: string;
    sort?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    perPage?: number;
};

export function laborStatisticsQueryParams(q: LaborStatisticsQuery): URLSearchParams {
    const p = new URLSearchParams();
    p.set('date_from', q.dateFrom);
    p.set('date_to', q.dateTo);
    if (q.partnerId?.trim())
        p.set('partner_id', q.partnerId.trim());
    if (q.teamId?.trim())
        p.set('team_id', q.teamId.trim());
    if (q.clientId?.trim())
        p.set('client_id', q.clientId.trim());
    if (q.projectId?.trim())
        p.set('project_id', q.projectId.trim());
    if (q.workTypeId?.trim())
        p.set('work_type_id', q.workTypeId.trim());
    if (q.lawyerId?.trim())
        p.set('lawyer_id', q.lawyerId.trim());
    if (q.projectStatusId?.trim())
        p.set('project_status_id', q.projectStatusId.trim());
    if (q.activeProjectsOnly)
        p.set('active_projects_only', 'true');
    if (q.q?.trim())
        p.set('q', q.q.trim());
    if (q.sort?.trim())
        p.set('sort', q.sort.trim());
    if (q.sortDir)
        p.set('sort_dir', q.sortDir);
    if (q.page != null)
        p.set('page', String(q.page));
    if (q.perPage != null)
        p.set('per_page', String(Math.min(Math.max(q.perPage, 1), 200)));
    return p;
}

export async function fetchLaborStatisticsMeta(): Promise<LaborStatisticsMeta> {
    const res = await apiFetch('/api/v1/time-tracking/statistics/labor/meta');
    await throwIfNotOk(res);
    return normalizeLaborStatisticsMeta(await res.json());
}

export async function fetchLaborStatistics(query: LaborStatisticsQuery): Promise<LaborStatisticsResponse> {
    const p = laborStatisticsQueryParams(query);
    const res = await apiFetch(`/api/v1/time-tracking/statistics/labor?${p.toString()}`);
    await throwIfNotOk(res);
    return normalizeLaborStatisticsResponse(await res.json());
}

export const LABOR_DETAIL_PAGE_SIZE = 200;
export const LABOR_DETAIL_MAX_PAGES = 50;

export async function fetchAllLaborStatisticsDetailRows(
    query: LaborStatisticsQuery,
    initial?: LaborStatisticsResponse,
): Promise<LaborStatisticsDetailRowApi[]> {
    const perPage = Math.min(Math.max(query.perPage ?? LABOR_DETAIL_PAGE_SIZE, 1), LABOR_DETAIL_PAGE_SIZE);
    const baseQuery = { ...query, perPage };

    const first = initial ?? await fetchLaborStatistics({ ...baseQuery, page: 1 });
    let rows = [...first.detail.rows];
    const total = first.detail.total;
    if (rows.length >= total)
        return rows;

    let page = 2;
    while (rows.length < total && page <= LABOR_DETAIL_MAX_PAGES) {
        try {
            const data = await fetchLaborStatistics({ ...baseQuery, page });
            rows = rows.concat(data.detail.rows);
            if (data.detail.rows.length < perPage)
                break;
        } catch {
            break;
        }
        page += 1;
    }
    return rows;
}

export async function exportLaborStatistics(query: LaborStatisticsQuery, format: 'csv' | 'xlsx'): Promise<void> {
    const p = laborStatisticsQueryParams({ ...query, page: undefined, perPage: undefined });
    p.set('format', format);
    const accept = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*'
        : 'text/csv, text/plain, application/octet-stream, */*';
    const res = await apiFetch(`/api/v1/time-tracking/statistics/labor/export?${p.toString()}`, {
        headers: { Accept: accept },
    });
    await throwIfNotOk(res);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(cd);
    const filename = match?.[1] ?? `labor_statistics_${query.dateFrom}_${query.dateTo}.${format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
