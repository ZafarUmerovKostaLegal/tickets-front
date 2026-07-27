export type CoalescedRequest = {
    schedule(): void;
    cancel(): void;
};

/**
 * Batches bursty invalidation events and guarantees at most one active task.
 * If another event arrives while the task is running, exactly one trailing
 * execution is scheduled after it settles.
 */
export function createCoalescedRequest(
    task: () => Promise<void>,
    delayMs = 100,
): CoalescedRequest {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: Promise<void> | undefined;
    let trailing = false;
    let cancelled = false;

    const schedule = (): void => {
        if (cancelled)
            return;
        if (inFlight) {
            trailing = true;
            return;
        }
        if (timer !== undefined)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            if (cancelled)
                return;
            const current = Promise.resolve().then(task);
            inFlight = current;
            void current
                .catch(() => { })
                .finally(() => {
                    if (inFlight === current)
                        inFlight = undefined;
                    if (trailing && !cancelled) {
                        trailing = false;
                        schedule();
                    }
                });
        }, Math.max(0, delayMs));
    };

    return {
        schedule,
        cancel(): void {
            cancelled = true;
            trailing = false;
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
        },
    };
}
