import { apiFetch } from '@shared/api/client';

export const CBU_JSON_BASE_PATH = '/ru/arkhiv-kursov-valyut/json';
export interface CbuJsonRow {
    id: number;
    Ccy: string;
    Nominal: string;
    Rate: string;
    Date: string;
}
export interface CbuParsed {
    rateDateRu: string;
    uzsPerUsd: number;
    uzsPerUnit: Map<string, number>;
}

/** Dev-only direct/proxy origin; production always goes through gateway (no browser CORS to cbu.uz). */
function getCbuOrigin(): string {
    const v = import.meta.env.VITE_CBU_ORIGIN as string | undefined;
    if (v?.trim())
        return v.replace(/\/$/, '');
    return import.meta.env.DEV ? '/cbu-json' : 'https://cbu.uz';
}

function parseNum(s: string): number {
    const n = parseFloat(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
}
export function parseCbuRows(rows: CbuJsonRow[]): CbuParsed {
    const uzsPerUnit = new Map<string, number>();
    for (const r of rows) {
        const nom = parseNum(r.Nominal);
        const rate = parseNum(r.Rate);
        if (!Number.isFinite(nom) || nom <= 0 || !Number.isFinite(rate) || rate <= 0)
            continue;
        uzsPerUnit.set(r.Ccy, rate / nom);
    }
    const uzsUsd = uzsPerUnit.get('USD');
    if (uzsUsd == null || uzsUsd <= 0) {
        throw new Error('В ответе ЦБ нет курса USD');
    }
    const usdRow = rows.find(r => r.Ccy === 'USD');
    return {
        rateDateRu: usdRow?.Date ?? '',
        uzsPerUsd: uzsUsd,
        uzsPerUnit,
    };
}
export function foreignUnitsPerUsd(parsed: CbuParsed, ccy: string): number | undefined {
    const c = String(ccy ?? '').trim().toUpperCase();
    if (!c || c === 'USD')
        return 1;
    if (c === 'UZS') {
        const uzsRow = parsed.uzsPerUnit.get('UZS');
        if (uzsRow != null && uzsRow > 0)
            return parsed.uzsPerUsd / uzsRow;
        return parsed.uzsPerUsd > 0 ? parsed.uzsPerUsd : undefined;
    }
    const uzsX = parsed.uzsPerUnit.get(c);
    if (uzsX == null || uzsX <= 0)
        return undefined;
    return parsed.uzsPerUsd / uzsX;
}

async function fetchCbuRowsFrom(url: string): Promise<CbuJsonRow[]> {
    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as CbuJsonRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('пустой список курсов');
    }
    return rows;
}

const cbuCache = new Map<string, Promise<CbuParsed>>();

/** Prefer gateway proxy (same-origin) so prod browsers don't hit cbu.uz CORS / 404 spam. */
async function fetchCbuViaGateway(isoDate: string): Promise<CbuParsed> {
    const res = await apiFetch(
        `/api/v1/cbu-rates?date=${encodeURIComponent(isoDate)}`,
        { getReuseWindowMs: 60_000 },
    );
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = await res.clone().json() as { detail?: string; message?: string };
            msg = String(j.detail ?? j.message ?? msg);
        }
        catch {
            /* keep status message */
        }
        throw new Error(msg);
    }
    const raw = await res.json() as { rows?: CbuJsonRow[] } | CbuJsonRow[];
    const rows = Array.isArray(raw) ? raw : (raw.rows ?? []);
    return parseCbuRows(rows);
}

async function fetchCbuDirectWithFallback(isoDate: string): Promise<CbuParsed> {
    const base = getCbuOrigin();
    const anchor = isoDate.trim().slice(0, 10);
    const urls: string[] = [];
    const [y, m, d] = anchor.split('-').map(Number);
    // At most exact day + 2 previous + latest — avoid 8× console noise.
    if (y && m && d) {
        const start = new Date(y, m - 1, d);
        for (let back = 0; back < 3; back++) {
            const dt = new Date(start);
            dt.setDate(start.getDate() - back);
            const yy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            urls.push(`${base}${CBU_JSON_BASE_PATH}/all/${yy}-${mm}-${dd}/`);
        }
    }
    else {
        urls.push(`${base}${CBU_JSON_BASE_PATH}/all/${anchor}/`);
    }
    urls.push(`${base}${CBU_JSON_BASE_PATH}/`);
    const errors: string[] = [];
    for (const url of urls) {
        try {
            return parseCbuRows(await fetchCbuRowsFrom(url));
        }
        catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
        }
    }
    throw new Error(`ЦБ РУз: не удалось получить курс на ${anchor}. ${errors.slice(0, 2).join('; ')}`);
}

export async function fetchCbuParsedForDate(isoDate: string): Promise<CbuParsed> {
    const anchor = isoDate.trim().slice(0, 10);
    const hit = cbuCache.get(anchor);
    if (hit)
        return hit;
    const pending = (async () => {
        if (!import.meta.env.DEV) {
            try {
                return await fetchCbuViaGateway(anchor);
            }
            catch {
                // Gateway not deployed yet — fall back carefully (may CORS in browser).
            }
        }
        return fetchCbuDirectWithFallback(anchor);
    })();
    cbuCache.set(anchor, pending);
    try {
        return await pending;
    }
    catch (e) {
        cbuCache.delete(anchor);
        throw e;
    }
}

/** Build FX pairs for invoice ensure (1 from = rate to) covering `forDate`. */
export function cbuParsedToInvoiceFxRates(parsed: CbuParsed, forDate: string): Array<{
    fromCurrency: string;
    toCurrency: string;
    rateDate: string;
    rate: number;
}> {
    const rateDate = forDate.trim().slice(0, 10);
    const out: Array<{ fromCurrency: string; toCurrency: string; rateDate: string; rate: number }> = [];
    const uzsUsd = parsed.uzsPerUsd;
    if (!(uzsUsd > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(rateDate))
        return out;
    out.push({ fromCurrency: 'USD', toCurrency: 'UZS', rateDate, rate: uzsUsd });
    out.push({ fromCurrency: 'UZS', toCurrency: 'USD', rateDate, rate: 1 / uzsUsd });
    for (const [ccy, uzsPer] of parsed.uzsPerUnit.entries()) {
        const c = String(ccy).trim().toUpperCase();
        if (!c || c === 'UZS' || c === 'USD' || !(uzsPer > 0))
            continue;
        out.push({ fromCurrency: c, toCurrency: 'UZS', rateDate, rate: uzsPer });
        out.push({ fromCurrency: 'UZS', toCurrency: c, rateDate, rate: 1 / uzsPer });
        const ccyPerUsd = uzsUsd / uzsPer;
        if (ccyPerUsd > 0) {
            out.push({ fromCurrency: 'USD', toCurrency: c, rateDate, rate: ccyPerUsd });
            out.push({ fromCurrency: c, toCurrency: 'USD', rateDate, rate: 1 / ccyPerUsd });
        }
    }
    return out;
}
