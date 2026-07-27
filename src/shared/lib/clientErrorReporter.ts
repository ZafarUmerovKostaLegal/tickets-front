type ClientErrorContext = {
    source: string;
    componentStack?: string | null;
};

type ClientErrorPayload = {
    source: string;
    name: string;
    message: string;
    stack: string | null;
    componentStack: string | null;
    path: string;
    userAgent: string;
    recordedAt: string;
};

const MAX_REPORTS_PER_MINUTE = 10;
const recentReportTimes: number[] = [];
const recentFingerprints = new Map<string, number>();
let globalReportingInstalled = false;

function normalizeError(value: unknown): Error {
    if (value instanceof Error)
        return value;
    if (typeof value === 'string')
        return new Error(value);
    try {
        return new Error(JSON.stringify(value));
    }
    catch {
        return new Error('Unknown client error');
    }
}

function reportUrl(): string | null {
    const raw = String(import.meta.env.VITE_CLIENT_ERROR_REPORT_URL ?? '').trim();
    if (!raw || typeof window === 'undefined')
        return null;
    try {
        const url = new URL(raw, window.location.origin);
        if (url.origin !== window.location.origin && url.protocol !== 'https:')
            return null;
        return url.toString();
    }
    catch {
        return null;
    }
}

function canReport(error: Error, source: string): boolean {
    const now = Date.now();
    while (recentReportTimes.length > 0 && now - recentReportTimes[0]! > 60_000)
        recentReportTimes.shift();
    if (recentReportTimes.length >= MAX_REPORTS_PER_MINUTE)
        return false;
    const fingerprint = `${source}:${error.name}:${error.message}:${error.stack?.split('\n')[1] ?? ''}`;
    const previous = recentFingerprints.get(fingerprint) ?? 0;
    if (now - previous < 10_000)
        return false;
    recentFingerprints.set(fingerprint, now);
    recentReportTimes.push(now);
    return true;
}

function buildPayload(error: Error, context: ClientErrorContext): ClientErrorPayload {
    return {
        source: context.source,
        name: error.name.slice(0, 100),
        message: error.message.slice(0, 2_000),
        stack: error.stack?.slice(0, 8_000) ?? null,
        componentStack: context.componentStack?.slice(0, 8_000) ?? null,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : '',
        recordedAt: new Date().toISOString(),
    };
}

export function reportClientError(value: unknown, context: ClientErrorContext): void {
    const error = normalizeError(value);
    console.error(`[client-error:${context.source}]`, error, context.componentStack ?? '');
    const url = reportUrl();
    if (!url || !canReport(error, context.source))
        return;
    const body = JSON.stringify(buildPayload(error, context));
    try {
        if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' })))
            return;
    }
    catch {
    }
    void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
    }).catch(() => { });
}

export function installGlobalErrorReporting(): void {
    if (globalReportingInstalled || typeof window === 'undefined')
        return;
    globalReportingInstalled = true;
    window.addEventListener('error', (event) => {
        reportClientError(event.error ?? event.message, { source: 'window.error' });
    });
    window.addEventListener('unhandledrejection', (event) => {
        reportClientError(event.reason, { source: 'window.unhandledrejection' });
    });
}
