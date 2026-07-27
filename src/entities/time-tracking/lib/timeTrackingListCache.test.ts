import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getTimeTrackingCached,
    invalidateTimeTrackingListCache,
    setTimeTrackingCached,
} from './timeTrackingListCache';

describe('timeTrackingListCache', () => {
    beforeEach(() => {
        invalidateTimeTrackingListCache();
        vi.useRealTimers();
    });

    it('keeps independent query variants instead of evicting the previous key', () => {
        setTimeTrackingCached('clients', 'clients:false', ['active']);
        setTimeTrackingCached('clients', 'clients:true', ['all']);

        expect(getTimeTrackingCached('clients', 'clients:false')).toEqual(['active']);
        expect(getTimeTrackingCached('clients', 'clients:true')).toEqual(['all']);
    });

    it('drops expired entries', () => {
        vi.useFakeTimers();
        setTimeTrackingCached('projects', 'projects:false', ['project'], 100);

        vi.advanceTimersByTime(101);

        expect(getTimeTrackingCached('projects', 'projects:false')).toBeNull();
    });

    it('invalidates every cache kind after a mutation', () => {
        setTimeTrackingCached('clients', 'clients:false', ['client']);
        setTimeTrackingCached('projects', 'projects:false', ['project']);
        setTimeTrackingCached('picker', 'picker:false', ['picker']);

        invalidateTimeTrackingListCache();

        expect(getTimeTrackingCached('clients', 'clients:false')).toBeNull();
        expect(getTimeTrackingCached('projects', 'projects:false')).toBeNull();
        expect(getTimeTrackingCached('picker', 'picker:false')).toBeNull();
    });
});
