import { listHourlyRates, pickEffectiveBillableRateForProject, parseHourlyRateAmount } from '@entities/time-tracking';
import { recomputeTimePreviewRowAmountToPay } from './reportPreviewPartnerExcel';
function pickBillableRateFromHourlyRates(rows, projectId, currency) {
    const pick = pickEffectiveBillableRateForProject(rows, projectId, currency);
    if (!pick)
        return null;
    const amt = parseHourlyRateAmount(pick.row);
    return Number.isFinite(amt) && amt > 0 ? amt : null;
}
export function resolveBillableRateFromSiblingRows(rows, authUserId, projectId, excludeRowKey) {
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
export async function fetchBillableRateForPreviewRow(authUserId, projectId, currency) {
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
const AMOUNT_RECALC_PATCH_KEYS = [
    'billableHours',
    'hours',
    'billableRate',
    'isBillable',
    'authUserId',
    'isVoided',
];
export function applyTimePreviewRowPatch(row, patch, allRows) {
    const prevAuth = row.authUserId;
    const merged = { ...row, ...patch };
    // Keep session-copy origin; after a content edit the UI shows a dot instead of «Копия».
    if (row.isSessionCopy) {
        const keys = Object.keys(patch);
        const contentEdit = keys.some((k) => k !== 'isSessionCopy' && k !== 'sessionCopyEdited' && k !== 'scopeColor');
        if (contentEdit)
            merged.sessionCopyEdited = true;
        merged.isSessionCopy = true;
    }
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
export function previewRowNeedsAsyncBillableRateFetch(prevRow, patch, _merged) {
    if (patch.authUserId == null || patch.authUserId === prevRow.authUserId)
        return false;
    if (patch.billableRate != null && Number.isFinite(patch.billableRate))
        return false;
    return true;
}
