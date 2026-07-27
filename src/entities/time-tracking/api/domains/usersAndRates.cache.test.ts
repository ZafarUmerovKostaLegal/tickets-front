import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock('@shared/api', () => ({ apiFetch: apiFetchMock }));

import {
    createManualTimeTrackingUser,
    invalidateTimeTrackingUsersCache,
    listTimeTrackingUsers,
    normalizeTimeTrackingUserRow,
} from './usersAndRates';

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('time-tracking users request cache', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
        invalidateTimeTrackingUsersCache();
    });

    it('normalizes mixed API aliases', () => {
        expect(normalizeTimeTrackingUserRow({
            authUserId: '42',
            email: ' user@example.com ',
            displayName: ' User ',
            job_title: ' Lawyer ',
            weeklyCapacityHours: '37.5',
            canTransferTimeWithoutProjectAccess: '1',
            isBlocked: false,
            isArchived: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
        })).toMatchObject({
            id: 42,
            email: 'user@example.com',
            display_name: 'User',
            position: 'Lawyer',
            weekly_capacity_hours: '37.5',
            can_transfer_time_without_project_access: true,
            is_archived: true,
        });
        expect(normalizeTimeTrackingUserRow(null)).toBeNull();
        expect(normalizeTimeTrackingUserRow({ id: 0 })).toBeNull();
    });

    it('shares and reuses the parsed users list', async () => {
        apiFetchMock.mockResolvedValue(json([{ id: 1, email: 'one@example.com' }]));

        const [first, second] = await Promise.all([
            listTimeTrackingUsers(),
            listTimeTrackingUsers(),
        ]);

        expect(first).toEqual(second);
        expect(first).toHaveLength(1);
        expect(apiFetchMock).toHaveBeenCalledTimes(1);
        await listTimeTrackingUsers();
        expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    it('invalidates the list after a user mutation', async () => {
        apiFetchMock
            .mockResolvedValueOnce(json([{ id: 1, email: 'one@example.com' }]))
            .mockResolvedValueOnce(json({ id: 2_000_000_001, displayName: 'Manual user' }))
            .mockResolvedValueOnce(json([
                { id: 1, email: 'one@example.com' },
                { id: 2_000_000_001, displayName: 'Manual user' },
            ]));

        await listTimeTrackingUsers();
        await expect(createManualTimeTrackingUser({ displayName: 'Manual user' })).resolves.toMatchObject({
            id: 2_000_000_001,
            is_manual: true,
        });
        await expect(listTimeTrackingUsers()).resolves.toHaveLength(2);
        expect(apiFetchMock).toHaveBeenCalledTimes(3);
    });
});
