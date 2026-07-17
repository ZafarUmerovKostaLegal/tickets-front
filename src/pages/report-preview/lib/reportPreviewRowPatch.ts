import { listHourlyRates, pickEffectiveBillableRateForProject, parseHourlyRateAmount, type HourlyRateRow } from '@entities/time-tracking';
import { recomputeTimePreviewRowAmountToPay } from './reportPreviewPartnerExcel';
import type { TimeExcelPreviewRow } from './previewExcelTypes';

function pickBillableRateFromHourlyRates(rows: HourlyRateRow[], projectId: string, currency: string): number | null {
    const pick = pickEffectiveBillableRateForProject(rows, projectId, currency);
    if (!pick)
        return null;
    const amt = parseHourlyRateAmount(pick.row);
    return Number.isFinite(amt) && amt > 0 ? amt : null;
}

export function resolveBillableRateFromSiblingRows(rows: TimeExcelPreviewRow[], authUserId: number, projectId: string, excludeRowKey?: string): number | null {
    const pid = projectId.trim();
    if (!pid || authUserId <= 0)
        return null;
    for (const r of rows) {
        if (excludeRowKey && r.rowKey === excludeRowKey)
            continue;
        if (r.rowKind !== 'entry' || r.isVoided)
            continue;
        if (r.authUserId !== authUserId)
            continue;
        if (String(r.projectId ?? '').trim() !== pid)
            continue;
        const rate = Number.isFinite(r.billableRate) ? r.billableRate : 0;
        if (rate > 0)
            return rate;
    }
    return null;
}

export async function fetchBillableRateForPreviewRow(authUserId: number, projectId: string, currency: string): Promise<number | null> {
    if (authUserId <= 0)
        return null;
    try {
        const rows = await listHourlyRates(authUserId, 'billable');
        return pickBillableRateFromHourlyRates(rows, projectId, currency);
    }
    catch {
        return null;
    }
}

const AMOUNT_RECALC_PATCH_KEYS: (keyof TimeExcelPreviewRow)[] = [
    'billableHours',
    'hours',
    'billableRate',
    'isBillable',
    'authUserId',
    'isVoided',
];

export function applyTimePreviewRowPatch(row: TimeExcelPreviewRow, patch: Partial<TimeExcelPreviewRow>, allRows: TimeExcelPreviewRow[]): TimeExcelPreviewRow {
    const prevAuth = row.authUserId;
    const merged: TimeExcelPreviewRow = { ...row, ...patch };
    const authChanged = patch.authUserId != null && patch.authUserId !== prevAuth;
    const rateExplicitlyPatched = patch.billableRate != null && Number.isFinite(patch.billableRate);
    if (authChanged && !rateExplicitlyPatched) {
        const siblingRate = resolveBillableRateFromSiblingRows(allRows, merged.authUserId, merged.projectId, merged.rowKey);
        merged.billableRate = siblingRate != null && siblingRate > 0 ? siblingRate : 0;
    }
    if (patch.billableHours != null && patch.hours == null && merged.isBillable)
        merged.hours = patch.billableHours;
    const needsRecalc = authChanged || AMOUNT_RECALC_PATCH_KEYS.some((k) => k in patch);
    if (needsRecalc)
        merged.amountToPay = recomputeTimePreviewRowAmountToPay(merged);
    return merged;
}

export function previewRowNeedsAsyncBillableRateFetch(prevRow: TimeExcelPreviewRow, patch: Partial<TimeExcelPreviewRow>, _merged: TimeExcelPreviewRow): boolean {
    if (patch.authUserId == null || patch.authUserId === prevRow.authUserId)
        return false;
    if (patch.billableRate != null && Number.isFinite(patch.billableRate))
        return false;
    return true;
}
