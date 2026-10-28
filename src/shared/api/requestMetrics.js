const MAX_METRICS = 250;
const metrics = [];
const listeners = new Set();
let metricId = 0;
function normalizeEndpoint(url) {
    try {
        const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://local');
        const keys = [...new Set(parsed.searchParams.keys())].sort();
        return `${parsed.pathname}${keys.length > 0 ? `?${keys.join('&')}` : ''}`;
    }
    catch {
        return url.split('?')[0] || '/';
    }
}
export function apiRequestMetricNow() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}
export function recordApiRequestMetric(input) {
    const metric = Object.freeze({
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
export function getApiRequestMetrics() {
    return metrics.slice();
}
export function subscribeApiRequestMetrics(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
export function clearApiRequestMetrics() {
    metrics.length = 0;
    for (const listener of [...listeners]) {
        try {
            listener();
        }
        catch {
        }
    }
}
export function getApiRequestMetricsSummary() {
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
export function getApiRequestEndpointSummaries() {
    const groups = new Map();
    for (const metric of metrics) {
        const key = `${metric.method}\u0000${metric.endpoint}`;
        const group = groups.get(key);
        if (group)
            group.push(metric);
        else
            groups.set(key, [metric]);
    }
    return [...groups.values()].map((group) => {
        const durations = group.map((metric) => metric.durationMs).sort((a, b) => a - b);
        const networkCount = group.filter((metric) => metric.delivery === 'network').length;
        const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
        const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
        return {
            method: group[0].method,
            endpoint: group[0].endpoint,
            requestCount: group.length,
            networkCount,
            avoidedNetworkCount: group.length - networkCount,
            abortedCount: group.filter((metric) => metric.outcome === 'aborted').length,
            errorCount: group.filter((metric) => metric.outcome === 'http-error' || metric.outcome === 'network-error').length,
            averageDurationMs: Math.round((totalDuration / group.length) * 10) / 10,
            p95DurationMs: durations[p95Index] ?? 0,
        };
    }).sort((a, b) => b.networkCount - a.networkCount
        || b.requestCount - a.requestCount
        || b.averageDurationMs - a.averageDurationMs
        || a.endpoint.localeCompare(b.endpoint));
}
