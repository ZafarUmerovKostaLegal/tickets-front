import { normalizeReportEmployeePositionLabel } from '@entities/time-tracking/lib/reportEmployeePosition';
import { compareReportPositionTitles, normalizePositionRateTableLabel } from './reportPreviewPositionRates';
const UNKNOWN_POSITION_LABEL = 'Не указано';
function positionLabelForShare(raw) {
    const normalized = normalizePositionRateTableLabel(normalizeReportEmployeePositionLabel(raw));
    return normalized || UNKNOWN_POSITION_LABEL;
}
export function reportPreviewPositionShareLabel(raw) {
    return positionLabelForShare(raw ?? '');
}
export function rowMatchesPositionShareFilter(row, selectedPositions) {
    if (selectedPositions.length === 0)
        return true;
    const allowed = new Set(selectedPositions);
    return allowed.has(positionLabelForShare(row.employeePosition ?? ''));
}
export function itemMatchesPositionShareFilter(position, selectedPositions) {
    if (selectedPositions.length === 0)
        return true;
    return selectedPositions.includes(positionLabelForShare(position ?? ''));
}
export function togglePositionShareFilter(selected, position) {
    const next = new Set(selected);
    if (next.has(position))
        next.delete(position);
    else
        next.add(position);
    return [...next];
}
export function buildReportPreviewPositionShare(rows) {
    const hoursByPosition = new Map();
    let totalBillableHours = 0;
    for (const row of rows) {
        const billableHours = Number.isFinite(row.billableHours) ? row.billableHours : 0;
        if (billableHours <= 0)
            continue;
        const position = positionLabelForShare(row.employeePosition ?? '');
        hoursByPosition.set(position, (hoursByPosition.get(position) ?? 0) + billableHours);
        totalBillableHours += billableHours;
    }
    if (totalBillableHours <= 0)
        return [];
    const shares = [...hoursByPosition.entries()].map(([position, billableHours]) => ({
        position,
        billableHours: Math.round(billableHours * 100) / 100,
        percent: Math.round((billableHours / totalBillableHours) * 100),
    }));
    return normalizePositionSharePercents(shares);
}
function normalizePositionSharePercents(rows) {
    if (rows.length === 0)
        return rows;
    const sorted = [...rows].sort((a, b) => compareReportPositionTitles(a.position, b.position));
    const sumRounded = sorted.reduce((acc, row) => acc + row.percent, 0);
    if (sumRounded === 100 || sorted.length === 1)
        return sorted;
    const delta = 100 - sumRounded;
    const largest = sorted.reduce((best, row) => (row.billableHours > best.billableHours ? row : best), sorted[0]);
    return sorted.map((row) => (row.position === largest.position
        ? { ...row, percent: row.percent + delta }
        : row));
}
