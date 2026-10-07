const DEFAULT_LIMIT = 50;
const COALESCE_MS = 900;
export function createReportPreviewEditHistory() {
    return { stack: [] };
}
export function pushPatchUndo(history, rowKey, before, now = Date.now(), limit = DEFAULT_LIMIT) {
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
export function pushCreateUndo(history, rowKey, timeEntryId, authUserId, now = Date.now(), limit = DEFAULT_LIMIT) {
    history.stack.push({
        kind: 'create',
        rowKey,
        timeEntryId,
        authUserId,
        at: now,
    });
    trimHistory(history, limit);
}
export function pushDeleteUndo(history, rowKey, snapshot, now = Date.now(), limit = DEFAULT_LIMIT) {
    history.stack.push({
        kind: 'delete',
        rowKey,
        snapshot: structuredClone(snapshot),
        at: now,
    });
    trimHistory(history, limit);
}
export function popUndo(history) {
    return history.stack.pop() ?? null;
}
export function peekUndo(history) {
    return history.stack[history.stack.length - 1] ?? null;
}
export function clearEditHistory(history) {
    history.stack.length = 0;
}
function trimHistory(history, limit) {
    if (history.stack.length <= limit)
        return;
    history.stack.splice(0, history.stack.length - limit);
}
export function canUndo(history) {
    return history.stack.length > 0;
}
