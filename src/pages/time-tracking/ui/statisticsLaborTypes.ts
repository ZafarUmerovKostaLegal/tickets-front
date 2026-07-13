export type StatisticsLaborFilters = {
    partnerId: string;
    teamId: string;
    clientId: string;
    projectId: string;
    workTypeId: string;
    lawyerId: string;
    projectStatusId: string;
    dateFrom: string;
    dateTo: string;
    activeProjectsOnly: boolean;
};

export type StatisticsLaborDetailRow = {
    id: string;
    partner_id: string;
    partner_name: string;
    team_id: string;
    team_name: string;
    lawyer_id: string;
    lawyer_name: string;
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

export type StatisticsLaborKpi = {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    paidAmount: number;
    paidCurrency: string;
    ratePerHour: number;
    billableAmount: number;
    billableCurrency: string;
    accruedRatePerHour: number;
};

export type StatisticsLaborScope = {
    mode: 'all' | 'partner' | 'lawyer';
    partnerId?: string;
    lawyerId?: string;
};

export type StatisticsLaborSortKey =
    | 'partner_name'
    | 'team_name'
    | 'lawyer_name'
    | 'client_name'
    | 'project_name'
    | 'task_name'
    | 'work_type'
    | 'period_label'
    | 'hours'
    | 'billable_amount'
    | 'payment'
    | 'rate';

export type StatisticsLaborSort = {
    key: StatisticsLaborSortKey;
    dir: 'asc' | 'desc';
};

export type StatisticsSubTab = 'project' | 'team' | 'user' | 'finance';

export const STATISTICS_SUB_TABS: StatisticsSubTab[] = ['project', 'team', 'user', 'finance'];

export function parseStatisticsSubTab(raw: string | null | undefined): StatisticsSubTab {
    const v = (raw || '').trim().toLowerCase();
    if (v === 'project' || v === 'team' || v === 'user' || v === 'finance')
        return v;
    return 'user';
}
