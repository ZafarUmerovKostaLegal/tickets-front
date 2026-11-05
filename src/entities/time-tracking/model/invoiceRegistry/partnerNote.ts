import type { InvoiceRegistryRow } from './types';

function invoiceIdOf(row: InvoiceRegistryRow): string {
    const explicit = String(row.invoiceId ?? '').trim();
    if (explicit)
        return explicit;
    return row.id.startsWith('sys-') ? row.id.slice(4) : '';
}

/** Fill an empty registry cell from the invoice partner note. A note already on the row stays. */
export function mergeRegistryPartnerNotes(
    rows: readonly InvoiceRegistryRow[],
    notesByInvoiceId: ReadonlyMap<string, string>,
): InvoiceRegistryRow[] {
    let changed = false;
    const next = rows.map((row) => {
        if (String(row.partnerNote ?? '').trim())
            return row;
        const note = notesByInvoiceId.get(invoiceIdOf(row))?.trim() ?? '';
        if (!note)
            return row;
        changed = true;
        return { ...row, partnerNote: note };
    });
    return changed ? next : rows as InvoiceRegistryRow[];
}
