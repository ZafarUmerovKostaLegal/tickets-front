export function buildProjectArchiveTogglePatch(archiving) {
    if (archiving)
        return { isArchived: true, isPaused: false };
    return {
        isArchived: false,
        endDate: null,
    };
}
export function buildProjectPauseTogglePatch(pausing) {
    return { isPaused: pausing };
}
