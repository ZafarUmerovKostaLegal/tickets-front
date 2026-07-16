import { describe, expect, it } from 'vitest';
import type { PartnerConfirmedReportComment, PartnerReportConfirmationRequest } from '@entities/time-tracking';
import {
    applyPartnerConfirmationCommentsSummary,
    rowNeedsPartnerConfirmationCommentsHydration,
    summarizePartnerConfirmationComments,
} from './partnerConfirmationCommentsSummary';

function comment(partial: Partial<PartnerConfirmedReportComment> & Pick<PartnerConfirmedReportComment, 'id' | 'text'>): PartnerConfirmedReportComment {
    return {
        authUserId: 1,
        createdAt: '2026-07-09T10:00:00.000Z',
        ...partial,
    };
}

function row(partial: Partial<PartnerReportConfirmationRequest> = {}): PartnerReportConfirmationRequest {
    return {
        id: 'req-1',
        snapshotId: 'snap-1',
        projectId: 'proj-1',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        title: 'Report',
        status: 'pending',
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

describe('summarizePartnerConfirmationComments', () => {
    it('returns zero and null last comment for empty list', () => {
        expect(summarizePartnerConfirmationComments([])).toEqual({
            commentsCount: 0,
            lastComment: null,
        });
    });

    it('uses the last comment as preview source', () => {
        const comments = [
            comment({ id: 'c1', text: 'first' }),
            comment({ id: 'c2', text: 'second' }),
        ];
        expect(summarizePartnerConfirmationComments(comments)).toEqual({
            commentsCount: 2,
            lastComment: comments[1],
        });
    });
});

describe('rowNeedsPartnerConfirmationCommentsHydration', () => {
    it('needs hydration when commentsCount is missing', () => {
        expect(rowNeedsPartnerConfirmationCommentsHydration(row())).toBe(true);
    });

    it('does not hydrate when commentsCount is already known', () => {
        expect(rowNeedsPartnerConfirmationCommentsHydration(row({ commentsCount: 0 }))).toBe(false);
        expect(rowNeedsPartnerConfirmationCommentsHydration(row({ commentsCount: 3 }))).toBe(false);
    });
});

describe('applyPartnerConfirmationCommentsSummary', () => {
    it('patches count and last comment onto the row', () => {
        const last = comment({ id: 'c9', text: 'latest' });
        expect(applyPartnerConfirmationCommentsSummary(row(), {
            commentsCount: 1,
            lastComment: last,
        })).toMatchObject({
            id: 'req-1',
            commentsCount: 1,
            lastComment: last,
        });
    });
});
