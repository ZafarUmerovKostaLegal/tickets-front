import { coerceGroupByForType } from '@entities/time-tracking/model/reportsPanelConfig';
import { writeReportPreviewTransfer, } from '@entities/time-tracking/model/reportPreviewTransfer';
import { isoDateLocal } from '@entities/time-tracking/lib/reportsPeriodRange';
import {} from '@pages/time-tracking/ui/timesheetProjectLoader';
export function stripReportPagination(filters) {
    const { page: _pg, per_page: _pp, ...rest } = filters;
    return rest;
}
export function previewProjectOptionLabel(p) {
    return p.client ? `${p.name} — ${p.client}` : p.name;
}
export function projectNameFromExcelRows(projectId, rows) {
    const pid = projectId.trim();
    if (!pid)
        return '';
    const match = rows.find((r) => String(r.projectId ?? '').trim() === pid);
    return match?.projectName?.trim() || '';
}
export function projectClientFromExcelRows(projectId, rows) {
    const pid = projectId.trim();
    if (!pid)
        return { clientName: '', clientId: '', currency: 'USD' };
    const match = rows.find((r) => String(r.projectId ?? '').trim() === pid);
    return {
        clientName: match?.clientName?.trim() || '',
        clientId: String(match?.clientId ?? '').trim(),
        currency: match?.currency?.trim() || 'USD',
    };
}
export function buildMissingProjectOption(projectId, rows) {
    const fromRows = projectClientFromExcelRows(projectId, rows);
    const name = projectNameFromExcelRows(projectId, rows);
    return {
        id: projectId,
        name: name || 'Проект',
        client: fromRows.clientName,
        clientId: fromRows.clientId,
        color: 'hsl(220 14% 46%)',
        currency: fromRows.currency,
        recordsLanguage: 'ENG',
    };
}
export function pad2p(n) {
    return n < 10 ? `0${n}` : String(n);
}
export function pickDefaultWorkDateInRange(from, to) {
    const f = from.slice(0, 10);
    const t = to.slice(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad2p(now.getMonth() + 1)}-${pad2p(now.getDate())}`;
    if (todayStr >= f && todayStr <= t)
        return todayStr;
    return t;
}
export function buildTemplateForNewPreviewRow(params) {
    const name = params.user.display_name?.trim() || params.user.email;
    return {
        rowKey: 'new',
        timeEntryId: '',
        rowKind: 'entry',
        sourceEntryCount: 1,
        userName: name,
        employeeName: name,
        authUserId: params.user.id,
        employeeInitials: '',
        employeePosition: params.user.position ?? '',
        workDate: params.workDate,
        recordedAt: params.recordedAt,
        clientId: params.opt.clientId,
        clientName: params.opt.client,
        projectId: params.opt.id,
        projectName: params.opt.name,
        projectCode: '',
        taskId: '',
        taskName: '',
        note: '',
        description: '',
        hours: 1,
        billableHours: 1,
        isBillable: true,
        taskBillableByDefault: false,
        isInvoiced: false,
        isPaid: false,
        isWeekSubmitted: false,
        billableRate: 0,
        amountToPay: 0,
        costRate: 0,
        costAmount: 0,
        currency: params.opt.currency || 'USD',
        externalReferenceUrl: '',
        invoiceId: '',
        invoiceNumber: '',
        isVoided: false,
        voidKind: null,
    };
}
export function buildApiFilters(xfer, rangeFrom, rangeTo, selectedProjectId, selectedClientId, selectedUserIds) {
    const base = stripReportPagination(xfer.filters);
    const out = { ...base, dateFrom: rangeFrom, dateTo: rangeTo };
    if (selectedUserIds.length > 0)
        out.user_id = selectedUserIds.join(',');
    else
        delete out.user_id;
    if (xfer.reportType === 'time') {
        if (xfer.groupBy === 'clients') {
            const cid = selectedClientId.trim();
            if (cid)
                out.client_id = cid;
            else
                delete out.client_id;
            delete out.project_id;
        }
        else {
            const pid = selectedProjectId.trim();
            if (pid)
                out.project_id = pid;
            else
                delete out.project_id;
            delete out.client_id;
        }
    }
    return out;
}
export function parseUserIdsFromFilter(user_id) {
    if (typeof user_id !== 'string' || !user_id.trim())
        return [];
    return user_id.split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
}
export function buildPreviewPeriodState(periodGranularity, periodDate, customRangeActive) {
    return {
        periodGranularity,
        periodAnchorIso: isoDateLocal(periodDate),
        customRangeActive,
    };
}
export function periodStatesEqual(a, b) {
    if (a == null && b == null)
        return true;
    if (a == null || b == null)
        return false;
    return a.periodGranularity === b.periodGranularity
        && a.periodAnchorIso === b.periodAnchorIso
        && a.customRangeActive === b.customRangeActive;
}
export function buildReportPreviewSyncedFilters(xfer, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds, teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, reportPageSizeMax) {
    const filters = {
        ...buildApiFilters(xfer, rangeFrom, rangeTo, selectedProjectId, selectedClientId, effectiveSelectedUserIds),
        pageSizeMax: reportPageSizeMax != null && reportPageSizeMax > 0 ? reportPageSizeMax : undefined,
    };
    if (xfer.reportType !== 'time') {
        if (selectedProjectId)
            filters.project_id = selectedProjectId;
        else
            delete filters.project_id;
    }
    if (teamFilterEnabled) {
        filters.team_filter_enabled = true;
        if (teamFilterPartnerId > 0)
            filters.team_filter_partner_auth_user_id = teamFilterPartnerId;
        else
            delete filters.team_filter_partner_auth_user_id;
        if (teamFilterTeamId.trim())
            filters.team_id = teamFilterTeamId.trim();
        else
            delete filters.team_id;
    }
    else {
        delete filters.team_filter_enabled;
        delete filters.team_filter_partner_auth_user_id;
        delete filters.team_id;
    }
    return filters;
}
export function reportPreviewXferFiltersInSync(prev, nextFilters, listPerPage, nextPeriod) {
    const curStripped = stripReportPagination(prev.filters);
    const nextStripped = stripReportPagination(nextFilters);
    if (JSON.stringify(curStripped) !== JSON.stringify(nextStripped))
        return false;
    if ((prev.filters.page ?? 1) !== 1)
        return false;
    if ((prev.filters.per_page ?? listPerPage) !== listPerPage)
        return false;
    return periodStatesEqual(prev.period, nextPeriod);
}
export function previewLiveTitle(xfer) {
    if (xfer.reportType === 'time') {
        const g = xfer.groupBy === 'clients' ? 'клиентам' : 'проектам';
        return `Время — по ${g}`;
    }
    if (xfer.reportType === 'expenses') {
        const gb = coerceGroupByForType('expenses', xfer.groupBy);
        const map = {
            clients: 'клиентам',
            projects: 'проектам',
            categories: 'категориям',
            team: 'команде',
        };
        const base = xfer.filters.confirmed_payment_only === true ? 'Расходы (оплата подтверждена)' : 'Расходы';
        return `${base} — по ${map[gb]}`;
    }
    if (xfer.reportType === 'uninvoiced')
        return 'Не выставлено';
    return 'Бюджет проектов';
}
export function reportPreviewConfirmationProjectId(xfer, selectedProjectId) {
    const pid = selectedProjectId.trim();
    if (!pid)
        return '';
    if (xfer.reportType === 'time' && xfer.groupBy === 'projects')
        return pid;
    if (xfer.reportType === 'expenses' && xfer.groupBy === 'projects')
        return pid;
    return '';
}
export function persistXferFilters(xfer, filters, listPerPage, period) {
    const paged = { ...filters, page: 1, per_page: listPerPage };
    const snapExtra = {
        ...(xfer.partnerConfirmationSnapshotId?.trim()
            ? { partnerConfirmationSnapshotId: xfer.partnerConfirmationSnapshotId.trim() }
            : {}),
        ...((period ?? xfer.period) ? { period: period ?? xfer.period } : {}),
        ...(xfer.returnTo?.trim() ? { returnTo: xfer.returnTo.trim() } : {}),
        ...(xfer.forReviewPreview ? { forReviewPreview: true } : {}),
    };
    if (xfer.reportType === 'time') {
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'time',
            groupBy: xfer.groupBy,
            filters: paged,
            ...snapExtra,
        });
        return;
    }
    if (xfer.reportType === 'expenses') {
        writeReportPreviewTransfer({
            v: 2,
            reportType: 'expenses',
            groupBy: xfer.groupBy,
            filters: paged,
            ...snapExtra,
        });
        return;
    }
    if (xfer.reportType === 'uninvoiced') {
        writeReportPreviewTransfer({ v: 2, reportType: 'uninvoiced', filters: paged, ...snapExtra });
        return;
    }
    writeReportPreviewTransfer({ v: 2, reportType: 'project-budget', filters: paged, ...snapExtra });
}
