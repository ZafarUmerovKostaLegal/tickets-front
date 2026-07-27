import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
}));

vi.mock('@shared/api', () => ({ apiFetch: apiFetchMock }));
vi.mock('@shared/lib/safeOAuthRedirect', () => ({
    assertHttpsMicrosoftOAuthRedirectUrl: (url: string) => new URL(url),
}));

import {
    createCalendarEvent,
    getCalendarEvents,
    getCalendarStatus,
    invalidateCalendarApiCache,
} from './calendarApi';

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('calendar API request policies', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
        invalidateCalendarApiCache();
    });

    it('coalesces concurrent status requests and reuses the result', async () => {
        apiFetchMock.mockResolvedValue(json({ connected: true, mailReady: true }));

        const [first, second] = await Promise.all([
            getCalendarStatus(),
            getCalendarStatus(),
        ]);
        const third = await getCalendarStatus();

        expect(first).toEqual({ connected: true, mailReady: true });
        expect(second).toEqual(first);
        expect(third).toEqual(first);
        expect(apiFetchMock).toHaveBeenCalledTimes(1);
        expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/todos/calendar/status', expect.objectContaining({
            signal: expect.any(AbortSignal),
            getReuseWindowMs: 30_000,
        }));
    });

    it('caches event ranges and invalidates them after creating an event', async () => {
        apiFetchMock.mockImplementation((_path: string, init?: RequestInit) => {
            if (init?.method === 'POST')
                return Promise.resolve(json({ id: 'created' }));
            return Promise.resolve(json([{ id: 'event-1' }]));
        });

        await getCalendarEvents('2026-07-28', '2026-07-29');
        await getCalendarEvents('2026-07-28', '2026-07-29');
        expect(apiFetchMock).toHaveBeenCalledTimes(1);

        await createCalendarEvent({
            subject: 'Review',
            start: '2026-07-28T10:00:00Z',
            end: '2026-07-28T11:00:00Z',
        });
        await getCalendarEvents('2026-07-28', '2026-07-29');

        expect(apiFetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not start a request for an already aborted consumer', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(getCalendarStatus(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(apiFetchMock).not.toHaveBeenCalled();
    });
});
