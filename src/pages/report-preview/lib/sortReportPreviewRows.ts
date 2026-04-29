function safeUserName<T extends { userName?: string | null }>(r: T): string {
    return String(r.userName ?? '').trim();
}
const nameCmp = <T extends { userName?: string | null }>(a: T, b: T): number => safeUserName(a).localeCompare(safeUserName(b), 'ru', { sensitivity: 'base', numeric: true });

export function uniqueSortedEmployeeNames<T extends { userName?: string | null }>(rows: T[]): string[] {
    return [...new Set(rows.map((r) => safeUserName(r)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true }));
}

export function sortRowsByUserName<T extends { userName?: string | null }>(rows: T[], ascending = true): T[] {
    return [...rows].sort((a, b) => ascending ? nameCmp(a, b) : nameCmp(b, a));
}
