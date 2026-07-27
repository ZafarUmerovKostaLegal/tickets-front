import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoalescedRequest } from './coalescedRequest';

describe('createCoalescedRequest', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('batches a burst into one task', async () => {
        vi.useFakeTimers();
        const task = vi.fn(async () => { });
        const request = createCoalescedRequest(task, 100);

        request.schedule();
        request.schedule();
        request.schedule();
        await vi.advanceTimersByTimeAsync(100);

        expect(task).toHaveBeenCalledTimes(1);
    });

    it('runs only one trailing task when events arrive during a request', async () => {
        vi.useFakeTimers();
        let finish!: () => void;
        const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        const request = createCoalescedRequest(task, 100);

        request.schedule();
        await vi.advanceTimersByTimeAsync(100);
        request.schedule();
        request.schedule();
        finish();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(100);

        expect(task).toHaveBeenCalledTimes(2);
    });

    it('cancels a scheduled task', async () => {
        vi.useFakeTimers();
        const task = vi.fn(async () => { });
        const request = createCoalescedRequest(task, 100);

        request.schedule();
        request.cancel();
        await vi.advanceTimersByTimeAsync(100);

        expect(task).not.toHaveBeenCalled();
    });
});
