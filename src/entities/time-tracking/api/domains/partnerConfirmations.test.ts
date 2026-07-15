import { describe, expect, it } from 'vitest';
import { parsePartnerPendingListPage } from './partnerConfirmations';

function pendingItem(overrides: Record<string, unknown> = {}) {
    return {
        id: 'r1',
        snapshotId: 's1',
        projectId: 'p1',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-07',
        title: 'Week',
        status: 'pending_partners',
        reviewPriority: 'red',
        submittedByAuthUserId: 7,
        requiredPartnerAuthUserIds: [1, 2],
        pendingPartnerAuthUserIds: [1],
        signatures: [],
        createdAt: '2026-07-08T10:00:00Z',
        updatedAt: null,
        ...overrides,
    };
}

describe('parsePartnerPendingListPage', () => {
    it('parses items envelope with total and priorityCounts', () => {
        const page = parsePartnerPendingListPage({
            items: [pendingItem()],
            total: 4,
            page: 2,
            pageSize: 10,
            priorityCounts: { all: 4, red: 1, yellow: 2, green: 1 },
        });
        expect(page.items).toHaveLength(1);
        expect(page.items[0]?.id).toBe('r1');
        expect(page.items[0]?.reviewPriority).toBe('red');
        expect(page.total).toBe(4);
        expect(page.page).toBe(2);
        expect(page.pageSize).toBe(10);
        expect(page.priorityCounts).toEqual({ all: 4, red: 1, yellow: 2, green: 1 });
    });

    it('treats bare arrays as a single page and drops invalid rows', () => {
        const page = parsePartnerPendingListPage([
            pendingItem({ id: 'a' }),
            { id: null },
        ]);
        expect(page.items.map((x) => x.id)).toEqual(['a']);
        expect(page.total).toBe(1);
    });

    it('returns empty list for garbage input', () => {
        expect(parsePartnerPendingListPage(null).items).toEqual([]);
        expect(parsePartnerPendingListPage({ items: 'nope' }).items).toEqual([]);
    });
});
