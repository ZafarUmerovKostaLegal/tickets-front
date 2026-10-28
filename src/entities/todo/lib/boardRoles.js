export function normalizeBoardRole(role) {
    if (role == null)
        return null;
    const r = role.trim().toLowerCase();
    return r || null;
}
export function isViewerBoardRole(role) {
    return normalizeBoardRole(role) === 'viewer';
}
export function isParticipantBoardRole(role) {
    return normalizeBoardRole(role) === 'participant';
}
export function canEditKanbanStructure(role) {
    const r = normalizeBoardRole(role);
    return r === 'owner' || r === 'editor';
}
export function canManageBoardMembers(role) {
    return normalizeBoardRole(role) === 'owner';
}
/** Hard-delete/archive of a board is owner-only (matches the todos API). */
export function canDeleteTodoBoard(role) {
    return normalizeBoardRole(role) === 'owner';
}
