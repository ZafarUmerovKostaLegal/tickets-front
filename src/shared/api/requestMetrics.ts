export type ApiRequestDelivery = 'network' | 'deduplicated' | 'reused';
export type ApiRequestOutcome = 'success' | 'http-error' | 'aborted' | 'network-error';

export type ApiRequestMetric = {
    id: number;
    method: string;
    endpoint: string;
    delivery: ApiRequestDelivery;
    outcome: ApiRequestOutcome;
    status: number | null;
    durationMs: number;
    recordedAt: number;
};

export type ApiRequestMetricsSummary = {
    requestCount: number;
    networkCount: number;
    avoidedNetworkCount: number;
    abortedCount: number;
    errorCount: number;
    averageDurationMs: number;
    p95DurationMs: number;
};

type MetricInput = Omit<ApiRequestMetric, 'id' | 'endpoint' | 'recordedAt'> & {
    url: string;
};

const MAX_METRICS = 250;
const metrics: ApiRequestMetric[] = [];
const listeners = new Set<() => void>();
let metricId = 0;

function normalizeEndpoint(url: string): string {
    try {
        const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://local');
        const keys = [...new Set(parsed.searchParams.keys())].sort();
        return `${parsed.pathname}${keys.length > 0 ? `?${keys.join('&')}` : ''}`;
    }
    catch {
        return url.split('?')[0] || '/';
    }
}

export function apiRequestMetricNow(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

export function recordApiRequestMetric(input: MetricInput): ApiRequestMetric {
    const metric: ApiRequestMetric = Object.freeze({
        id: ++metricId,
        method: input.method,
        endpoint: normalizeEndpoint(input.url),
        delivery: input.delivery,
        outcome: input.outcome,
        status: input.status,
        durationMs: Math.max(0, Math.round(input.durationMs * 10) / 10),
        recordedAt: Date.now(),
    });
    metrics.push(metric);
    if (metrics.length > MAX_METRICS)
        metrics.splice(0, metrics.length - MAX_METRICS);
    for (const listener of [...listeners]) {
        try {
            listener();
        }
        catch {
        }
    }
    if (typeof window !== 'undefined' && import.meta.env.DEV)
        window.dispatchEvent(new CustomEvent('api-request-metric', { detail: metric }));
    return metric;
}

export function getApiRequestMetrics(): readonly ApiRequestMetric[] {
    return metrics.slice();
}

export function subscribeApiRequestMetrics(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function clearApiRequestMetrics(): void {
    metrics.length = 0;
    for (const listener of [...listeners]) {
        try {
            listener();
        }
        catch {
        }
    }
}

export function getApiRequestMetricsSummary(): ApiRequestMetricsSummary {
    const requestCount = metrics.length;
    const networkCount = metrics.filter((metric) => metric.delivery === 'network').length;
    const abortedCount = metrics.filter((metric) => metric.outcome === 'aborted').length;
    const errorCount = metrics.filter((metric) => metric.outcome === 'http-error' || metric.outcome === 'network-error').length;
    const sortedDurations = metrics.map((metric) => metric.durationMs).sort((a, b) => a - b);
    const totalDuration = sortedDurations.reduce((sum, duration) => sum + duration, 0);
    const p95Index = Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1);
    return {
        requestCount,
        networkCount,
        avoidedNetworkCount: requestCount - networkCount,
        abortedCount,
        errorCount,
        averageDurationMs: requestCount > 0 ? Math.round((totalDuration / requestCount) * 10) / 10 : 0,
        p95DurationMs: sortedDurations[p95Index] ?? 0,
    };
}
