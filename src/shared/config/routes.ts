export const routes = {
    login: '/',
    home: '/home',
    tickets: '/tickets',
    authCallback: '/auth/callback',
    ticketDetail: '/ticket/:uuid',
    attendance: '/attendance',
    vacationSchedule: '/vacation-schedule',
    inventory: '/inventory',
    timeTracking: '/time-tracking',
    timeTrackingNewProject: '/time-tracking/projects/new',
    timeTrackingReportPreview: '/time-tracking/reports/preview',
    timeTrackingInvoicePreview: '/time-tracking/invoices/preview',
    todo: '/todo',
    admin: '/admin',
    networkDriveAccess: '/admin/network-drive',
    userEdit: '/admin/user/:id',
    projectDetail: '/time-tracking/project/:id',
    timesheet: '/timesheet',
    expenses: '/expenses',
    expensesRequests: '/expenses/requests',
    expensesReport: '/expenses/report',
    rules: '/rules',
    help: '/help',
    callSchedule: '/call-schedule',
    correspondence: '/correspondence',
} as const;
export function getTicketDetailUrl(uuid: string): string {
    return `/ticket/${uuid}`;
}
export function getUserEditUrl(id: number): string {
    return `/admin/user/${id}`;
}
export function getProjectDetailUrl(projectId: string, clientId?: string): string {
    const base = `/time-tracking/project/${encodeURIComponent(projectId)}`;
    return clientId ? `${base}?client=${encodeURIComponent(clientId)}` : base;
}
export function getTimeTrackingNewProjectUrl(clientId?: string | null): string {
    const base = routes.timeTrackingNewProject;
    if (clientId != null && String(clientId).trim() !== '')
        return `${base}?client=${encodeURIComponent(String(clientId).trim())}`;
    return base;
}
export function getExpensesOpenUrl(expenseId: string): string {
    return `/expenses/${encodeURIComponent(expenseId)}`;
}
