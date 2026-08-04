import { describe, expect, it } from 'vitest';
import {
    clampReportsDateRange,
    REPORTS_ALL_TIME_DATE_FROM,
    REPORTS_MAX_RANGE_DAYS,
    periodToDates,
} from './reportsPeriodRange';
import { normalizeReportPreviewTransfer } from '../model/reportPreviewTransfer';

describe('clampReportsDateRange', () => {
    it('keeps short ranges', () => {
        expect(clampReportsDateRange('2024-01-01', '2024-01-31')).toEqual({
            dateFrom: '2024-01-01',
            dateTo: '2024-01-31',
        });
    });

    it('clamps legacy all-time 2000-01-01 to API max', () => {
        const to = '2024-07-06';
        const clamped = clampReportsDateRange(REPORTS_ALL_TIME_DATE_FROM, to);
        expect(clamped.dateTo).toBe(to);
        expect(clamped.dateFrom).not.toBe(REPORTS_ALL_TIME_DATE_FROM);
        const from = new Date(`${clamped.dateFrom}T12:00:00`);
        const end = new Date(`${clamped.dateTo}T12:00:00`);
        const span = Math.round((end.getTime() - from.getTime()) / 86_400_000);
        expect(span).toBeLessThanOrEqual(REPORTS_MAX_RANGE_DAYS);
    });

    it('all-time preset stays within max days', () => {
        const ref = new Date(2024, 6, 6);
        const range = periodToDates(ref, 'all');
        const span = Math.round(
            (new Date(`${range.dateTo}T12:00:00`).getTime() - new Date(`${range.dateFrom}T12:00:00`).getTime())
            / 86_400_000,
        );
        expect(span).toBeLessThanOrEqual(REPORTS_MAX_RANGE_DAYS);
    });
});

describe('normalizeReportPreviewTransfer', () => {
    it('clamps oversized dateFrom/dateTo in transfer filters', () => {
        const out = normalizeReportPreviewTransfer({
            v: 2,
            reportType: 'time',
            groupBy: 'projects',
            filters: {
                dateFrom: '2000-01-01',
                dateTo: '2024-07-06',
                page: 1,
                per_page: 100,
            },
        });
        expect(out.filters.dateFrom).not.toBe('2000-01-01');
        expect(out.filters.dateTo).toBe('2024-07-06');
        const span = Math.round(
            (new Date(`${out.filters.dateTo}T12:00:00`).getTime()
                - new Date(`${out.filters.dateFrom}T12:00:00`).getTime())
            / 86_400_000,
        );
        expect(span).toBeLessThanOrEqual(REPORTS_MAX_RANGE_DAYS);
    });
});
