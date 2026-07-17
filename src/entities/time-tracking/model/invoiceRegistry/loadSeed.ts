import type { InvoiceRegistryRow, InvoiceRegistryYearId } from './types';
import { readInvoiceRegistryOverrides } from './storage';

const seedLoaders: Record<InvoiceRegistryYearId, () => Promise<{ default: InvoiceRegistryRow[] }>> = {
    '2026': () => import('./seed/year-2026.json'),
    '2025': () => import('./seed/year-2025.json'),
    '2024': () => import('./seed/year-2024.json'),
    '2023': () => import('./seed/year-2023.json'),
    '2022': () => import('./seed/year-2022.json'),
    '2021': () => import('./seed/year-2021.json'),
    '2020': () => import('./seed/year-2020.json'),
    checklist: () => import('./seed/year-checklist.json'),
};

function normalizeRows(raw: unknown): InvoiceRegistryRow[] {
    if (!Array.isArray(raw))
        return [];
    return raw.map((item, i) => {
        const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const id = typeof o.id === 'string' && o.id.trim() ? o.id : `row-${i + 1}`;
        const row: InvoiceRegistryRow = { id };
        for (const [k, v] of Object.entries(o)) {
            if (k === 'id')
                continue;
            row[k] = v == null ? '' : String(v);
        }
        return row;
    });
}

export async function loadInvoiceRegistryRows(year: InvoiceRegistryYearId): Promise<{
    rows: InvoiceRegistryRow[];
    fromOverrides: boolean;
}> {
    const overrides = readInvoiceRegistryOverrides(year);
    if (overrides) {
        return { rows: overrides, fromOverrides: true };
    }
    const mod = await seedLoaders[year]();
    return { rows: normalizeRows(mod.default ?? mod), fromOverrides: false };
}
