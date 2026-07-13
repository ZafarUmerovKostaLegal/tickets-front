import { describe, expect, it } from 'vitest';
import {
    buildMonthlyArchiveTree,
    filterReportsByQuery,
    monthKeyFromDateTo,
} from './partnerMonthlyArchive';
import type { PartnerReportConfirmationRequest } from '@entities/time-tracking';

function row(partial: Partial<PartnerReportConfirmationRequest> & Pick<PartnerReportConfirmationRequest, 'id' | 'dateTo'>): PartnerReportConfirmationRequest {
    return {
        snapshotId: 'snap',
        projectId: 'proj',
        dateFrom: '2026-06-01',
        title: 'T',
        status: 'fully_confirmed',
        submittedByAuthUserId: 1,
        requiredPartnerAuthUserIds: [],
        pendingPartnerAuthUserIds: [],
        signatures: [],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: null,
        ...partial,
    };
}

describe('partnerMonthlyArchive', () => {
    it('builds month key from dateTo', () => {
        expect(monthKeyFromDateTo('2026-06-30')).toBe('2026-06');
        expect(monthKeyFromDateTo('bad')).toBeNull();
    });

    it('groups reports by year and month descending', () => {
        const tree = buildMonthlyArchiveTree([
            row({ id: 'a', dateTo: '2026-06-30', title: 'A' }),
            row({ id: 'b', dateTo: '2026-05-31', title: 'B' }),
            row({ id: 'c', dateTo: '2025-12-31', title: 'C' }),
        ]);
        expect(tree.map((y) => y.year)).toEqual([2026, 2025]);
        expect(tree[0].months.map((m) => m.key)).toEqual(['2026-06', '2026-05']);
        expect(tree[0].reportCount).toBe(2);
        expect(tree[1].months[0].reports[0].id).toBe('c');
    });

    it('filters by client/project query', () => {
        const list = [
            row({ id: 'a', dateTo: '2026-06-30', title: 'Alpha' }),
            row({ id: 'b', dateTo: '2026-06-30', title: 'Beta' }),
        ];
        const filtered = filterReportsByQuery(list, 'alp', () => ({ project: 'P', client: 'C' }));
        expect(filtered.map((r) => r.id)).toEqual(['a']);
    });
});
