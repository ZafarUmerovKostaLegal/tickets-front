export type VacationLeavePendingBadgeCounts = {
    count: number;
    toDecideCount: number;
    minePendingCount: number;
};

export function formatVacationLeavePendingBadge(count: number): string {
    if (count <= 0)
        return '';
    if (count > 99)
        return '99+';
    return String(count);
}
