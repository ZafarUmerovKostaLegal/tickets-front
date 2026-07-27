import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearApiRequestMetrics,
    getApiRequestMetrics,
    getApiRequestMetricsSummary,
    recordApiRequestMetric,
} from './requestMetrics';

describe('API request metrics', () => {
    beforeEach(() => clearApiRequestMetrics());

    it('records query parameter names without leaking their values', () => {
        recordApiRequestMetric({
            method: 'GET',
            url: 'https://api.test/api/v1/users?token=secret&search=Alice',
            delivery: 'network',
            outcome: 'success',
            status: 200,
            durationMs: 12.34,
        });

        expect(getApiRequestMetrics()[0]).toMatchObject({
            endpoint: '/api/v1/users?search&token',
            durationMs: 12.3,
        });
        expect(JSON.stringify(getApiRequestMetrics())).not.toContain('secret');
        expect(JSON.stringify(getApiRequestMetrics())).not.toContain('Alice');
    });

    it('summarizes avoided requests, errors and latency', () => {
        for (const [delivery, outcome, durationMs] of [
            ['network', 'success', 10],
            ['deduplicated', 'success', 20],
            ['reused', 'http-error', 30],
            ['network', 'aborted', 40],
        ] as const) {
            recordApiRequestMetric({
                method: 'GET',
                url: '/api/v1/example',
                delivery,
                outcome,
                status: outcome === 'http-error' ? 500 : outcome === 'aborted' ? null : 200,
                durationMs,
            });
        }

        expect(getApiRequestMetricsSummary()).toEqual({
            requestCount: 4,
            networkCount: 2,
            avoidedNetworkCount: 2,
            abortedCount: 1,
            errorCount: 1,
            averageDurationMs: 25,
            p95DurationMs: 40,
        });
    });
});
