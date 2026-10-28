export function parseTimeEntryDescriptionLines(raw) {
    const s = (raw ?? '').trim();
    if (!s.length)
        return { taskLine: '', notes: '' };
    const idx = s.indexOf('\n');
    if (idx === -1)
        return { taskLine: s, notes: '' };
    return { taskLine: s.slice(0, idx).trim(), notes: s.slice(idx + 1).trim() };
}
