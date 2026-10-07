import { listAllClientProjectsMerged, listAllTimeManagerClientsMerged, listProjectsForExpenses, } from '../api';
export function enrichPartnerReportClientNamesFromRows(clientNamesById, rows) {
    for (const row of rows) {
        const clientId = String(row.clientId ?? '').trim();
        const clientName = String(row.clientName ?? '').trim();
        if (clientId && clientName)
            clientNamesById.set(clientId, clientName);
    }
}
function addExpenseProjectsToLookups(clientNamesById, clientMetaByProjectId, expenseProjects) {
    for (const project of expenseProjects) {
        const projectId = String(project.id ?? '').trim();
        if (!projectId)
            continue;
        const clientId = String(project.clientId ?? '').trim();
        const clientName = String(project.clientName ?? '').trim();
        if (clientId && clientName)
            clientNamesById.set(clientId, clientName);
        clientMetaByProjectId.set(projectId, { clientId, clientName });
    }
}
export async function loadPartnerReportDisplayLookups() {
    const [projectRows, clients, expenseProjects] = await Promise.all([
        listAllClientProjectsMerged(true),
        listAllTimeManagerClientsMerged(true),
        listProjectsForExpenses({ includeArchived: true }),
    ]);
    const clientNamesById = new Map();
    for (const client of clients) {
        const id = String(client.id ?? '').trim();
        const name = String(client.name ?? '').trim();
        if (id && name)
            clientNamesById.set(id, name);
    }
    const clientMetaByProjectId = new Map();
    addExpenseProjectsToLookups(clientNamesById, clientMetaByProjectId, Array.isArray(expenseProjects) ? expenseProjects : []);
    return { projectRows, clientNamesById, clientMetaByProjectId };
}
