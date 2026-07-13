import type { TimeManagerClientProjectPatchPayload } from '@entities/time-tracking';


export function buildProjectArchiveTogglePatch(archiving: boolean): TimeManagerClientProjectPatchPayload {
    if (archiving)
        return { isArchived: true, isPaused: false };
    return {
        isArchived: false,
        endDate: null,
    };
}


export function buildProjectPauseTogglePatch(pausing: boolean): TimeManagerClientProjectPatchPayload {
    return { isPaused: pausing };
}
