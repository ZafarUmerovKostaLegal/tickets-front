import type { TimeExcelPreviewRow } from './previewExcelTypes';

function normalizePreviewNote(value: string | undefined | null): string {
    return (value ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

function timePreviewRowUserKey(r: TimeExcelPreviewRow): string {
    if (Number.isFinite(r.authUserId) && r.authUserId > 0)
        return `id:${r.authUserId}`;
    const name = (r.userName || r.employeeName || '').trim();
    return name ? `name:${name.trim().toLowerCase()}` : '';
}

function timePreviewRowTaskKey(r: TimeExcelPreviewRow): string {
    const tid = (r.taskId || '').trim();
    if (tid && !tid.startsWith('task:'))
        return tid;
    return normalizePreviewNote(r.taskName);
}

function moneyKey(amount: number): string {
    if (!Number.isFinite(amount))
        return '0.00';
    return (Math.round(amount * 100) / 100).toFixed(2);
}

function hoursKey(hours: number): string {
    if (!Number.isFinite(hours))
        return '0.000000';
    return (Math.round(hours * 1_000_000) / 1_000_000).toFixed(6);
}

export function timePreviewRowDuplicateFingerprint(r: TimeExcelPreviewRow): string | null {
    if (r.rowKind !== 'entry' || r.isVoided)
        return null;
    const userKey = timePreviewRowUserKey(r);
    if (!userKey)
        return null;
    const workDate = (r.workDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate))
        return null;
    const projectId = (r.projectId || '').trim();
    const note = normalizePreviewNote(r.note || r.description);
    const task = timePreviewRowTaskKey(r);
    const hours = Number.isFinite(r.hours) ? r.hours : 0;
    const amount = Number.isFinite(r.amountToPay) ? r.amountToPay : 0;
    const currency = (r.currency || 'USD').trim().toUpperCase() || 'USD';
    return [
        projectId,
        userKey,
        workDate,
        task,
        note,
        hoursKey(hours),
        moneyKey(amount),
        currency,
    ].join('\x1f');
}

function keeperSortKey(r: TimeExcelPreviewRow): string {
    return `${r.recordedAt || r.workDate || ''}\x1f${r.timeEntryId || r.rowKey}`;
}

export function buildTimePreviewDuplicateRowKeySet(rows: TimeExcelPreviewRow[]): Set<string> {
    const byFingerprint = new Map<string, TimeExcelPreviewRow[]>();
    for (const r of rows) {
        const fp = timePreviewRowDuplicateFingerprint(r);
        if (!fp)
            continue;
        const list = byFingerprint.get(fp) ?? [];
        list.push(r);
        byFingerprint.set(fp, list);
    }
    const dupKeys = new Set<string>();
    for (const group of byFingerprint.values()) {
        if (group.length < 2)
            continue;
        for (const row of group)
            dupKeys.add(row.rowKey);
    }
    return dupKeys;
}

export function deduplicateTimeExcelPreviewRows(rows: TimeExcelPreviewRow[]): TimeExcelPreviewRow[] {
    const aggregates: TimeExcelPreviewRow[] = [];
    const entries: TimeExcelPreviewRow[] = [];
    for (const r of rows) {
        if (r.rowKind !== 'entry')
            aggregates.push(r);
        else
            entries.push(r);
    }
    if (entries.length < 2)
        return rows;

    const byFingerprint = new Map<string, TimeExcelPreviewRow[]>();
    for (const r of entries) {
        const fp = timePreviewRowDuplicateFingerprint(r);
        if (!fp) {
            aggregates.push(r);
            continue;
        }
        const list = byFingerprint.get(fp) ?? [];
        list.push(r);
        byFingerprint.set(fp, list);
    }

    const keptEntries: TimeExcelPreviewRow[] = [];
    for (const group of byFingerprint.values()) {
        if (group.length === 1) {
            keptEntries.push(group[0]);
            continue;
        }
        const keeper = [...group].sort((a, b) => keeperSortKey(a).localeCompare(keeperSortKey(b)))[0];
        keptEntries.push(keeper);
    }

    return [...aggregates, ...keptEntries];
}

export const TIME_PREVIEW_DUPLICATE_ROW_TITLE = 'Совпадают дата, сотрудник, задача, заметка, отработанные часы и сумма';
