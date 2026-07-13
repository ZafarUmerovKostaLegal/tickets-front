import type { StatisticsLaborDetailRow } from './statisticsLaborTypes';
import type { StackedBarRow } from './statisticsChartTypes';

export function aggregateBarByLawyer(rows: StatisticsLaborDetailRow[]): StackedBarRow[] {
    const map = new Map<string, StackedBarRow>();

    for (const row of rows) {
        const id = row.lawyer_id?.trim() || row.lawyer_name?.trim();
        const name = row.lawyer_name?.trim() || id;
        if (!id || !name)
            continue;

        const billable = Number.isFinite(row.billable_hours) ? row.billable_hours : 0;
        const total = Number.isFinite(row.hours) ? row.hours : 0;
        const nonBillable = Math.max(0, total - billable);

        const prev = map.get(id) ?? { id, name, primary: 0, secondary: 0 };
        map.set(id, {
            id,
            name: prev.name || name,
            primary: prev.primary + billable,
            secondary: prev.secondary + nonBillable,
        });
    }

    return Array.from(map.values())
        .filter((r) => r.primary + r.secondary > 0)
        .sort((a, b) => (b.primary + b.secondary) - (a.primary + a.secondary));
}
