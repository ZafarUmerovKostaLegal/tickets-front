import { describe, expect, it } from 'vitest';
import type { PartnerReportConfirmationRequest } from '@entities/time-tracking';
import { syntheticSnapshotFromPartnerRow } from './exportPartnerConfirmedReportExcel';

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
        projectName: 'Legal services',
        clientName: 'Nur Bukhara Solar',
        ...partial,
        reviewPriority: partial.reviewPriority ?? 'green',
    };
}

describe('syntheticSnapshotFromPartnerRow', () => {
    it('builds export snapshot without backend snapshot fetch', () => {
        const snapshot = syntheticSnapshotFromPartnerRow(row({ snapshotId: '' }));
        expect(snapshot.id).toBe('partner-confirmed-export');
        expect(snapshot.name).toBe('Legal services');
        expect(snapshot.filters).toMatchObject({
            dateFrom: '2026-05-01',
            dateTo: '2026-06-30',
            project_id: 'proj-1',
        });
    });

    it('uses explicit title override', () => {
        const snapshot = syntheticSnapshotFromPartnerRow(row(), 'Nur Bukhara Solar - Legal services - 2026-05-01-2026-06-30');
        expect(snapshot.name).toBe('Nur Bukhara Solar - Legal services - 2026-05-01-2026-06-30');
    });
});
