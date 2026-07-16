import { apiFetch } from '@shared/api';





export type PartnerPendingBadgeRow = {

    pendingPartnerAuthUserIds: number[];

};



export type PartnerPendingListScope = 'mine' | 'all';



const pendingInflight = new Map<PartnerPendingListScope, Promise<PartnerPendingBadgeRow[]>>();

const badgeCountInflight = new Map<PartnerPendingListScope, Promise<number>>();



export function invalidatePartnerReportConfirmationsPendingCache(): void {

    pendingInflight.clear();

    badgeCountInflight.clear();

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

    if (Array.isArray(raw)) {

        return raw

            .map(parsePartnerPendingBadgeRow)

            .filter((x): x is PartnerPendingBadgeRow => x != null);

    }

    if (raw && typeof raw === 'object') {

        const o = raw as Record<string, unknown>;

        const items = o.items ?? o.results;

        if (Array.isArray(items)) {

            return items

                .map(parsePartnerPendingBadgeRow)

                .filter((x): x is PartnerPendingBadgeRow => x != null);

        }

    }

    return [];

}



/** Лёгкий badge-счётчик (без полного списка и entryCounts). */

export async function fetchPartnerForReviewBadgeCount(options?: {

    scope?: PartnerPendingListScope;

}): Promise<number> {

    const scope: PartnerPendingListScope = options?.scope === 'all' ? 'all' : 'mine';

    if (!badgeCountInflight.has(scope)) {

        const params = new URLSearchParams();

        if (scope === 'all')

            params.set('scope', 'all');

        const qs = params.toString();

        const inflight = (async () => {

            const res = await apiFetch(

                `/api/v1/time-tracking/reports/partner-confirmations/pending/badge${qs ? `?${qs}` : ''}`,

            );

            if (!res.ok)

                throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (data && typeof data === 'object') {

                const n = Number((data as Record<string, unknown>).count);

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

    return badgeCountInflight.get(scope)!;

}





/** @deprecated Prefer fetchPartnerForReviewBadgeCount — kept for callers expecting rows. */

export async function listPartnerReportConfirmationsPendingForBadge(options?: {

    scope?: PartnerPendingListScope;

}): Promise<PartnerPendingBadgeRow[]> {

    const scope: PartnerPendingListScope = options?.scope === 'all' ? 'all' : 'mine';

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


