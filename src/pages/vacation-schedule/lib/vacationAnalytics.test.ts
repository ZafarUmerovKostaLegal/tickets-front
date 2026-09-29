import { describe, expect, it } from 'vitest';
import { buildVacationAnalytics, type AnalyticsPerson } from './vacationAnalytics';

const TEAM = 'lit';

function person(id: number, name: string, teamId = TEAM, teamName = 'Litigation'): AnalyticsPerson {
    return { id, name, teamId, teamName };
}

describe('buildVacationAnalytics', () => {
    it('counts working days, a team overlap and the quiet weeks after it', () => {
        const report = buildVacationAnalytics({
            year: 2026,
            todayIso: '2026-09-01',
            teamLimitPercent: 40,
            quotaWorkingDays: 20,
            people: [person(1, 'Анна'), person(2, 'Борис')],
            days: [
                { personId: 1, iso: '2026-09-05', kind: 'annual' },
                { personId: 1, iso: '2026-09-07', kind: 'annual' },
                { personId: 1, iso: '2026-09-08', kind: 'annual' },
                { personId: 1, iso: '2026-09-09', kind: 'annual' },
                { personId: 1, iso: '2026-09-10', kind: 'annual' },
                { personId: 1, iso: '2026-09-11', kind: 'annual' },
                { personId: 2, iso: '2026-09-07', kind: 'sick' },
            ],
        });

        expect(report.vacationWorkingDays).toBe(5);
        expect(report.sickWorkingDays).toBe(1);
        expect(report.withoutVacation).toBe(1);
        expect(report.conflicts).toEqual([
            expect.objectContaining({ teamName: 'Litigation', from: '2026-09-07', to: '2026-09-07', max: 2, size: 2 }),
        ]);
        expect(report.employees.find((row) => row.id === 1)?.shortBlock).toBe(true);
        expect(report.employees.find((row) => row.id === 2)?.noVacation).toBe(true);
        const september = report.heatmap.find((row) => row.teamId === TEAM)?.months[8];
        expect(september && Math.round(september.percent * 100)).toBe(14);
        expect(report.freeWeeks[0]?.from).toBe('2026-09-14');
        expect(report.freeWeeks.every((week) => week.personDays === 0)).toBe(true);
    });

    it('does not flag a team that stays inside the limit', () => {
        const report = buildVacationAnalytics({
            year: 2026,
            todayIso: '2026-01-01',
            teamLimitPercent: 50,
            quotaWorkingDays: 20,
            people: [person(1, 'Анна'), person(2, 'Борис')],
            days: [{ personId: 1, iso: '2026-03-02', kind: 'annual' }],
        });
        expect(report.conflicts).toHaveLength(0);
        expect(report.employees[0]?.remaining).toBe(19);
    });
});
