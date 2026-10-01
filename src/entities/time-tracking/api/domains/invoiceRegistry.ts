import { apiFetch } from '@shared/api';
import { reportsThrowIfNotOk } from './httpShared';
import type { InvoiceRegistryRow, InvoiceRegistryYearId } from '../../model/invoiceRegistry';

export type InvoiceRegistryYearMeta = {
    id: InvoiceRegistryYearId;
    sheetName: string;
    mode: 'active' | 'archive' | 'system';
    rowCount: number;
    seedRevision?: string;
};

export type InvoiceRegistrySheetDto = {
    year: InvoiceRegistryYearId;
    sheetName: string;
    mode: 'active' | 'archive' | 'system';
    columns: Array<{ key: string; label: string; editor?: 'text' | 'status' }>;
    rows: InvoiceRegistryRow[];
    statuses?: string[];
};

export type InvoiceRegistryStatisticsDto = {
    year: string;
    invoicedByCurrency: Array<{ currency: string; invoiced: number }>;
    partnerMatrix: {
        currencies: string[];
        partners: Array<{ partner: string; amounts: Record<string, number> }>;
    };
};

export async function getInvoiceRegistryYears(): Promise<{
    years: InvoiceRegistryYearMeta[];
    /** null — старый сервер без версии сида, автозамену листа не делаем. */
    seedRevision2026: string | null;
}> {
    const res = await apiFetch('/api/v1/time-tracking/invoice-registry/years');
    await reportsThrowIfNotOk(res);
    const data = await res.json() as { years?: InvoiceRegistryYearMeta[]; seedRevision2026?: string | null };
    return {
        years: Array.isArray(data.years) ? data.years : [],
        seedRevision2026: typeof data.seedRevision2026 === 'string' || data.seedRevision2026 === null
            ? (data.seedRevision2026 ?? null)
            : null,
    };
}

export async function getInvoiceRegistrySheet(year: InvoiceRegistryYearId, q?: string): Promise<InvoiceRegistrySheetDto> {
    const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/${encodeURIComponent(year)}${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<InvoiceRegistrySheetDto>;
}

export async function createInvoiceRegistryRow2026(body: Partial<InvoiceRegistryRow>): Promise<InvoiceRegistryRow> {
    const res = await apiFetch('/api/v1/time-tracking/invoice-registry/2026/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<InvoiceRegistryRow>;
}

export async function patchInvoiceRegistryRow2026(rowId: string, patch: Partial<InvoiceRegistryRow>): Promise<InvoiceRegistryRow> {
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/2026/rows/${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<InvoiceRegistryRow>;
}

export const MANUAL_2026_SEED_REVISION = 'manual-excel-2026-v1';

export async function replaceInvoiceRegistryRows2026(
    rows: InvoiceRegistryRow[],
    opts?: { force?: boolean; seedRevision?: string },
): Promise<void> {
    const params = new URLSearchParams();
    if (opts?.force)
        params.set('force', 'true');
    if (opts?.seedRevision)
        params.set('seedRevision', opts.seedRevision);
    const query = params.toString();
    const qs = query ? `?${query}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/2026/rows${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
    });
    await reportsThrowIfNotOk(res);
}

export async function replaceInvoiceRegistryArchiveSheet(
    year: Exclude<InvoiceRegistryYearId, '2026' | '2026-system'>,
    rows: InvoiceRegistryRow[],
    opts?: { force?: boolean },
): Promise<void> {
    const qs = opts?.force ? '?force=true' : '';
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/archive/${encodeURIComponent(year)}${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
    });
    await reportsThrowIfNotOk(res);
}

export async function getInvoiceRegistryStatistics(year: '2026' | 'all' = '2026'): Promise<InvoiceRegistryStatisticsDto> {
    const y = year === 'all' ? '2026' : year;
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/statistics?year=${encodeURIComponent(y)}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<InvoiceRegistryStatisticsDto>;
}
