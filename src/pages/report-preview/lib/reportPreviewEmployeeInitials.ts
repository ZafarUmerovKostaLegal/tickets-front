import { resolveReportEmployeeInitials } from '@entities/time-tracking/lib/reportEmployeeInitials';
import { resolveReportEmployeePosition } from '@entities/time-tracking/lib/reportEmployeePosition';
import { fetchReportsUsersForFilter, listTimeTrackingUsers } from '@entities/time-tracking';
import type { TimeExcelPreviewRow } from './previewExcelTypes';

export type AuthUserExportProfile = {
    initials?: string;
    position?: string;
    role?: string;
};

export function buildAuthUserInitialsLookup(entries: Iterable<readonly [number, string | null | undefined]>): Map<number, string> {
    const out = new Map<number, string>();
    for (const [id, raw] of entries) {
        if (!Number.isFinite(id) || id <= 0)
            continue;
        const stored = (raw ?? '').trim().toUpperCase();
        if (!stored)
            continue;
        out.set(id, stored);
    }
    return out;
}

export function buildAuthUserExportProfileLookup(
    users: Iterable<{
        id: number;
        initials?: string | null;
        position?: string | null;
        role?: string | null;
    }>,
): Map<number, AuthUserExportProfile> {
    const out = new Map<number, AuthUserExportProfile>();
    for (const u of users) {
        if (!Number.isFinite(u.id) || u.id <= 0)
            continue;
        const initials = (u.initials ?? '').trim().toUpperCase();
        const position = (u.position ?? '').trim();
        const role = (u.role ?? '').trim();
        if (!initials && !position && !role)
            continue;
        out.set(u.id, {
            initials: initials || undefined,
            position: position || undefined,
            role: role || undefined,
        });
    }
    return out;
}

export function mergeAuthUserExportProfileMaps(
    base: ReadonlyMap<number, AuthUserExportProfile>,
    extra: ReadonlyMap<number, AuthUserExportProfile>,
): Map<number, AuthUserExportProfile> {
    const out = new Map(base);
    for (const [authUserId, profile] of extra) {
        const prev = out.get(authUserId) ?? {};
        out.set(authUserId, {
            initials: profile.initials || prev.initials,
            position: profile.position || prev.position,
            role: profile.role || prev.role,
        });
    }
    return out;
}

export function mergeAuthUserExportProfiles(
    base: ReadonlyMap<number, AuthUserExportProfile>,
    extra: Iterable<{
        authUserId: number;
        position?: string | null;
        role?: string | null;
        initials?: string | null;
    }>,
): Map<number, AuthUserExportProfile> {
    const out = new Map(base);
    for (const row of extra) {
        if (!Number.isFinite(row.authUserId) || row.authUserId <= 0)
            continue;
        const prev = out.get(row.authUserId) ?? {};
        const position = (row.position ?? '').trim() || prev.position;
        const role = (row.role ?? '').trim() || prev.role;
        const initials = (row.initials ?? '').trim().toUpperCase() || prev.initials;
        if (!position && !role && !initials)
            continue;
        out.set(row.authUserId, {
            initials,
            position,
            role,
        });
    }
    return out;
}

function resolveRowExportFields(
    row: TimeExcelPreviewRow,
    profile: AuthUserExportProfile | undefined,
): Pick<TimeExcelPreviewRow, 'employeeInitials' | 'employeePosition'> {
    const employeeInitials = resolveReportEmployeeInitials({
        stored: profile?.initials ?? (row.employeeInitials ?? '').trim(),
        displayName: row.employeeName || row.userName,
    });
    const employeePosition = resolveReportEmployeePosition({
        entryPosition: row.employeePosition,
        userPosition: profile?.position,
        userRole: profile?.role,
    });
    return { employeeInitials, employeePosition };
}

export function applyAuthUserExportProfilesToTimePreviewRows(
    rows: TimeExcelPreviewRow[],
    profilesByAuthUserId: ReadonlyMap<number, AuthUserExportProfile>,
): TimeExcelPreviewRow[] {
    if (rows.length === 0)
        return rows;
    let changed = false;
    const next = rows.map((row) => {
        const profile = row.authUserId > 0 ? profilesByAuthUserId.get(row.authUserId) : undefined;
        const resolved = resolveRowExportFields(row, profile);
        if (resolved.employeeInitials === (row.employeeInitials ?? '')
            && resolved.employeePosition === (row.employeePosition ?? '')) {
            return row;
        }
        changed = true;
        return { ...row, ...resolved };
    });
    return changed ? next : rows;
}

export function applyAuthUserInitialsToTimePreviewRows(
    rows: TimeExcelPreviewRow[],
    initialsByAuthUserId: ReadonlyMap<number, string>,
): TimeExcelPreviewRow[] {
    const profiles = new Map<number, AuthUserExportProfile>();
    for (const [id, initials] of initialsByAuthUserId)
        profiles.set(id, { initials });
    return applyAuthUserExportProfilesToTimePreviewRows(rows, profiles);
}

export async function fetchReportExportProfilesByAuthUserId(): Promise<Map<number, AuthUserExportProfile>> {
    let merged = new Map<number, AuthUserExportProfile>();
    try {
        const ttUsers = await listTimeTrackingUsers();
        merged = mergeAuthUserExportProfileMaps(merged, buildAuthUserExportProfileLookup(ttUsers));
    }
    catch {
    }
    try {
        const filterUsers = await fetchReportsUsersForFilter();
        merged = mergeAuthUserExportProfiles(merged, filterUsers.map((u) => ({
            authUserId: u.id,
            initials: u.initials,
        })));
    }
    catch {
    }
    return merged;
}
