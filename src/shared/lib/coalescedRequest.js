/**
 * Batches bursty invalidation events and guarantees at most one active task.
 * If another event arrives while the task is running, exactly one trailing
 * execution is scheduled after it settles.
 */
export function createCoalescedRequest(task, delayMs = 100) {
    let timer;
    let inFlight;
    let trailing = false;
    let cancelled = false;
    const schedule = () => {
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
        cancel() {
            cancelled = true;
            trailing = false;
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
        },
    };
}
