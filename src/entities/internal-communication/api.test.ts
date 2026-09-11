import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
}));

vi.mock('@shared/api', () => ({ apiFetch: apiFetchMock }));

import {
    createInternalExtension,
    deleteInternalExtension,
    fetchInternalExtensions,
    patchInternalExtension,
} from './api';

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('internal-communication api', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
    });

    it('loads and maps the directory', async () => {
        apiFetchMock.mockResolvedValue(json([{ id: 1, full_name: 'Reception', extension: '11' }]));
        await expect(fetchInternalExtensions()).resolves.toEqual([
            { id: 1, fullName: 'Reception', extension: '11' },
        ]);
        expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/contacts/internal-extensions', expect.any(Object));
    });

    it('creates with camelCase body', async () => {
        apiFetchMock.mockResolvedValue(json({ id: 2, fullName: 'IT', extension: '22' }, 201));
        await expect(createInternalExtension({ fullName: 'IT', extension: '22' })).resolves.toEqual({
            id: 2,
            fullName: 'IT',
            extension: '22',
        });
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/api/v1/contacts/internal-extensions',
            expect.objectContaining({ method: 'POST' }),
        );
        const init = apiFetchMock.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(String(init.body))).toEqual({ fullName: 'IT', extension: '22' });
    });

    it('patches by id', async () => {
        apiFetchMock.mockResolvedValue(json({ id: 2, full_name: 'Helpdesk', extension: '220' }));
        await expect(patchInternalExtension(2, { fullName: 'Helpdesk', extension: '220' })).resolves.toEqual({
            id: 2,
            fullName: 'Helpdesk',
            extension: '220',
        });
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/api/v1/contacts/internal-extensions/2',
            expect.objectContaining({ method: 'PATCH' }),
        );
    });

    it('deletes by id', async () => {
        apiFetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        await expect(deleteInternalExtension(2)).resolves.toBeUndefined();
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/api/v1/contacts/internal-extensions/2',
            expect.objectContaining({ method: 'DELETE' }),
        );
    });

    it('surfaces API detail on failure', async () => {
        apiFetchMock.mockResolvedValue(json({ detail: 'Такой внутренний номер уже есть' }, 409));
        await expect(createInternalExtension({ fullName: 'X', extension: '11' }))
            .rejects.toThrow('Такой внутренний номер уже есть');
    });
});
