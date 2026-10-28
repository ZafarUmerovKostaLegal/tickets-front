export function parseInternalExtension(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = Number(o.id);
    if (!Number.isFinite(id) || id <= 0)
        return null;
    return {
        id,
        fullName: String(o.full_name ?? o.fullName ?? '').trim(),
        extension: String(o.extension ?? '').trim(),
    };
}
export function parseInternalExtensionList(data) {
    if (!Array.isArray(data))
        return [];
    const out = [];
    for (const row of data) {
        const parsed = parseInternalExtension(row);
        if (parsed)
            out.push(parsed);
    }
    return out;
}
