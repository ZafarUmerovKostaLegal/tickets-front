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
    timeTrackingInvoiceCreate: '/time-tracking/invoices/new',
    timeTrackingInvoiceDetail: '/time-tracking/invoices/:invoiceId',
    todo: '/todo',
    admin: '/admin',
    networkDriveAccess: '/admin/network-drive',
    userEdit: '/admin/user/:id',
    projectDetail: '/time-tracking/project/:id',
    timesheet: '/timesheet',
    expenses: '/expenses',
    expensesRequests: '/expenses/requests',
    expensesReport: '/expenses/report',
    expensesClients: '/expenses/clients',
    expensesPartners: '/expenses/partners',
    expensesCash: '/expenses/cash',
    expensesPartnersReport: '/expenses/partners/report',
    rules: '/rules',
    help: '/help',
    callSchedule: '/call-schedule',
    correspondence: '/correspondence',
    correspondenceOutgoingCreate: '/correspondence/outgoing/new',
    correspondenceOutgoingPreview: '/correspondence/outgoing/preview',
    accounting: '/accounting',
    kostaLegalAi: '/kosta-legal-ai',
    kostaDaily: '/kosta-daily',
    contacts: '/contacts',
    internalCommunication: '/internal-communication',
};
export function getTicketDetailUrl(uuid) {
    return `/ticket/${uuid}`;
}
export function getUserEditUrl(id) {
    return `/admin/user/${id}`;
}
export function getProjectDetailUrl(projectId, clientId) {
    const base = `/time-tracking/project/${encodeURIComponent(projectId)}`;
    return clientId ? `${base}?client=${encodeURIComponent(clientId)}` : base;
}
export function getTimeTrackingNewProjectUrl(clientId) {
    const base = routes.timeTrackingNewProject;
    if (clientId != null && String(clientId).trim() !== '')
        return `${base}?client=${encodeURIComponent(String(clientId).trim())}`;
    return base;
}
export function getExpensesOpenUrl(expenseId) {
    return `/expenses/${encodeURIComponent(expenseId)}`;
}
export function getInvoiceCreateUrl(opts) {
    const base = routes.timeTrackingInvoiceCreate;
    if (opts?.resume)
        return `${base}?resume=1`;
    return base;
}
export function getInvoiceDetailUrl(invoiceId, opts) {
    const base = `/time-tracking/invoices/${encodeURIComponent(invoiceId)}`;
    if (opts?.variant === 'accounting')
        return `${base}?variant=accounting`;
    return base;
}
export function getInvoicesListUrl(opts) {
    if (opts?.variant === 'accounting')
        return routes.accounting;
    return `${routes.timeTracking}?tab=invoices`;
}
export function getCorrespondenceOutgoingUrl() {
    return `${routes.correspondence}?tab=outgoing`;
}
