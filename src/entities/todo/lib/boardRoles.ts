
export function normalizeBoardRole(role: string | null | undefined): string | null {
    if (role == null)
        return null;
    const r = role.trim().toLowerCase();
    return r || null;
}

export function isViewerBoardRole(role: string | null | undefined): boolean {
    return normalizeBoardRole(role) === 'viewer';
}

export function isParticipantBoardRole(role: string | null | undefined): boolean {
    return normalizeBoardRole(role) === 'participant';
}


export function canEditKanbanStructure(role: string | null | undefined): boolean {
    const r = normalizeBoardRole(role);
    return r === 'owner' || r === 'editor';
}

export function canManageBoardMembers(role: string | null | undefined): boolean {
    return normalizeBoardRole(role) === 'owner';
}
