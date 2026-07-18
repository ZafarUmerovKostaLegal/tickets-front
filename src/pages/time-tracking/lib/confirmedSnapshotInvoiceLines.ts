import type { ReportSnapshotRow } from '@entities/time-tracking';
import { getSnapshotRowDisplayData } from '@entities/time-tracking/lib/reportSnapshotOverrides';

function pickStr(d: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const v = d[k];
        if (v == null || v === '')
            continue;
        const s = String(v).trim();
        if (s)
            return s;
    }
    return '';
}

function pickBool(d: Record<string, unknown>, ...keys: string[]): boolean {
    for (const k of keys) {
        const v = d[k];
        if (v === true || v === 'true' || v === 1 || v === '1')
            return true;
        if (v === false || v === 'false' || v === 0 || v === '0')
            return false;
    }
    return false;
}

function pickNum(d: Record<string, unknown>, ...keys: string[]): number | null {
    for (const k of keys) {
        const v = d[k];
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
        if (typeof v === 'string' && v.trim() !== '') {
            const n = Number(v.replace(',', '.'));
            if (Number.isFinite(n))
                return n;
        }
    }
    return null;
}

/** Same inclusion rules as partner confirmed Excel detail lines (billable time entries only). */
export function isConfirmedSnapshotBillableTimeRow(sr: ReportSnapshotRow): boolean {
    const d = getSnapshotRowDisplayData(sr);
    if (pickBool(d, 'isVoided', 'is_voided'))
        return false;
    const rk = pickStr(d, 'rowKind', 'row_kind').toLowerCase();
    if (rk === 'aggregate')
        return false;
    const st = sr.sourceType.trim().toLowerCase();
    if (st.includes('aggregate') || st.includes('rollup') || st.includes('summary'))
        return false;
    const hours = pickNum(d,
        'billableHours',
        'billable_hours',
        'hours',
        'durationHours',
        'duration_hours',
        'totalHours',
        'total_hours',
        'quantity',
    );
    if (hours == null || hours <= 1e-9)
        return false;
    if (rk === 'entry')
        return true;
    const te = pickStr(d, 'timeEntryId', 'time_entry_id') || (
        (st.includes('time') || st.includes('entry')) ? String(sr.sourceId ?? '').trim() : ''
    );
    const wd = pickStr(d, 'workDate', 'work_date');
    if (te && hours > 1e-9)
        return true;
    if (wd && hours > 1e-9)
        return true;
    return false;
}

export function collectConfirmedSnapshotTimeEntryIds(rows: readonly ReportSnapshotRow[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const sr of rows) {
        if (!isConfirmedSnapshotBillableTimeRow(sr))
            continue;
        const d = getSnapshotRowDisplayData(sr);
        let te = pickStr(d, 'timeEntryId', 'time_entry_id');
        if (!te) {
            const st = sr.sourceType.trim().toLowerCase();
            if (st.includes('time') || st.includes('entry'))
                te = String(sr.sourceId ?? '').trim();
        }
        if (!te || seen.has(te))
            continue;
        seen.add(te);
        out.push(te);
    }
    return out;
}

/**
 * Keep only preview time-entry ids that belong to the confirmed snapshot.
 * If snapshot has no resolvable ids, fall back to unique preview ids (backend may still dedupe).
 */
export function intersectPreviewTimeEntryIdsWithSnapshot(
    previewTimeEntryIds: readonly string[],
    snapshotTimeEntryIds: readonly string[],
): { timeEntryIds: string[]; usedSnapshotFilter: boolean; snapshotEntryCount: number } {
    const previewUnique: string[] = [];
    const previewSeen = new Set<string>();
    for (const raw of previewTimeEntryIds) {
        const id = String(raw ?? '').trim();
        if (!id || previewSeen.has(id))
            continue;
        previewSeen.add(id);
        previewUnique.push(id);
    }

    const snapIds = snapshotTimeEntryIds.map((x) => String(x ?? '').trim()).filter(Boolean);
    const snapshotEntryCount = snapIds.length;
    if (snapshotEntryCount === 0) {
        return { timeEntryIds: previewUnique, usedSnapshotFilter: false, snapshotEntryCount: 0 };
    }

    const snapSet = new Set(snapIds);
    const timeEntryIds = previewUnique.filter((id) => snapSet.has(id));
    return { timeEntryIds, usedSnapshotFilter: true, snapshotEntryCount };
}
