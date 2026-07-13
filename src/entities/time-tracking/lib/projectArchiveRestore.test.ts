import { describe, expect, it } from 'vitest';
import {
    buildProjectArchiveTogglePatch,
    buildProjectPauseTogglePatch,
} from '@entities/time-tracking/lib/projectArchiveRestore';

describe('buildProjectArchiveTogglePatch', () => {
    it('archives with isArchived and clears pause', () => {
        expect(buildProjectArchiveTogglePatch(true)).toEqual({ isArchived: true, isPaused: false });
    });

    it('restores by clearing archive flag and end date', () => {
        expect(buildProjectArchiveTogglePatch(false)).toEqual({
            isArchived: false,
            endDate: null,
        });
    });
});

describe('buildProjectPauseTogglePatch', () => {
    it('pauses project', () => {
        expect(buildProjectPauseTogglePatch(true)).toEqual({ isPaused: true });
    });

    it('resumes project', () => {
        expect(buildProjectPauseTogglePatch(false)).toEqual({ isPaused: false });
    });
});
