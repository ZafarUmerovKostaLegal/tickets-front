import {
    listAllClientProjectsMerged,
    listAllTimeManagerClientsMerged,
    listProjectsForExpenses,
    type PartnerReportConfirmationRequest,
    type TimeManagerClientProjectRow,
    type TimeTrackingProjectForExpense,
} from '../api';

export type PartnerReportClientMeta = {
    clientId: string;
    clientName: string;
};

export type PartnerReportDisplayLookups = {
    projectRows: TimeManagerClientProjectRow[];
    clientNamesById: Map<string, string>;
    clientMetaByProjectId: Map<string, PartnerReportClientMeta>;
};

export function enrichPartnerReportClientNamesFromRows(
    clientNamesById: Map<string, string>,
    rows: readonly PartnerReportConfirmationRequest[],
): void {
    for (const row of rows) {
        const clientId = String(row.clientId ?? '').trim();
        const clientName = String(row.clientName ?? '').trim();
        if (clientId && clientName)
            clientNamesById.set(clientId, clientName);
    }
}

function addExpenseProjectsToLookups(
    clientNamesById: Map<string, string>,
    clientMetaByProjectId: Map<string, PartnerReportClientMeta>,
    expenseProjects: readonly TimeTrackingProjectForExpense[],
): void {
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

export async function loadPartnerReportDisplayLookups(): Promise<PartnerReportDisplayLookups> {
    const [projectRows, clients, expenseProjects] = await Promise.all([
        listAllClientProjectsMerged(true),
        listAllTimeManagerClientsMerged(true),
        listProjectsForExpenses({ includeArchived: true }),
    ]);
    const clientNamesById = new Map<string, string>();
    for (const client of clients) {
        const id = String(client.id ?? '').trim();
        const name = String(client.name ?? '').trim();
        if (id && name)
            clientNamesById.set(id, name);
    }
    const clientMetaByProjectId = new Map<string, PartnerReportClientMeta>();
    addExpenseProjectsToLookups(
        clientNamesById,
        clientMetaByProjectId,
        Array.isArray(expenseProjects) ? expenseProjects : [],
    );
    return { projectRows, clientNamesById, clientMetaByProjectId };
}
