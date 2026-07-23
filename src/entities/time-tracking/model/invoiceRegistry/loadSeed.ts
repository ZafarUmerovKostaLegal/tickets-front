import type { InvoiceRegistryRow, InvoiceRegistryYearId } from './types';
import { applyInvoiceRegistryCurrencyCodeFixes } from './currencyCodeMap';
import { applyInvoiceRegistryPartnerCodeFixes } from './partnerCodeMap';
import { readInvoiceRegistryOverrides, writeInvoiceRegistryOverrides } from './storage';

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

function normalizeRegistryRow(row: InvoiceRegistryRow): InvoiceRegistryRow {
    return applyInvoiceRegistryCurrencyCodeFixes(applyInvoiceRegistryPartnerCodeFixes(row));
}

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
        return normalizeRegistryRow(row);
    });
}

export async function loadInvoiceRegistryRows(year: InvoiceRegistryYearId): Promise<{
    rows: InvoiceRegistryRow[];
    fromOverrides: boolean;
}> {
    const overrides = readInvoiceRegistryOverrides(year);
    if (overrides) {
        const rows = overrides.map((r) => normalizeRegistryRow(r));
        const changed = rows.some((r, i) => r !== overrides[i]);
        if (changed)
            writeInvoiceRegistryOverrides(year, rows);
        return { rows, fromOverrides: true };
    }
    const mod = await seedLoaders[year]();
    return { rows: normalizeRows(mod.default ?? mod), fromOverrides: false };
}
