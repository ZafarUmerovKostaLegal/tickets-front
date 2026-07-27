import { describe, expect, it } from 'vitest';
import type { TimeManagerClientProjectRow } from '../api';
import {
    collectMyParticipatingProjectIds,
    filterReportRowsByPartnerProjects,
    partnerProjectClientIds,
    readProjectPartnerAuthUserIds,
    readProjectParticipantAuthUserIds,
    readProjectTeamAuthUserIds,
    shouldScopeReportsToPartnerProjects,
} from './partnerReportProjectScope';

function project(partial: Partial<TimeManagerClientProjectRow> = {}): TimeManagerClientProjectRow {
    return {
        id: 'p1', client_id: 'c1', name: 'Matter', code: null, start_date: null, end_date: null,
        notes: null, report_visibility: 'all', project_type: 'hourly', billable_rate_type: null,
        budget_type: null, budget_amount: null, budget_hours: null, budget_resets_every_month: false,
        budget_includes_expenses: false, send_budget_alerts: false, budget_alert_threshold_percent: null,
        fixed_fee_amount: null, usage_count: 0, deletable: true, created_at: '2026-07-27', updated_at: null,
        ...partial,
    };
}

describe('partner report project scope', () => {
    it('collects normalized partner, participant, and explicit access ids', () => {
        const p1 = project({ partner_auth_user_ids: [7, Number.NaN], participantAuthUserIds: [8, 7] });
        const p2 = project({ id: 'p2', client_id: 'c2', participant_auth_user_ids: [7] });
        expect(readProjectPartnerAuthUserIds(p1)).toEqual([7]);
        expect(readProjectParticipantAuthUserIds(p1)).toEqual([8, 7]);
        expect(readProjectTeamAuthUserIds(p1)).toEqual([7, 8]);
        expect(collectMyParticipatingProjectIds([p1, p2], 7, ['p3', ' ']))
            .toEqual(new Set(['p1', 'p2', 'p3']));
        expect(partnerProjectClientIds([p1, p2], new Set(['p2']))).toEqual(new Set(['c2']));
    });

    it('does not restrict administrators and recognizes partner roles', () => {
        expect(shouldScopeReportsToPartnerProjects('administrator', null)).toBe(false);
        expect(shouldScopeReportsToPartnerProjects('partner', null)).toBe(true);
        expect(shouldScopeReportsToPartnerProjects('lawyer', 'partner')).toBe(true);
    });

    it('filters direct project report groups', () => {
        const rows = [{ project_id: 'p1' }, { project_id: 'p2' }, { project_id: null }];
        const allowed = new Set(['p1']);
        expect(filterReportRowsByPartnerProjects(rows, allowed, null, 'time', 'projects')).toEqual([rows[0]]);
        expect(filterReportRowsByPartnerProjects(rows, allowed, null, 'time', 'tasks')).toEqual([rows[0]]);
        expect(filterReportRowsByPartnerProjects(rows, allowed, null, 'expenses', 'projects')).toEqual([rows[0]]);
        expect(filterReportRowsByPartnerProjects(rows, allowed, null, 'uninvoiced', 'clients')).toEqual([rows[0]]);
        expect(filterReportRowsByPartnerProjects(rows, allowed, null, 'project-budget', 'clients')).toEqual([rows[0]]);
        expect(filterReportRowsByPartnerProjects(rows, new Set(), null, 'time', 'projects')).toEqual([]);
    });

    it('recalculates time client totals from allowed entry logs', () => {
        const rows = [{
            client_id: 'c1', client_name: 'Client', total_hours: 99, billable_hours: 99, billable_amount: 99,
            users: [
                {
                    auth_user_id: 7, name: 'Allowed', total_hours: 99, billable_hours: 99, billable_amount: 99,
                    entries: [
                        { project_id: 'p1', hours: 2, billable_hours: 1.5, billable_amount: 150 },
                        { project_id: 'p2', hours: 8, billable_amount: 800 },
                    ],
                },
                { auth_user_id: 8, name: 'Denied', entries: [{ project_id: 'p2', hours: 4 }] },
            ],
        }];
        const result = filterReportRowsByPartnerProjects(rows, new Set(['p1']), null, 'time', 'clients') as typeof rows;
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ total_hours: 2, billable_hours: 1.5, billable_amount: 150 });
        expect(result[0].users).toHaveLength(1);
        expect(result[0].users[0]).toMatchObject({ entries_total: 1, entries_truncated: false });
    });

    it('filters expense client/category/team groups and recalculates totals', () => {
        const user1 = { auth_user_id: 7, project_id: 'p1', total_amount: 100, billable_amount: 80 };
        const user2 = { auth_user_id: 8, project_id: 'p2', total_amount: 300, billable_amount: 200 };
        const clientRows = [
            { client_id: 'c1', client_name: 'Allowed', users: [user1, user2], total_amount: 400, billable_amount: 280 },
            { client_id: 'c2', client_name: 'Denied', users: [user1], total_amount: 100, billable_amount: 80 },
        ];
        const clients = filterReportRowsByPartnerProjects(
            clientRows, new Set(['p1']), new Set(['c1']), 'expenses', 'clients',
        ) as typeof clientRows;
        expect(clients).toHaveLength(1);
        expect(clients[0]).toMatchObject({ total_amount: 100, billable_amount: 80 });
        expect(clients[0].users).toEqual([user1]);

        const categories = filterReportRowsByPartnerProjects(
            [{ category_id: 'cat1', category_name: 'Travel', users: [user1, user2] }],
            new Set(['p1']), null, 'expenses', 'categories',
        ) as Array<Record<string, unknown>>;
        expect(categories[0]).toMatchObject({ total_amount: 100, billable_amount: 80, users: [user1] });

        expect(filterReportRowsByPartnerProjects(
            [{ users: [user2] }, { users: [user1] }, { users: [] }],
            new Set(['p1']), null, 'expenses', 'team',
        )).toHaveLength(1);
    });
});
