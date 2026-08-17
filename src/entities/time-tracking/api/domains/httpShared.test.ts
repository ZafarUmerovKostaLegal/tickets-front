import { describe, expect, it, vi } from 'vitest';
import {
    isForbiddenError,
    isTimeTrackingHttpError,
    isTimeTrackingUnavailableError,
    parseTimeTrackingPagedResponse,
    reportsThrowIfNotOk,
    TIME_TRACKING_UNAVAILABLE_MESSAGE,
    TimeTrackingHttpError,
    throwIfNotOk,
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

describe('time-tracking unavailable mapping', () => {
    it('maps 503 responses to a stable user-facing message without console.error', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res503 = new Response(JSON.stringify({ detail: 'Time tracking service unavailable' }), { status: 503 });
        await expect(throwIfNotOk(res503)).rejects.toMatchObject({
            status: 503,
            message: TIME_TRACKING_UNAVAILABLE_MESSAGE,
        });
        expect(spy).not.toHaveBeenCalled();
        const reportsRes = new Response(JSON.stringify({ detail: 'Time tracking service unavailable' }), { status: 503 });
        await expect(reportsThrowIfNotOk(reportsRes)).rejects.toMatchObject({
            status: 503,
            message: TIME_TRACKING_UNAVAILABLE_MESSAGE,
        });
        expect(isTimeTrackingUnavailableError(new TimeTrackingHttpError(503, TIME_TRACKING_UNAVAILABLE_MESSAGE))).toBe(true);
        spy.mockRestore();
    });
});
