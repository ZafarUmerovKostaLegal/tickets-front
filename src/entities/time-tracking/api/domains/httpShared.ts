export type PaginatedResult<T> = {
    items: T[];
    total: number;
    limit: number;
    offset: number;
};
export type TimeTrackingPaginationParams = {
    limit: number;
    offset?: number;
};

export function parseTimeTrackingPagedResponse<T>(raw: unknown, mapItem: (item: unknown) => T | null, request: {
    limit: number;
    offset: number;
}): PaginatedResult<T> {
    if (Array.isArray(raw)) {
        const items = raw.map(mapItem).filter((x): x is T => x != null);
        const total = request.limit > 0 && items.length >= request.limit
            ? request.offset + items.length + 1
            : request.offset + items.length;
        return {
            items,
            total,
            limit: request.limit,
            offset: request.offset,
        };
    }
    if (raw && typeof raw === 'object' && 'items' in raw) {
        const o = raw as Record<string, unknown>;
        const arr = o.items;
        if (!Array.isArray(arr)) {
            return {
                items: [],
                total: 0,
                limit: request.limit,
                offset: request.offset,
            };
        }
        const items = arr.map(mapItem).filter((x): x is T => x != null);
        const totalRaw = typeof o.total === 'number' ? o.total : Number(o.total);
        const limitRaw = typeof o.limit === 'number' ? o.limit : Number(o.limit);
        const offsetRaw = typeof o.offset === 'number' ? o.offset : Number(o.offset);
        return {
            items,
            total: Number.isFinite(totalRaw) ? totalRaw : items.length,
            limit: Number.isFinite(limitRaw) ? limitRaw : request.limit,
            offset: Number.isFinite(offsetRaw) ? offsetRaw : request.offset,
        };
    }
    return {
        items: [],
        total: 0,
        limit: request.limit,
        offset: request.offset,
    };
}

export function unwrapTimeTrackingListArray(raw: unknown): unknown[] | null {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items))
        return (raw as Record<string, unknown>).items as unknown[];
    return null;
}

export function formatApiDetail(detail: unknown): string | null {
    if (detail == null)
        return null;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object' && 'msg' in item) {
                    const m = (item as {
                        msg?: unknown;
                    }).msg;
                    if (typeof m === 'string')
                        return m;
                }
                try {
                    return JSON.stringify(item);
                }
                catch {
                    return String(item);
                }
            })
            .join('; ');
    }
    if (typeof detail === 'object') {
        try {
            return JSON.stringify(detail);
        }
        catch {
            return String(detail);
        }
    }
    return String(detail);
}

export class TimeTrackingHttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'TimeTrackingHttpError';
        this.status = status;
    }
}
export function isTimeTrackingHttpError(e: unknown, status?: number): e is TimeTrackingHttpError {
    return e instanceof TimeTrackingHttpError && (status === undefined || e.status === status);
}

/** Gateway returns 502/503 when the time-tracking upstream is down or not configured. */
export const TIME_TRACKING_UNAVAILABLE_MESSAGE =
    'Сервис учёта времени временно недоступен. Обновите страницу через минуту.';

export function isTimeTrackingUnavailableStatus(status: number): boolean {
    return status === 502 || status === 503;
}

export function isTimeTrackingUnavailableError(e: unknown): boolean {
    if (isTimeTrackingHttpError(e, 502) || isTimeTrackingHttpError(e, 503))
        return true;
    const msg = e instanceof Error ? e.message : String(e ?? '');
    return /503|502|service unavailable|сервис учёта времени временно недоступен|time tracking service unavailable/i.test(msg);
}
export function normalizeLegacyTimeTrackingUsersError(message: string): string {
    const m = String(message ?? '').trim();
    if (!m)
        return m;
    if (/only administrators and office managers can view time tracking users/i.test(m))
        return 'Нет доступа к списку сотрудников.';
    return m;
}
export async function throwIfNotOk(res: Response): Promise<Response> {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        const text = await res.text();
        const trimmed = text.trim();
        let fromDetail: string | null = null;
        if (trimmed) {
            try {
                const j = JSON.parse(text) as {
                    detail?: unknown;
                    message?: unknown;
                };
                fromDetail = formatApiDetail(j.detail);
                if (fromDetail)
                    msg = fromDetail;
                else if (typeof j.message === 'string' && j.message)
                    msg = j.message;
                else
                    msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
            }
            catch {
                msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
            }
        }
        if (res.status === 403) {
            msg = fromDetail ||
                (trimmed && msg !== `HTTP ${res.status}` ? msg : '') ||
                'Недостаточно прав для этой операции (403). Это ограничение доступа, а не сбой сети — обратитесь к администратору.';
        }
        if (isTimeTrackingUnavailableStatus(res.status)) {
            msg = TIME_TRACKING_UNAVAILABLE_MESSAGE;
        }
        else if (res.status >= 500) {
            console.error('[time-tracking api]', res.status, msg);
        }
        throw new TimeTrackingHttpError(res.status, normalizeLegacyTimeTrackingUsersError(msg));
    }
    return res;
}

export function isForbiddenError(e: unknown): boolean {
    return (e instanceof Error &&
        /\b403\b|HTTP\s*403|Недостаточно прав|доступны только администраторам|доступны администраторам|доступа к проектам/i.test(e.message));
}

export function dashNum(v: unknown, fallback = 0): number {
    if (v == null || v === '')
        return fallback;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : fallback;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
}

export async function reportsThrowIfNotOk(res: Response): Promise<void> {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = (await res.clone().json()) as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch { }
        if (res.status === 401 && msg === 'HTTP 401')
            msg = 'Требуется вход или сессия истекла';
        else if (res.status === 403 && msg === 'HTTP 403')
            msg = 'Нет доступа к этой операции';
        else if (isTimeTrackingUnavailableStatus(res.status))
            msg = TIME_TRACKING_UNAVAILABLE_MESSAGE;
        throw new TimeTrackingHttpError(res.status, normalizeLegacyTimeTrackingUsersError(msg));
    }
}
