import { describe, expect, it } from 'vitest';
import type { TimeTrackingTeamRow } from '@entities/time-tracking';
import {
    mergeNamedUsersForPartnerTeam,
    mergeProjectMembersWithPartnerTeam,
    partnerOptionsFromTeams,
    resolveEffectiveReportPreviewUserIds,
    resolveTeamMemberUserIds,
    teamsForPartner,
} from './reportPreviewTeamFilter';

function team(partial: Partial<TimeTrackingTeamRow> & Pick<TimeTrackingTeamRow, 'id' | 'partner_auth_user_id'>): TimeTrackingTeamRow {
    return {
        name: partial.name ?? 'Team',
        member_auth_user_ids: partial.member_auth_user_ids ?? [],
        is_archived: partial.is_archived ?? false,
        ...partial,
    };
}

describe('reportPreviewTeamFilter', () => {
    const teams = [
        team({ id: 't1', partner_auth_user_id: 10, partner_display_name: 'Partner A', member_auth_user_ids: [101, 102] }),
        team({ id: 't2', partner_auth_user_id: 10, name: 'Team B', member_auth_user_ids: [103] }),
        team({ id: 't3', partner_auth_user_id: 20, partner_display_name: 'Partner B', member_auth_user_ids: [201] }),
    ];

    it('returns partner and members for a partner across all teams', () => {
        expect(resolveTeamMemberUserIds(teams, 10)).toEqual([10, 101, 102, 103]);
    });

    it('returns partner and members for a specific team', () => {
        expect(resolveTeamMemberUserIds(teams, 10, 't1')).toEqual([10, 101, 102]);
    });

    it('builds partner options from teams', () => {
        expect(partnerOptionsFromTeams(teams).map((x) => x.id)).toEqual([10, 20]);
    });

    it('applies team filter to effective user ids', () => {
        const effective = resolveEffectiveReportPreviewUserIds({
            teamFilterEnabled: true,
            teamFilterPartnerId: 10,
            teamFilterTeamId: 't1',
            teams,
            selectedUserIds: [],
        });
        expect(effective).toEqual([10, 101, 102]);
    });

    it('intersects manual employee selection with team members', () => {
        const effective = resolveEffectiveReportPreviewUserIds({
            teamFilterEnabled: true,
            teamFilterPartnerId: 10,
            teamFilterTeamId: '',
            teams,
            selectedUserIds: [10, 102, 999],
        });
        expect(effective).toEqual([10, 102]);
    });

    it('returns partner id even when team has no members', () => {
        const solo = [
            team({ id: 'solo', partner_auth_user_id: 30, member_auth_user_ids: [] }),
        ];
        expect(resolveTeamMemberUserIds(solo, 30)).toEqual([30]);
    });

    it('ignores archived teams', () => {
        const archived = [
            ...teams,
            team({ id: 't4', partner_auth_user_id: 10, is_archived: true, member_auth_user_ids: [999] }),
        ];
        expect(teamsForPartner(archived, 10)).toHaveLength(2);
    });

    it('adds missing team members to the employee list when partner filter is on', () => {
        const catalog = [
            { id: 10, email: 'p@x.com', display_name: 'Partner A', position: 'Partner', is_blocked: false, is_archived: false, created_at: '' },
            { id: 101, email: 'a@x.com', display_name: 'Associate A', position: 'Associate', is_blocked: false, is_archived: false, created_at: '' },
            { id: 102, email: 'j@x.com', display_name: 'Junior A', position: 'Junior Associate', is_blocked: false, is_archived: false, created_at: '' },
        ];
        const named = mergeNamedUsersForPartnerTeam({
            teamFilterEnabled: true,
            partnerAuthUserId: 10,
            teamId: '',
            teams,
            users: [{ id: 10, displayName: 'Partner A', email: 'p@x.com' }],
            catalog,
        });
        expect(named.map((u) => u.id).sort((a, b) => a - b)).toEqual([10, 101, 102]);
        expect(named.find((u) => u.id === 101)?.displayName).toBe('Associate A');
    });

    it('keeps the full user list when partner filter is off', () => {
        const named = mergeNamedUsersForPartnerTeam({
            teamFilterEnabled: false,
            partnerAuthUserId: 10,
            teamId: '',
            teams,
            users: [{ id: 1, displayName: 'All', email: 'all@x.com' }],
            catalog: [],
        });
        expect(named).toEqual([{ id: 1, displayName: 'All', email: 'all@x.com' }]);
    });

    it('includes team members missing from project assignees in the pick list', () => {
        const catalog = [
            { id: 10, email: 'p@x.com', display_name: 'Partner A', position: 'Partner', is_blocked: false, is_archived: false, created_at: '' },
            { id: 101, email: 'a@x.com', display_name: 'Associate A', position: 'Associate', is_blocked: false, is_archived: false, created_at: '' },
            { id: 999, email: 'other@x.com', display_name: 'Other', position: 'Associate', is_blocked: false, is_archived: false, created_at: '' },
        ];
        const members = mergeProjectMembersWithPartnerTeam({
            members: [{ authUserId: 10, displayName: 'Partner A', position: 'Partner' }],
            teamFilterEnabled: true,
            partnerAuthUserId: 10,
            teamId: 't1',
            teams,
            catalog,
        });
        expect(members.map((m) => m.authUserId).sort((a, b) => a - b)).toEqual([10, 101]);
        expect(members.find((m) => m.authUserId === 101)?.position).toBe('Associate');
        expect(members.some((m) => m.authUserId === 999)).toBe(false);
    });
});
