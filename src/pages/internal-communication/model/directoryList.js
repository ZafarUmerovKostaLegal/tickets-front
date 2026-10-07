export function normalizeInternalExtensionSearch(value) {
    return value.trim().toLocaleLowerCase('ru-RU');
}
export function sortInternalExtensions(rows) {
    return [...rows].sort((a, b) => a.extension.localeCompare(b.extension, undefined, { numeric: true }));
}
export function filterInternalExtensions(rows, query) {
    const sorted = sortInternalExtensions(rows);
    const q = normalizeInternalExtensionSearch(query);
    if (!q)
        return sorted;
    return sorted.filter((row) => normalizeInternalExtensionSearch(row.fullName).includes(q)
        || normalizeInternalExtensionSearch(row.extension).includes(q));
}
export function internalExtensionInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
export function applyCreatedInternalExtension(prev, created) {
    return [...prev.filter((row) => row.id !== created.id), created];
}
export function applyUpdatedInternalExtension(prev, updated) {
    return prev.map((row) => (row.id === updated.id ? updated : row));
}
export function applyDeletedInternalExtension(prev, id) {
    return prev.filter((row) => row.id !== id);
}
export function editingInternalExtension(modal) {
    if (modal == null || modal === 'new')
        return null;
    return modal;
}
