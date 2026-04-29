import type { TeamWorkloadMember } from '@entities/time-tracking';
function dec(v: string | number): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}
export function memberWeeklyCapacityHours(m: TeamWorkloadMember, periodDays: number, profileWeeklyHours?: number | null): number {
    if (profileWeeklyHours != null && Number.isFinite(profileWeeklyHours) && profileWeeklyHours > 0) {
        return Math.round(profileWeeklyHours * 100) / 100;
    }
    if (periodDays <= 0)
        return 0;
    const periodCap = dec(m.capacity_hours);
    return Math.round((periodCap * 7) / periodDays * 100) / 100;
}
