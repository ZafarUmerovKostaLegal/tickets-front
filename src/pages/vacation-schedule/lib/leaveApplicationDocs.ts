import { listVacationLeaveRequests, type VacationLeaveDocumentApi, type VacationLeaveRequestApi } from '@entities/vacation';

export type LeaveApplicationDoc = {
    leaveRequestId: number;
    dateFrom: string;
    dateTo: string;
    kind: string;
};

type LeaveMatchRequest = Pick<VacationLeaveRequestApi, 'id' | 'status' | 'kind' | 'employee_user_id' | 'employee_full_name' | 'date_from' | 'date_to'>;

function isoDay(value: string | null | undefined): string {
    return (value ?? '').trim().slice(0, 10);
}

export function normalizePersonName(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

export function leaveApplicationDocsFromApi(docs: readonly VacationLeaveDocumentApi[]): LeaveApplicationDoc[] {
    return docs.map((doc) => ({
        leaveRequestId: doc.leave_request_id,
        dateFrom: isoDay(doc.date_from),
        dateTo: isoDay(doc.date_to),
        kind: doc.kind,
    }));
}

export function matchApprovedLeaveApplications(args: {
    requests: readonly LeaveMatchRequest[];
    employeeName: string;
    authUserId: number | null;
    days: readonly { absence_on: string }[];
}): LeaveApplicationDoc[] {
    const name = normalizePersonName(args.employeeName);
    const days = args.days.map((day) => isoDay(day.absence_on)).filter((day) => day.length > 0);
    const out: LeaveApplicationDoc[] = [];
    const seen = new Set<number>();
    for (const req of args.requests) {
        if (req.status !== 'approved' || seen.has(req.id))
            continue;
        const from = isoDay(req.date_from);
        const to = isoDay(req.date_to);
        if (!from || !to)
            continue;
        const sameUser = args.authUserId != null && req.employee_user_id === args.authUserId;
        const sameName = name.length > 0 && normalizePersonName(req.employee_full_name) === name;
        if (!sameUser && !sameName)
            continue;
        const covers = days.some((day) => day >= from && day <= to);
        if (!covers)
            continue;
        seen.add(req.id);
        out.push({
            leaveRequestId: req.id,
            dateFrom: from,
            dateTo: to,
            kind: req.kind,
        });
    }
    out.sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.leaveRequestId - b.leaveRequestId);
    return out;
}

export function leaveDocsCoveringDate(docs: readonly LeaveApplicationDoc[], dateIso: string): LeaveApplicationDoc[] {
    const day = isoDay(dateIso);
    return docs.filter((doc) => day >= doc.dateFrom && day <= doc.dateTo);
}

export function leaveApplicationFileName(doc: LeaveApplicationDoc): string {
    const span = doc.dateFrom === doc.dateTo ? doc.dateFrom : `${doc.dateFrom}—${doc.dateTo}`;
    return `Заявление ${span}.pdf`;
}

export async function resolveLeaveApplicationDocs(row: {
    full_name: string;
    auth_user_id: number | null;
    absence_days: readonly { absence_on: string }[];
    leave_documents?: readonly VacationLeaveDocumentApi[];
}): Promise<LeaveApplicationDoc[]> {
    const fromApi = leaveApplicationDocsFromApi(row.leave_documents ?? []);
    if (fromApi.length > 0)
        return fromApi;
    try {
        const requests = await listVacationLeaveRequests({ scope: 'all', status: 'approved' });
        return matchApprovedLeaveApplications({
            requests,
            employeeName: row.full_name,
            authUserId: row.auth_user_id,
            days: row.absence_days,
        });
    }
    catch {
        return [];
    }
}
