import type { TimeManagerClientProjectPatchPayload } from '@entities/time-tracking';

/** Патч для архивации / восстановления проекта из списка проектов. */
export function buildProjectArchiveTogglePatch(archiving: boolean): TimeManagerClientProjectPatchPayload {
    if (archiving)
        return { isArchived: true, isPaused: false };
    return {
        isArchived: false,
        endDate: null,
    };
}

/** Патч для постановки / снятия паузы проекта. */
export function buildProjectPauseTogglePatch(pausing: boolean): TimeManagerClientProjectPatchPayload {
    return { isPaused: pausing };
}
