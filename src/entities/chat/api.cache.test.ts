import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
}));

vi.mock('@shared/api', () => ({ apiFetch: apiFetchMock }));

import { fetchChatRoom, fetchChatRooms, invalidateChatRoomsCache } from './api';

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('chat room request policies', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
        invalidateChatRoomsCache();
    });

    it('coalesces and caches room list requests', async () => {
        apiFetchMock.mockResolvedValue(json({ items: [{ id: 7, kind: 'dm' }] }));

        const [first, second] = await Promise.all([fetchChatRooms(), fetchChatRooms()]);
        const third = await fetchChatRooms();

        expect(first).toHaveLength(1);
        expect(second).toEqual(first);
        expect(third).toEqual(first);
        expect(apiFetchMock).toHaveBeenCalledTimes(1);
        expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/chat/rooms', expect.objectContaining({
            signal: expect.any(AbortSignal),
            getReuseWindowMs: 10_000,
        }));
    });

    it('caches individual rooms until chat data is invalidated', async () => {
        apiFetchMock.mockImplementation(() => Promise.resolve(json({ id: 11, kind: 'group', title: 'Legal' })));

        await fetchChatRoom(11);
        await fetchChatRoom(11);
        expect(apiFetchMock).toHaveBeenCalledTimes(1);

        invalidateChatRoomsCache();
        await fetchChatRoom(11);
        expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });
});
