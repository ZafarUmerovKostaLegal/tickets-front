import type { TimeExcelPreviewRow } from './previewExcelTypes';

export type ReportPreviewUndoEntry =
    | {
        kind: 'patch';
        rowKey: string;
        before: TimeExcelPreviewRow;
        at: number;
    }
    | {
        kind: 'create';
        rowKey: string;
        timeEntryId: string;
        authUserId: number;
        at: number;
    }
    | {
        kind: 'delete';
        rowKey: string;
        snapshot: TimeExcelPreviewRow;
        at: number;
    };

const DEFAULT_LIMIT = 50;
const COALESCE_MS = 900;

export type ReportPreviewEditHistory = {
    stack: ReportPreviewUndoEntry[];
};

export function createReportPreviewEditHistory(): ReportPreviewEditHistory {
    return { stack: [] };
}

export function pushPatchUndo(
    history: ReportPreviewEditHistory,
    rowKey: string,
    before: TimeExcelPreviewRow,
    now = Date.now(),
    limit = DEFAULT_LIMIT,
): void {
    const top = history.stack[history.stack.length - 1];
    if (top?.kind === 'patch' && top.rowKey === rowKey && now - top.at <= COALESCE_MS) {
        top.at = now;
        return;
    }
    history.stack.push({
        kind: 'patch',
        rowKey,
        before: structuredClone(before),
        at: now,
    });
    trimHistory(history, limit);
}

export function pushCreateUndo(
    history: ReportPreviewEditHistory,
    rowKey: string,
    timeEntryId: string,
    authUserId: number,
    now = Date.now(),
    limit = DEFAULT_LIMIT,
): void {
    history.stack.push({
        kind: 'create',
        rowKey,
        timeEntryId,
        authUserId,
        at: now,
    });
    trimHistory(history, limit);
}

export function pushDeleteUndo(
    history: ReportPreviewEditHistory,
    rowKey: string,
    snapshot: TimeExcelPreviewRow,
    now = Date.now(),
    limit = DEFAULT_LIMIT,
): void {
    history.stack.push({
        kind: 'delete',
        rowKey,
        snapshot: structuredClone(snapshot),
        at: now,
    });
    trimHistory(history, limit);
}

export function popUndo(history: ReportPreviewEditHistory): ReportPreviewUndoEntry | null {
    return history.stack.pop() ?? null;
}

export function peekUndo(history: ReportPreviewEditHistory): ReportPreviewUndoEntry | null {
    return history.stack[history.stack.length - 1] ?? null;
}

export function clearEditHistory(history: ReportPreviewEditHistory): void {
    history.stack.length = 0;
}

function trimHistory(history: ReportPreviewEditHistory, limit: number): void {
    if (history.stack.length <= limit)
        return;
    history.stack.splice(0, history.stack.length - limit);
}

export function canUndo(history: ReportPreviewEditHistory): boolean {
    return history.stack.length > 0;
}
