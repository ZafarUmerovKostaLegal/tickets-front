import { apiFetch } from '@shared/api';

/** Minimal row shape for the partner "for review" badge (home / TT tabs). */
export type PartnerPendingBadgeRow = {
    pendingPartnerAuthUserIds: number[];
};

export type PartnerPendingListScope = 'mine' | 'all';

const pendingInflight = new Map<PartnerPendingListScope, Promise<PartnerPendingBadgeRow[]>>();

export function invalidatePartnerReportConfirmationsPendingCache(): void {
    pendingInflight.clear();
}

function readPartnerConfirmNum(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function parsePartnerPendingBadgeRow(raw: unknown): PartnerPendingBadgeRow | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const pendArr = o.pendingPartnerAuthUserIds ?? o.pending_partner_auth_user_ids;
    const pendingPartnerAuthUserIds = (Array.isArray(pendArr) ? pendArr : [])
        .map(readPartnerConfirmNum)
        .filter((x): x is number => x != null);
    return { pendingPartnerAuthUserIds };
}

function parsePartnerPendingBadgeList(raw: unknown): PartnerPendingBadgeRow[] {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map(parsePartnerPendingBadgeRow)
        .filter((x): x is PartnerPendingBadgeRow => x != null);
}

/**
 * Lightweight pending-confirmations fetch for badge counts.
 * Kept outside monolith.ts so home/hub does not pull the full TT API module.
 */
export async function listPartnerReportConfirmationsPendingForBadge(options?: {
    scope?: PartnerPendingListScope;
}): Promise<PartnerPendingBadgeRow[]> {
    const scope: PartnerPendingListScope = options?.scope === 'all' ? 'all' : 'mine';
    if (!pendingInflight.has(scope)) {
        const qs = scope === 'all' ? '?scope=all' : '';
        const inflight = (async () => {
            const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/pending${qs}`);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            return parsePartnerPendingBadgeList(await res.json());
        })().catch((err) => {
            pendingInflight.delete(scope);
            throw err;
        });
        pendingInflight.set(scope, inflight);
    }
    return pendingInflight.get(scope)!;
}
