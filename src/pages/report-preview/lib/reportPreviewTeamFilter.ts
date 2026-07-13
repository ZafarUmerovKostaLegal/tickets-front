import type { TimeTrackingTeamRow } from '@entities/time-tracking';

export function activeTimeTrackingTeams(teams: TimeTrackingTeamRow[]): TimeTrackingTeamRow[] {
    return teams.filter((t) => !t.is_archived);
}

export function teamsForPartner(teams: TimeTrackingTeamRow[], partnerAuthUserId: number): TimeTrackingTeamRow[] {
    if (!Number.isFinite(partnerAuthUserId) || partnerAuthUserId <= 0)
        return [];
    return activeTimeTrackingTeams(teams).filter((t) => t.partner_auth_user_id === partnerAuthUserId);
}

export function partnerOptionsFromTeams(teams: TimeTrackingTeamRow[]): Array<{ id: number; label: string }> {
    const map = new Map<number, string>();
    for (const team of activeTimeTrackingTeams(teams)) {
        const label = (team.partner_display_name || '').trim() || `Партнёр #${team.partner_auth_user_id}`;
        if (!map.has(team.partner_auth_user_id))
            map.set(team.partner_auth_user_id, label);
    }
    return [...map.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
        .map(([id, label]) => ({ id, label }));
}

export function resolveTeamMemberUserIds(
    teams: TimeTrackingTeamRow[],
    partnerAuthUserId: number,
    teamId?: string,
): number[] {
    if (!Number.isFinite(partnerAuthUserId) || partnerAuthUserId <= 0)
        return [];
    const partnerTeams = teamsForPartner(teams, partnerAuthUserId);
    const scoped = teamId?.trim()
        ? partnerTeams.filter((t) => t.id === teamId.trim())
        : partnerTeams;
    const ids = new Set<number>([Math.round(partnerAuthUserId)]);
    for (const team of scoped) {
        for (const memberId of team.member_auth_user_ids) {
            if (Number.isFinite(memberId) && memberId > 0)
                ids.add(Math.round(memberId));
        }
    }
    return [...ids].sort((a, b) => a - b);
}

export function pickDefaultTeamId(teams: TimeTrackingTeamRow[], partnerAuthUserId: number): string {
    const list = teamsForPartner(teams, partnerAuthUserId);
    return list.length === 1 ? list[0].id : '';
}

export function resolveEffectiveReportPreviewUserIds(params: {
    teamFilterEnabled: boolean;
    teamFilterPartnerId: number;
    teamFilterTeamId: string;
    teams: TimeTrackingTeamRow[];
    selectedUserIds: number[];
}): number[] {
    const { teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teams, selectedUserIds } = params;
    if (!teamFilterEnabled || teamFilterPartnerId <= 0)
        return selectedUserIds;
    const teamMemberIds = resolveTeamMemberUserIds(
        teams,
        teamFilterPartnerId,
        teamFilterTeamId.trim() || undefined,
    );
    if (teamMemberIds.length === 0)
        return selectedUserIds;
    if (selectedUserIds.length === 0)
        return teamMemberIds;
    const allowed = new Set(teamMemberIds);
    const picked = selectedUserIds.filter((id) => allowed.has(id));
    return picked.length > 0 ? picked : teamMemberIds;
}
