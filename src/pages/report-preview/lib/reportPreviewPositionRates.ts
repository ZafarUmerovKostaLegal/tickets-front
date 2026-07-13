import { listUsersWithProjectAccessToProjectForPick, type ProjectPartnerAccessRow } from '@entities/time-tracking';
import { resolveReportEmployeePosition } from '@entities/time-tracking/lib/reportEmployeePosition';
import type { AuthUserExportProfile } from './reportPreviewEmployeeInitials';
import { fetchBillableRateForPreviewRow } from './reportPreviewRowPatch';
import type { TimeExcelPreviewRow } from './previewExcelTypes';

export type ReportExportPositionRateRow = {
    position: string;
    rate: number;
};

const POSITION_RATE_HIERARCHY: readonly string[] = [
    'Partner',
    'Counsel',
    'Senior Associate',
    'Associate Level II',
    'Associate Level I',
    'Associate',
    'Contracts Manager',
    'Junior Associate',
    'Trainee',
];

function positionRateHierarchyRank(title: string): number {
    const t = title.trim().toLowerCase();
    if (!t)
        return 9999;
    const exact = POSITION_RATE_HIERARCHY.findIndex((p) => p.toLowerCase() === t);
    if (exact >= 0)
        return exact;
    if (t.includes('partner'))
        return 0;
    if (t.includes('senior') && t.includes('associate'))
        return 2;
    if (t.includes('associate level ii') || (t.includes('level ii') && t.includes('associate')))
        return 3;
    if (t.includes('associate level i') || (t.includes('level i') && t.includes('associate')))
        return 4;
    if (t.includes('junior') && t.includes('associate'))
        return 7;
    if (t.includes('counsel'))
        return 1;
    if (t.includes('associate'))
        return 5;
    if (t.includes('contracts'))
        return 6;
    if (t.includes('trainee'))
        return 8;
    return 5000;
}

export function compareReportPositionTitles(a: string, b: string): number {
    const ra = positionRateHierarchyRank(a);
    const rb = positionRateHierarchyRank(b);
    if (ra !== rb)
        return ra - rb;
    return a.localeCompare(b, 'en', { sensitivity: 'base' });
}

export function normalizePositionRateTableLabel(title: string): string {
    const trimmed = title.trim();
    if (!trimmed)
        return '';
    const withoutAsOf = trimmed.replace(/\s+as of\s+.+/i, '').trim();
    return withoutAsOf;
}

function mergePositionRate(
    map: Map<string, number>,
    positionRaw: string,
    rateRaw: number,
): void {
    const position = normalizePositionRateTableLabel(positionRaw);
    const rate = Math.round(rateRaw * 100) / 100;
    if (!position || !Number.isFinite(rate) || rate <= 0)
        return;
    const prev = map.get(position);
    if (prev == null || rate > prev)
        map.set(position, rate);
}

export function buildPositionRateRowsFromEntries(
    entries: Iterable<{ position: string; rate: number }>,
): ReportExportPositionRateRow[] {
    const map = new Map<string, number>();
    for (const entry of entries)
        mergePositionRate(map, entry.position, entry.rate);
    return [...map.entries()]
        .map(([position, rate]) => ({ position, rate }))
        .sort((a, b) => compareReportPositionTitles(a.position, b.position));
}

function positionForExportRow(
    row: TimeExcelPreviewRow,
    profilesByAuthUserId: ReadonlyMap<number, AuthUserExportProfile>,
): string {
    const profile = row.authUserId > 0 ? profilesByAuthUserId.get(row.authUserId) : undefined;
    return resolveReportEmployeePosition({
        entryPosition: row.employeePosition,
        userPosition: profile?.position,
        userRole: profile?.role,
    });
}

export async function buildReportExportPositionRateRows(opts: {
    exportRows: TimeExcelPreviewRow[];
    projectId: string;
    currency: string;
    profilesByAuthUserId: ReadonlyMap<number, AuthUserExportProfile>;
    projectMembers?: ProjectPartnerAccessRow[];
}): Promise<ReportExportPositionRateRow[]> {
    const map = new Map<string, number>();
    const rateByAuthUserId = new Map<number, number>();

    for (const row of opts.exportRows) {
        if (row.rowKind !== 'entry' || row.isVoided || !row.isBillable)
            continue;
        const rate = Number.isFinite(row.billableRate) ? row.billableRate : 0;
        if (rate <= 0)
            continue;
        if (row.authUserId > 0) {
            const prev = rateByAuthUserId.get(row.authUserId);
            if (prev == null || rate > prev)
                rateByAuthUserId.set(row.authUserId, rate);
        }
        mergePositionRate(map, positionForExportRow(row, opts.profilesByAuthUserId), rate);
    }

    let members = opts.projectMembers ?? [];
    if (members.length === 0 && opts.projectId.trim()) {
        try {
            members = await listUsersWithProjectAccessToProjectForPick(opts.projectId.trim());
        }
        catch {
            members = [];
        }
    }

    const memberIds = new Set(members.map((m) => m.authUserId).filter((id) => id > 0));
    for (const authUserId of rateByAuthUserId.keys())
        memberIds.add(authUserId);

    await Promise.all([...memberIds].map(async (authUserId) => {
        let rate = rateByAuthUserId.get(authUserId) ?? 0;
        if (rate <= 0) {
            const fetched = await fetchBillableRateForPreviewRow(authUserId, opts.projectId, opts.currency);
            rate = fetched != null && fetched > 0 ? fetched : 0;
        }
        if (rate <= 0)
            return;
        const member = members.find((m) => m.authUserId === authUserId);
        const profile = opts.profilesByAuthUserId.get(authUserId);
        const position = resolveReportEmployeePosition({
            entryPosition: member?.position,
            userPosition: profile?.position,
            userRole: profile?.role,
        });
        mergePositionRate(map, position, rate);
    }));

    return buildPositionRateRowsFromEntries([...map.entries()].map(([position, rate]) => ({ position, rate })));
}
