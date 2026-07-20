import type { TimeExcelPreviewRow } from './previewExcelTypes';
import {
    normalizeNoteForDuplicateKey,
    notesAreNearDuplicate,
} from '@pages/time-tracking/lib/invoiceClientDescription';

function normalizePreviewNote(value: string | undefined | null, taskName?: string | null): string {
    return normalizeNoteForDuplicateKey(value, taskName);
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
    return (r.taskName || '').trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
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

type FingerprintParts = {
    projectId: string;
    userKey: string;
    workDate: string;
    task: string;
    note: string;
    hours: string;
    amount: string;
    currency: string;
};

function timePreviewRowFingerprintParts(r: TimeExcelPreviewRow): FingerprintParts | null {
    if (r.rowKind !== 'entry' || r.isVoided)
        return null;
    const userKey = timePreviewRowUserKey(r);
    if (!userKey)
        return null;
    const workDate = (r.workDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate))
        return null;
    const projectId = (r.projectId || '').trim();
    const note = normalizePreviewNote(r.note || r.description, r.taskName);
    const task = timePreviewRowTaskKey(r);
    const hours = Number.isFinite(r.hours) ? r.hours : 0;
    const amount = Number.isFinite(r.amountToPay) ? r.amountToPay : 0;
    const currency = (r.currency || 'USD').trim().toUpperCase() || 'USD';
    return {
        projectId,
        userKey,
        workDate,
        task,
        note,
        hours: hoursKey(hours),
        amount: moneyKey(amount),
        currency,
    };
}

function fingerprintFromParts(p: FingerprintParts): string {
    return [p.projectId, p.userKey, p.workDate, p.task, p.note, p.hours, p.amount, p.currency].join('\x1f');
}

function metaKeyFromParts(p: FingerprintParts): string {
    return [p.projectId, p.userKey, p.workDate, p.task, p.hours, p.amount, p.currency].join('\x1f');
}

export function timePreviewRowDuplicateFingerprint(r: TimeExcelPreviewRow): string | null {
    const parts = timePreviewRowFingerprintParts(r);
    return parts ? fingerprintFromParts(parts) : null;
}

function keeperSortKey(r: TimeExcelPreviewRow): string {
    return `${r.recordedAt || r.workDate || ''}\x1f${r.timeEntryId || r.rowKey}`;
}

function clusterNearDuplicateEntries(entries: TimeExcelPreviewRow[]): TimeExcelPreviewRow[][] {
    const withParts: { row: TimeExcelPreviewRow; parts: FingerprintParts }[] = [];
    for (const r of entries) {
        const parts = timePreviewRowFingerprintParts(r);
        if (!parts)
            continue;
        withParts.push({ row: r, parts });
    }
    const byMeta = new Map<string, { row: TimeExcelPreviewRow; parts: FingerprintParts }[]>();
    for (const item of withParts) {
        const mk = metaKeyFromParts(item.parts);
        const list = byMeta.get(mk) ?? [];
        list.push(item);
        byMeta.set(mk, list);
    }
    const clusters: TimeExcelPreviewRow[][] = [];
    for (const items of byMeta.values()) {
        const noteClusters: { note: string; rows: TimeExcelPreviewRow[] }[] = [];
        for (const item of items) {
            let placed = false;
            for (const cluster of noteClusters) {
                if (notesAreNearDuplicate(item.parts.note, cluster.note)) {
                    if (item.parts.note.length > cluster.note.length)
                        cluster.note = item.parts.note;
                    cluster.rows.push(item.row);
                    placed = true;
                    break;
                }
            }
            if (!placed)
                noteClusters.push({ note: item.parts.note, rows: [item.row] });
        }
        for (const c of noteClusters)
            clusters.push(c.rows);
    }
    return clusters;
}

export function buildTimePreviewDuplicateRowKeySet(rows: TimeExcelPreviewRow[]): Set<string> {
    const entries = rows.filter((r) => r.rowKind === 'entry' && !r.isVoided);
    const dupKeys = new Set<string>();
    for (const group of clusterNearDuplicateEntries(entries)) {
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

    const keptEntries: TimeExcelPreviewRow[] = [];
    for (const group of clusterNearDuplicateEntries(entries)) {
        if (group.length === 1) {
            keptEntries.push(group[0]!);
            continue;
        }
        const keeper = [...group].sort((a, b) => keeperSortKey(a).localeCompare(keeperSortKey(b)))[0]!;
        keptEntries.push(keeper);
    }

    // Preserve entries that failed fingerprint (no parts) — already excluded from clusters.
    const keptKeys = new Set(keptEntries.map((r) => r.rowKey));
    for (const r of entries) {
        if (keptKeys.has(r.rowKey))
            continue;
        if (timePreviewRowFingerprintParts(r) == null)
            keptEntries.push(r);
    }

    return [...aggregates, ...keptEntries];
}

export const TIME_PREVIEW_DUPLICATE_ROW_TITLE = 'Совпадают дата, сотрудник, задача, заметка, отработанные часы и сумма';
