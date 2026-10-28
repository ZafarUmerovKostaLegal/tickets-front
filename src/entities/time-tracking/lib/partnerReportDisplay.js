import { displayReportClientLabel, displayReportProjectLabel } from './expenseReportDisplay';
import { getSnapshotRowDisplayData } from './reportSnapshotOverrides';
function pickRecordStr(source, keys) {
    for (const key of keys) {
        const value = source[key];
        if (value != null && String(value).trim())
            return String(value).trim();
    }
    return '';
}
export function partnerReportTitleProjectFallback(title, dateFrom, dateTo) {
    const trimmed = title.trim();
    if (!trimmed)
        return '';
    const df = dateFrom.slice(0, 10);
    const dt = dateTo.slice(0, 10);
    if (df && dt) {
        const suffixHyphen = ` ${df}-${dt}`;
        if (trimmed.endsWith(suffixHyphen))
            return trimmed.slice(0, -suffixHyphen.length).trim();
        const escapedFrom = df.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedTo = dt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rangeRe = new RegExp(`\\s+${escapedFrom}[\\s—–-]+${escapedTo}$`);
        const rangeMatch = trimmed.match(rangeRe);
        if (rangeMatch?.index != null)
            return trimmed.slice(0, rangeMatch.index).trim();
    }
    const compactRange = trimmed.match(/^(.+?)\s+\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}$/);
    if (compactRange)
        return compactRange[1].trim();
    return trimmed;
}
function readRowDisplayFields(row) {
    return {
        projectName: String(row.projectName ?? '').trim(),
        clientName: String(row.clientName ?? '').trim(),
        clientId: String(row.clientId ?? '').trim(),
    };
}
function readSnapshotRowNames(rows) {
    if (!rows?.length)
        return { projectName: '', clientName: '' };
    for (const row of rows) {
        const data = getSnapshotRowDisplayData(row);
        const projectName = pickRecordStr(data, ['projectName', 'project_name']);
        const clientName = pickRecordStr(data, ['clientName', 'client_name']);
        if (projectName || clientName)
            return { projectName, clientName };
    }
    return { projectName: '', clientName: '' };
}
export function buildPartnerReportDisplayMetaFromSnapshot(snapshot, row) {
    const filters = snapshot.filters ?? {};
    const fromRows = readSnapshotRowNames(snapshot.rows);
    const clientId = pickRecordStr(filters, ['client_id', 'clientId']);
    const projectName = fromRows.projectName
        || partnerReportTitleProjectFallback(row.title, row.dateFrom, row.dateTo)
        || String(row.projectName ?? '').trim();
    const clientName = fromRows.clientName || String(row.clientName ?? '').trim();
    return { projectName, clientName, clientId };
}
function findProjectRow(projectRows, projectId) {
    const id = projectId.trim();
    if (!id)
        return undefined;
    return projectRows.find((project) => String(project.id ?? '').trim() === id);
}
function findProjectRowByCode(projectRows, code) {
    const normalized = code.trim().toUpperCase();
    if (!normalized)
        return undefined;
    return projectRows.find((project) => String(project.code ?? '').trim().toUpperCase() === normalized);
}
function resolveClientName(clientId, directClientName, clientNamesById, projectMeta) {
    if (directClientName.trim())
        return directClientName.trim();
    if (clientId && clientNamesById.get(clientId)?.trim())
        return clientNamesById.get(clientId).trim();
    if (projectMeta?.clientName?.trim())
        return projectMeta.clientName.trim();
    return '';
}
function resolvePartnerReportBaseMeta(row, projectRows, clientNamesById, clientMetaByProjectId) {
    const direct = readRowDisplayFields(row);
    const projectId = row.projectId.trim();
    const projectMeta = clientMetaByProjectId?.get(projectId);
    const projectRow = findProjectRow(projectRows, projectId);
    if (projectRow) {
        const clientId = String(projectRow.client_id ?? direct.clientId ?? projectMeta?.clientId ?? '').trim();
        return {
            projectName: String(projectRow.name ?? direct.projectName ?? '').trim(),
            clientName: resolveClientName(clientId, direct.clientName, clientNamesById, projectMeta),
            clientId,
        };
    }
    if (projectMeta) {
        const clientId = String(direct.clientId || projectMeta.clientId || '').trim();
        return {
            projectName: direct.projectName || String(row.projectName ?? '').trim() || row.title.trim(),
            clientName: resolveClientName(clientId, direct.clientName, clientNamesById, projectMeta),
            clientId,
        };
    }
    const titleFallback = partnerReportTitleProjectFallback(row.title, row.dateFrom, row.dateTo);
    const projectByCode = findProjectRowByCode(projectRows, titleFallback);
    if (projectByCode) {
        const clientId = String(projectByCode.client_id ?? direct.clientId ?? '').trim();
        return {
            projectName: String(projectByCode.name ?? '').trim(),
            clientName: resolveClientName(clientId, direct.clientName, clientNamesById),
            clientId,
        };
    }
    return {
        projectName: direct.projectName || titleFallback || row.title.trim(),
        clientName: resolveClientName(direct.clientId, direct.clientName, clientNamesById),
        clientId: direct.clientId,
    };
}
function mergePartnerReportDisplayMeta(base, patch) {
    if (!patch)
        return base;
    return {
        projectName: patch.projectName.trim() || base.projectName,
        clientName: patch.clientName.trim() || base.clientName,
        clientId: patch.clientId.trim() || base.clientId,
    };
}
export function resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraMetaByProjectId, clientMetaByProjectId) {
    let meta = resolvePartnerReportBaseMeta(row, projectRows, clientNamesById, clientMetaByProjectId);
    meta = mergePartnerReportDisplayMeta(meta, extraMetaByProjectId?.get(row.projectId));
    if (!meta.clientName && meta.clientId)
        meta = { ...meta, clientName: clientNamesById.get(meta.clientId)?.trim() || '' };
    if (!meta.clientId || !meta.clientName) {
        const projectMeta = clientMetaByProjectId?.get(row.projectId.trim());
        if (projectMeta) {
            meta = {
                ...meta,
                clientId: meta.clientId || projectMeta.clientId,
                clientName: meta.clientName || resolveClientName(meta.clientId || projectMeta.clientId, meta.clientName, clientNamesById, projectMeta),
            };
        }
    }
    return meta;
}
export function resolvePartnerReportProjectLabel(row, projectRows, clientNamesById, extraMetaByProjectId, clientMetaByProjectId) {
    const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraMetaByProjectId, clientMetaByProjectId);
    return displayReportProjectLabel(meta.projectName, row.projectId);
}
export function resolvePartnerReportClientLabel(row, projectRows, clientNamesById, extraMetaByProjectId, clientMetaByProjectId) {
    const meta = resolvePartnerReportDisplayMeta(row, projectRows, clientNamesById, extraMetaByProjectId, clientMetaByProjectId);
    const clientName = meta.clientName || clientNamesById.get(meta.clientId) || '';
    return displayReportClientLabel(clientName, meta.clientId);
}
