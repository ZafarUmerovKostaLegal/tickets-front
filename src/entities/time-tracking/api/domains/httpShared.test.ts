import { describe, expect, it } from 'vitest';
import {
    isForbiddenError,
    isTimeTrackingHttpError,
    parseTimeTrackingPagedResponse,
    TimeTrackingHttpError,
    unwrapTimeTrackingListArray,
} from './httpShared';

describe('parseTimeTrackingPagedResponse', () => {
    it('maps a plain array and estimates total when page is full', () => {
        const page = parseTimeTrackingPagedResponse(
            [{ id: 1 }, { id: 2 }],
            (item) => {
                const id = Number((item as { id?: unknown }).id);
                return Number.isFinite(id) ? { id } : null;
            },
            { limit: 2, offset: 0 },
        );
        expect(page.items).toEqual([{ id: 1 }, { id: 2 }]);
        expect(page.total).toBe(3);
        expect(page.limit).toBe(2);
        expect(page.offset).toBe(0);
    });

    it('reads total/limit/offset from object envelope', () => {
        const page = parseTimeTrackingPagedResponse(
            { items: [{ n: 1 }, null, { n: 2 }], total: 10, limit: 5, offset: 5 },
            (item) => (item && typeof item === 'object' && 'n' in item ? { n: Number((item as { n: number }).n) } : null),
            { limit: 99, offset: 0 },
        );
        expect(page.items).toEqual([{ n: 1 }, { n: 2 }]);
        expect(page.total).toBe(10);
        expect(page.limit).toBe(5);
        expect(page.offset).toBe(5);
    });

    it('returns empty page for unexpected payloads', () => {
        const page = parseTimeTrackingPagedResponse(null, () => ({ ok: true }), { limit: 20, offset: 40 });
        expect(page).toEqual({ items: [], total: 0, limit: 20, offset: 40 });
    });
});

describe('unwrapTimeTrackingListArray', () => {
    it('accepts arrays and items wrappers', () => {
        expect(unwrapTimeTrackingListArray([1, 2])).toEqual([1, 2]);
        expect(unwrapTimeTrackingListArray({ items: [3] })).toEqual([3]);
        expect(unwrapTimeTrackingListArray({ items: 'x' })).toBeNull();
        expect(unwrapTimeTrackingListArray(null)).toBeNull();
    });
});

describe('TimeTrackingHttpError / isForbiddenError', () => {
    it('tags http errors by status', () => {
        const e = new TimeTrackingHttpError(403, 'Нет доступа');
        expect(isTimeTrackingHttpError(e)).toBe(true);
        expect(isTimeTrackingHttpError(e, 403)).toBe(true);
        expect(isTimeTrackingHttpError(e, 404)).toBe(false);
        expect(isTimeTrackingHttpError(new Error('x'))).toBe(false);
    });

    it('detects forbidden message patterns', () => {
        expect(isForbiddenError(new Error('HTTP 403'))).toBe(true);
        expect(isForbiddenError(new Error('Недостаточно прав'))).toBe(true);
        expect(isForbiddenError(new Error('timeout'))).toBe(false);
        expect(isForbiddenError('403')).toBe(false);
    });
});
