import {} from '@entities/time-tracking';
export function activeTimeTrackingTeams(teams) {
    return teams.filter((t) => !t.is_archived);
}
export function teamsForPartner(teams, partnerAuthUserId) {
    if (!Number.isFinite(partnerAuthUserId) || partnerAuthUserId <= 0)
        return [];
    return activeTimeTrackingTeams(teams).filter((t) => t.partner_auth_user_id === partnerAuthUserId);
}
export function partnerOptionsFromTeams(teams) {
    const map = new Map();
    for (const team of activeTimeTrackingTeams(teams)) {
        const label = (team.partner_display_name || '').trim() || `Партнёр #${team.partner_auth_user_id}`;
        if (!map.has(team.partner_auth_user_id))
            map.set(team.partner_auth_user_id, label);
    }
    return [...map.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
        .map(([id, label]) => ({ id, label }));
}
export function resolveTeamMemberUserIds(teams, partnerAuthUserId, teamId) {
    if (!Number.isFinite(partnerAuthUserId) || partnerAuthUserId <= 0)
        return [];
    const partnerTeams = teamsForPartner(teams, partnerAuthUserId);
    const scoped = teamId?.trim()
        ? partnerTeams.filter((t) => t.id === teamId.trim())
        : partnerTeams;
    const ids = new Set([Math.round(partnerAuthUserId)]);
    for (const team of scoped) {
        for (const memberId of team.member_auth_user_ids) {
            if (Number.isFinite(memberId) && memberId > 0)
                ids.add(Math.round(memberId));
        }
    }
    return [...ids].sort((a, b) => a - b);
}
export function pickDefaultTeamId(teams, partnerAuthUserId) {
    const list = teamsForPartner(teams, partnerAuthUserId);
    return list.length === 1 ? list[0].id : '';
}
export function resolveEffectiveReportPreviewUserIds(params) {
    const { teamFilterEnabled, teamFilterPartnerId, teamFilterTeamId, teams, selectedUserIds } = params;
    if (!teamFilterEnabled || teamFilterPartnerId <= 0)
        return selectedUserIds;
    const teamMemberIds = resolveTeamMemberUserIds(teams, teamFilterPartnerId, teamFilterTeamId.trim() || undefined);
    if (teamMemberIds.length === 0)
        return selectedUserIds;
    if (selectedUserIds.length === 0)
        return teamMemberIds;
    const allowed = new Set(teamMemberIds);
    const picked = selectedUserIds.filter((id) => allowed.has(id));
    return picked.length > 0 ? picked : teamMemberIds;
}
function catalogUserToNamed(u) {
    if (u.is_archived || u.is_blocked || u.id <= 0)
        return null;
    return {
        id: u.id,
        displayName: (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim(),
        email: u.email,
        initials: u.initials ?? null,
    };
}
function mergeAccessRows(primary, extra) {
    const byId = new Map();
    for (const row of extra) {
        if (row.authUserId > 0)
            byId.set(row.authUserId, row);
    }
    for (const row of primary) {
        if (row.authUserId > 0)
            byId.set(row.authUserId, row);
    }
    return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
}
function catalogUserToAccessRow(u) {
    const named = catalogUserToNamed(u);
    if (!named)
        return null;
    return {
        authUserId: named.id,
        displayName: named.displayName,
        position: (u.position ?? '').trim(),
    };
}
export function mergeNamedUsersForPartnerTeam(params) {
    const { teamFilterEnabled, partnerAuthUserId, teamId, teams, users, catalog } = params;
    if (!teamFilterEnabled || partnerAuthUserId <= 0)
        return users;
    const allowedIds = resolveTeamMemberUserIds(teams, partnerAuthUserId, teamId.trim() || undefined);
    if (allowedIds.length === 0)
        return users;
    const allowed = new Set(allowedIds);
    const byId = new Map();
    for (const user of users) {
        if (allowed.has(user.id))
            byId.set(user.id, user);
    }
    for (const row of catalog) {
        if (!allowed.has(row.id) || byId.has(row.id))
            continue;
        const named = catalogUserToNamed(row);
        if (named)
            byId.set(named.id, named);
    }
    return allowedIds.map((id) => byId.get(id)).filter((u) => Boolean(u));
}
export function mergeProjectMembersWithPartnerTeam(params) {
    const { members, teamFilterEnabled, partnerAuthUserId, teamId, teams, catalog } = params;
    if (!teamFilterEnabled || partnerAuthUserId <= 0)
        return members;
    const allowedIds = resolveTeamMemberUserIds(teams, partnerAuthUserId, teamId.trim() || undefined);
    if (allowedIds.length === 0)
        return members;
    const extra = catalog
        .filter((u) => allowedIds.includes(u.id))
        .map(catalogUserToAccessRow)
        .filter((row) => Boolean(row));
    const merged = mergeAccessRows(members, extra);
    const allowed = new Set(allowedIds);
    const scoped = merged.filter((row) => allowed.has(row.authUserId));
    return scoped.length > 0 ? scoped : merged;
}
