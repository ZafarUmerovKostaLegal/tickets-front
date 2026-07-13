import type { TeamWorkloadSummary } from '@entities/time-tracking';
function dec(v: string | number | undefined | null): number {
    if (v == null || v === '')
        return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}
export function summaryTeamWeeklyCapacityHours(s: TeamWorkloadSummary, periodDays: number): number {
    if (typeof s === 'object' &&
        s != null &&
        'team_weekly_capacity_hours' in s &&
        s.team_weekly_capacity_hours != null &&
        String(s.team_weekly_capacity_hours).trim() !== '') {
        return Math.round(dec(s.team_weekly_capacity_hours) * 100) / 100;
    }
    const pd = periodDays > 0 ? periodDays : 1;
    return Math.round((dec(s.team_capacity_hours) * 7) / pd * 100) / 100;
}
