function str(v) {
    if (v == null)
        return '';
    return String(v);
}
function strOrNull(v) {
    const s = str(v).trim();
    return s ? s : null;
}
function num(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return 0;
}
function bool(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
}
export function normalizeUserPublic(raw) {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = num(o.id);
    if (id <= 0)
        return null;
    return {
        id,
        email: str(o.email),
        display_name: strOrNull(o.display_name ?? o.displayName),
        picture: strOrNull(o.picture),
        position: strOrNull(o.position),
        is_archived: bool(o.is_archived ?? o.isArchived),
    };
}
export function normalizeUsersPublicBatch(raw) {
    if (raw == null || typeof raw !== 'object')
        return { items: [], missing_ids: [] };
    const o = raw;
    const itemsRaw = Array.isArray(o.items) ? o.items : [];
    const missingRaw = Array.isArray(o.missing_ids ?? o.missingIds)
        ? (o.missing_ids ?? o.missingIds)
        : [];
    const items = [];
    for (const r of itemsRaw) {
        const n = normalizeUserPublic(r);
        if (n)
            items.push(n);
    }
    const missing_ids = missingRaw
        .map((v) => num(v))
        .filter((v) => v > 0);
    return { items, missing_ids };
}
