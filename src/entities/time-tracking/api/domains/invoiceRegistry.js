import { apiFetch } from '@shared/api';
import { reportsThrowIfNotOk } from './httpShared';
export async function getInvoiceRegistryYears() {
    const res = await apiFetch('/api/v1/time-tracking/invoice-registry/years');
    await reportsThrowIfNotOk(res);
    const data = await res.json();
    return {
        years: Array.isArray(data.years) ? data.years : [],
        seedRevision2026: typeof data.seedRevision2026 === 'string' || data.seedRevision2026 === null
            ? (data.seedRevision2026 ?? null)
            : null,
    };
}
export async function getInvoiceRegistrySheet(year, q) {
    const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/${encodeURIComponent(year)}${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json();
}
export async function createInvoiceRegistryRow2026(body) {
    const res = await apiFetch('/api/v1/time-tracking/invoice-registry/2026/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json();
}
export async function patchInvoiceRegistryRow2026(rowId, patch) {
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/2026/rows/${encodeURIComponent(rowId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    await reportsThrowIfNotOk(res);
    return res.json();
}
export const MANUAL_2026_SEED_REVISION = 'manual-excel-2026-v1';
export async function replaceInvoiceRegistryRows2026(rows, opts) {
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
export async function replaceInvoiceRegistryArchiveSheet(year, rows, opts) {
    const qs = opts?.force ? '?force=true' : '';
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/archive/${encodeURIComponent(year)}${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
    });
    await reportsThrowIfNotOk(res);
}
export async function getInvoiceRegistryStatistics(year = '2026') {
    const y = year === 'all' ? '2026' : year;
    const res = await apiFetch(`/api/v1/time-tracking/invoice-registry/statistics?year=${encodeURIComponent(y)}`);
    await reportsThrowIfNotOk(res);
    return res.json();
}
