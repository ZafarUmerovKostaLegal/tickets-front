import { describe, expect, it } from 'vitest';
import { parsePartnerReportConfirmationRequest } from '@entities/time-tracking';
import { partnerReportIsEmpty } from '@pages/time-tracking/ui/PartnerReportEmptyBadge';

const base = {
    id: 'req-1',
    snapshotId: 'snap-1',
    projectId: 'proj-1',
    dateFrom: '2026-05-01',
    dateTo: '2026-06-30',
    submittedByAuthUserId: 1,
    requiredPartnerAuthUserIds: [],
    pendingPartnerAuthUserIds: [],
    signatures: [],
    title: 'Test',
    status: 'fully_confirmed',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: null,
};

describe('partnerReportIsEmpty', () => {
    it('uses isEmpty from API when present', () => {
        const row = parsePartnerReportConfirmationRequest({ ...base, isEmpty: true });
        expect(row).not.toBeNull();
        expect(partnerReportIsEmpty(row!)).toBe(true);
    });

    it('derives empty from entryCount when isEmpty is absent', () => {
        const row = parsePartnerReportConfirmationRequest({ ...base, entryCount: 0 });
        expect(row).not.toBeNull();
        expect(partnerReportIsEmpty(row!)).toBe(true);
    });

    it('returns false when entryCount is positive', () => {
        const row = parsePartnerReportConfirmationRequest({ ...base, entryCount: 3, isEmpty: false });
        expect(row).not.toBeNull();
        expect(partnerReportIsEmpty(row!)).toBe(false);
    });
});
