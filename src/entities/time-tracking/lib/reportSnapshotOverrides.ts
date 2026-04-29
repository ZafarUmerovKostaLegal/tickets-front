
const SNAPSHOT_OVERRIDE_KEYS = new Set<string>([
    'workDate', 'recordedAt', 'clientName', 'projectName', 'taskName', 'note', 'description',
    'hours', 'isBillable', 'taskBillableByDefault', 'employeeName', 'employeePosition',
    'billableRate', 'amountToPay', 'costRate', 'costAmount', 'currency', 'externalReferenceUrl',
]);

export function pickAllowedSnapshotOverrides(overrides: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(overrides)) {
        if (SNAPSHOT_OVERRIDE_KEYS.has(k))
            out[k] = overrides[k];
    }
    return out;
}

export function getSnapshotRowDisplayData(row: {
    data?: Record<string, unknown> | null;
    effective?: Record<string, unknown> | null;
}): Record<string, unknown> {
    const eff = row.effective;
    if (eff && typeof eff === 'object' && !Array.isArray(eff) && Object.keys(eff as object).length > 0)
        return eff as Record<string, unknown>;
    return (row.data && typeof row.data === 'object' && !Array.isArray(row.data))
        ? (row.data as Record<string, unknown>)
        : {};
}
