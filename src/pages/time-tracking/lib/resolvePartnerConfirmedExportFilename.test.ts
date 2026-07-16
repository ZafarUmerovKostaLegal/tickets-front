import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerReportConfirmationRequest } from '@entities/time-tracking';

vi.mock('@entities/time-tracking/lib/partnerReportDisplayLookups', () => ({
    loadPartnerReportDisplayLookups: vi.fn(async () => ({
        projectRows: [{ id: 'proj-1', name: 'Legal services', client_id: 'client-1' }],
        clientNamesById: new Map([['client-1', 'Nur Bukhara Solar']]),
        clientMetaByProjectId: new Map([
            ['proj-1', { clientId: 'client-1', clientName: 'Nur Bukhara Solar' }],
        ]),
    })),
}));

import { loadPartnerReportDisplayLookups } from '@entities/time-tracking/lib/partnerReportDisplayLookups';
import { resolvePartnerConfirmedExportFilename } from './resolvePartnerConfirmedExportFilename';

function row(partial: Partial<PartnerReportConfirmationRequest> = {}): PartnerReportConfirmationRequest {
    return {
        id: 'req-1',
        snapshotId: 'snap-1',
        projectId: 'proj-1',
        dateFrom: '2026-05-01',
        dateTo: '2026-06-30',
        title: 'Legal services',
        status: 'fully_confirmed',
        submittedByAuthUserId: 1,
        requiredPartnerAuthUserIds: [],
        pendingPartnerAuthUserIds: [],
        signatures: [],
        createdAt: '2026-07-09T10:00:00.000Z',
        updatedAt: null,
        ...partial,
        reviewPriority: partial.reviewPriority ?? 'green',
    };
}

describe('resolvePartnerConfirmedExportFilename', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses row labels when present', async () => {
        await expect(resolvePartnerConfirmedExportFilename(row({
            clientName: 'Nur Bukhara Solar',
            projectName: 'Legal services',
        }))).resolves.toBe('Nur Bukhara Solar - Legal services - 2026-05-01-2026-06-30.xlsx');
        expect(loadPartnerReportDisplayLookups).not.toHaveBeenCalled();
    });

    it('resolves client and project from directories when row labels are missing', async () => {
        await expect(resolvePartnerConfirmedExportFilename(row({
            clientName: undefined,
            projectName: undefined,
        }))).resolves.toBe('Nur Bukhara Solar - Legal services - 2026-05-01-2026-06-30.xlsx');
    });

    it('falls back to title for project when project name is missing in directories', async () => {
        vi.mocked(loadPartnerReportDisplayLookups).mockResolvedValueOnce({
            projectRows: [],
            clientNamesById: new Map([['client-1', 'Nur Bukhara Solar']]),
            clientMetaByProjectId: new Map(),
        });
        await expect(resolvePartnerConfirmedExportFilename(row({
            clientName: 'Nur Bukhara Solar',
            projectName: undefined,
            title: 'Court case',
        }))).resolves.toBe('Nur Bukhara Solar - Court case - 2026-05-01-2026-06-30.xlsx');
    });
});
