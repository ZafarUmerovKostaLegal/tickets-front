function safeUserName(r) {
    return String(r.userName ?? '').trim();
}
const nameCmp = (a, b) => safeUserName(a).localeCompare(safeUserName(b), 'ru', { sensitivity: 'base', numeric: true });
export function uniqueSortedEmployeeNames(rows) {
    return [...new Set(rows.map((r) => safeUserName(r)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
}
export function mergeUniqueSortedEmployeeNames(rowNames, extraNames) {
    const names = new Set(rowNames.map((n) => n.trim()).filter(Boolean));
    for (const raw of extraNames) {
        const n = raw.trim();
        if (n)
            names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
}
export function sortRowsByUserName(rows, ascending = true) {
    return [...rows].sort((a, b) => ascending ? nameCmp(a, b) : nameCmp(b, a));
}
