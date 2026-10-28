import { apiFetch } from '@shared/api';
const pendingInflight = new Map();
const badgeCountInflight = new Map();
export function invalidatePartnerReportConfirmationsPendingCache() {
    pendingInflight.clear();
    badgeCountInflight.clear();
}
function readPartnerConfirmNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function parsePartnerPendingBadgeRow(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const pendArr = o.pendingPartnerAuthUserIds ?? o.pending_partner_auth_user_ids;
    const pendingPartnerAuthUserIds = (Array.isArray(pendArr) ? pendArr : [])
        .map(readPartnerConfirmNum)
        .filter((x) => x != null);
    return { pendingPartnerAuthUserIds };
}
function parsePartnerPendingBadgeList(raw) {
    if (Array.isArray(raw)) {
        return raw
            .map(parsePartnerPendingBadgeRow)
            .filter((x) => x != null);
    }
    if (raw && typeof raw === 'object') {
        const o = raw;
        const items = o.items ?? o.results;
        if (Array.isArray(items)) {
            return items
                .map(parsePartnerPendingBadgeRow)
                .filter((x) => x != null);
        }
    }
    return [];
}
export async function fetchPartnerForReviewBadgeCount(options) {
    const scope = options?.scope === 'all' ? 'all' : 'mine';
    if (!badgeCountInflight.has(scope)) {
        const params = new URLSearchParams();
        if (scope === 'all')
            params.set('scope', 'all');
        const qs = params.toString();
        const inflight = (async () => {
            const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/pending/badge${qs ? `?${qs}` : ''}`);
            if (!res.ok) {
                if (res.status === 502 || res.status === 503)
                    return 0;
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data && typeof data === 'object') {
                const n = Number(data.count);
                if (Number.isFinite(n) && n >= 0)
                    return Math.round(n);
            }
            return 0;
        })().catch((err) => {
            badgeCountInflight.delete(scope);
            throw err;
        });
        badgeCountInflight.set(scope, inflight);
    }
    return badgeCountInflight.get(scope);
}
export async function listPartnerReportConfirmationsPendingForBadge(options) {
    const scope = options?.scope === 'all' ? 'all' : 'mine';
    if (!pendingInflight.has(scope)) {
        const params = new URLSearchParams();
        if (scope === 'all')
            params.set('scope', 'all');
        params.set('page', '1');
        params.set('pageSize', '1');
        params.set('includeEntryCounts', 'false');
        const qs = params.toString();
        const inflight = (async () => {
            const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/pending?${qs}`);
            if (!res.ok) {
                if (res.status === 502 || res.status === 503)
                    return [];
                throw new Error(`HTTP ${res.status}`);
            }
            return parsePartnerPendingBadgeList(await res.json());
        })().catch((err) => {
            pendingInflight.delete(scope);
            throw err;
        });
        pendingInflight.set(scope, inflight);
    }
    return pendingInflight.get(scope);
}
