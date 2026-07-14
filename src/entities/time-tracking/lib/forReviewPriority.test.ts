import { describe, expect, it } from 'vitest';
import type { PartnerReportConfirmationRequest } from '../api/monolith';
import {
    compareForReviewByPriority,
    countForReviewByPriority,
    forReviewPriority,
} from './forReviewPriority';

function row(partial: Partial<PartnerReportConfirmationRequest> & Pick<PartnerReportConfirmationRequest, 'id'>): PartnerReportConfirmationRequest {
    return {
        id: partial.id,
        snapshotId: partial.snapshotId ?? 's1',
        projectId: partial.projectId ?? 'p1',
        dateFrom: partial.dateFrom ?? '2026-06-01',
        dateTo: partial.dateTo ?? '2026-06-30',
        title: partial.title ?? 't',
        status: partial.status ?? 'pending_partners',
        reviewPriority: partial.reviewPriority ?? 'yellow',
        submittedByAuthUserId: partial.submittedByAuthUserId ?? 1,
        requiredPartnerAuthUserIds: partial.requiredPartnerAuthUserIds ?? [10, 20],
        pendingPartnerAuthUserIds: partial.pendingPartnerAuthUserIds ?? [10, 20],
        signatures: partial.signatures ?? [],
        createdAt: partial.createdAt ?? '2026-07-01T10:00:00Z',
        updatedAt: partial.updatedAt ?? null,
    };
}

describe('forReviewPriority', () => {
    it('reads stored reviewPriority', () => {
        expect(forReviewPriority(row({ id: 'a', reviewPriority: 'red' }))).toBe('red');
        expect(forReviewPriority(row({ id: 'b', reviewPriority: 'green' }))).toBe('green');
    });

    it('falls back to yellow for missing/invalid', () => {
        expect(forReviewPriority({ reviewPriority: null })).toBe('yellow');
        expect(forReviewPriority({ reviewPriority: 'blue' })).toBe('yellow');
    });
});

describe('compareForReviewByPriority', () => {
    it('orders red before yellow before green, then oldest first', () => {
        const red = row({ id: 'red', reviewPriority: 'red', createdAt: '2026-07-03T10:00:00Z' });
        const yellow = row({ id: 'yellow', reviewPriority: 'yellow', createdAt: '2026-07-01T10:00:00Z' });
        const greenOld = row({ id: 'green-old', reviewPriority: 'green', createdAt: '2026-06-01T10:00:00Z' });
        const greenNew = row({ id: 'green-new', reviewPriority: 'green', createdAt: '2026-07-04T10:00:00Z' });
        const sorted = [greenNew, yellow, greenOld, red].sort(compareForReviewByPriority);
        expect(sorted.map((r) => r.id)).toEqual(['red', 'yellow', 'green-old', 'green-new']);
    });
});

describe('countForReviewByPriority', () => {
    it('counts tiers', () => {
        const counts = countForReviewByPriority([
            row({ id: '1', reviewPriority: 'red' }),
            row({ id: '2', reviewPriority: 'yellow' }),
            row({ id: '3', reviewPriority: 'green' }),
        ]);
        expect(counts).toEqual({ red: 1, yellow: 1, green: 1 });
    });
});
