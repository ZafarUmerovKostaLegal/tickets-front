import { getClientProject, listAllClientProjectsMerged, listAllTimeManagerClientsMerged, } from '@entities/time-tracking';
import { mapClientProjectToProjectRow } from '@entities/time-tracking/model/mapClientProjectToProjectRow';
export async function loadProjectDetailRow(projectId, clientIdHint) {
    if (clientIdHint) {
        try {
            const clients = await listAllTimeManagerClientsMerged();
            const client = clients.find((row) => row.id === clientIdHint);
            if (client) {
                const project = await getClientProject(clientIdHint, projectId);
                return mapClientProjectToProjectRow(project, client);
            }
        }
        catch {
        }
    }
    const [clients, projects] = await Promise.all([
        listAllTimeManagerClientsMerged(),
        listAllClientProjectsMerged(true),
    ]);
    const project = projects.find((row) => row.id === projectId);
    if (!project)
        return null;
    const client = clients.find((row) => row.id === project.client_id);
    if (!client)
        return null;
    try {
        const full = await getClientProject(client.id, projectId);
        return mapClientProjectToProjectRow(full, client);
    }
    catch {
        return mapClientProjectToProjectRow(project, client);
    }
}
