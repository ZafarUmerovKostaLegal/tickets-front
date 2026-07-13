function safeUserName<T extends { userName?: string | null }>(r: T): string {
    return String(r.userName ?? '').trim();
}
const nameCmp = <T extends { userName?: string | null }>(a: T, b: T): number => safeUserName(a).localeCompare(safeUserName(b), 'ru', { sensitivity: 'base', numeric: true });

export function uniqueSortedEmployeeNames<T extends { userName?: string | null }>(rows: T[]): string[] {
    return [...new Set(rows.map((r) => safeUserName(r)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
}

export function mergeUniqueSortedEmployeeNames(
    rowNames: readonly string[],
    extraNames: readonly string[],
): string[] {
    const names = new Set(rowNames.map((n) => n.trim()).filter(Boolean));
    for (const raw of extraNames) {
        const n = raw.trim();
        if (n)
            names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
}

export function sortRowsByUserName<T extends { userName?: string | null }>(rows: T[], ascending = true): T[] {
    return [...rows].sort((a, b) => ascending ? nameCmp(a, b) : nameCmp(b, a));
}
