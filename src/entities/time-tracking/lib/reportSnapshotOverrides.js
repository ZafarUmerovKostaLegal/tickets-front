const SNAPSHOT_OVERRIDE_KEYS = new Set([
    'workDate', 'recordedAt', 'clientName', 'projectName', 'taskName', 'note', 'description',
    'hours', 'isBillable', 'taskBillableByDefault', 'employeeName', 'employeePosition',
    'billableRate', 'amountToPay', 'costRate', 'costAmount', 'currency', 'externalReferenceUrl',
    'scopeColor',
]);
export function pickAllowedSnapshotOverrides(overrides) {
    const out = {};
    for (const k of Object.keys(overrides)) {
        if (SNAPSHOT_OVERRIDE_KEYS.has(k))
            out[k] = overrides[k];
    }
    return out;
}
export function getSnapshotRowDisplayData(row) {
    const eff = row.effective;
    if (eff && typeof eff === 'object' && !Array.isArray(eff) && Object.keys(eff).length > 0)
        return eff;
    return (row.data && typeof row.data === 'object' && !Array.isArray(row.data))
        ? row.data
        : {};
}
