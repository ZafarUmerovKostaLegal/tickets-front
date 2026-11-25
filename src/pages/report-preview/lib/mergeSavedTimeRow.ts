import type { TimeExcelPreviewRow } from './previewExcelTypes';

function sameWords(a: string, b: string): boolean {
    return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
}

export function mergeSavedTimeRow(sent: TimeExcelPreviewRow, current: TimeExcelPreviewRow, saved: TimeExcelPreviewRow): TimeExcelPreviewRow {
    const merged: Record<string, unknown> = { ...saved };
    const before = sent as unknown as Record<string, unknown>;
    const now = current as unknown as Record<string, unknown>;
    for (const key of Object.keys(now)) {
        const typed = now[key];
        const stored = merged[key];
        if (typed !== before[key])
            merged[key] = typed;
        else if (typeof typed === 'string' && typeof stored === 'string' && typed !== stored && sameWords(typed, stored))
            merged[key] = typed;
    }
    return merged as TimeExcelPreviewRow;
}
