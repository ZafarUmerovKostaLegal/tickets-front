/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installStaleBundleReload } from './staleBundleError';

describe('stale bundle reload', () => {
    afterEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('keeps the chunk error when it cannot reload, so the import fails instead of resolving to undefined', () => {
        const reload = vi.fn();
        vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);
        installStaleBundleReload();

        const first = new Event('vite:preloadError', { cancelable: true });
        window.dispatchEvent(first);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(first.defaultPrevented).toBe(true);

        const second = new Event('vite:preloadError', { cancelable: true });
        window.dispatchEvent(second);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(second.defaultPrevented).toBe(false);
    });
});
