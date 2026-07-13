

import type { TimeExcelPreviewRow } from './previewExcelTypes';

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

export function getLocalYmdAndHmFromIso(iso: string): { ymd: string; hm: string } | null {
    const s = String(iso ?? '').trim();
    if (!s)
        return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return null;
    const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return { ymd, hm };
}


export function getLocalYmdFromIso(iso: string): string | null {
    return getLocalYmdAndHmFromIso(iso)?.ymd ?? null;
}


export function localYmdAndHmToIso(ymd: string, hm: string): string {
    const dPart = ymd.slice(0, 10);
    const m = /^(\d{1,2}):(\d{2})/.exec((hm || '12:00').trim());
    const hh = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 12;
    const mm = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    const p = dPart.split('-').map((x) => parseInt(x, 10));
    if (p.length < 3 || p.some((n) => !Number.isFinite(n)))
        return new Date().toISOString();
    const [y, mo, day] = p;
    const local = new Date(y, mo - 1, day, hh, mm, 0, 0);
    if (Number.isNaN(local.getTime()))
        return new Date().toISOString();
    return local.toISOString();
}

export function formatRuYmd(ymd: string): string {
    const p = ymd.slice(0, 10).split('-');
    if (p.length !== 3)
        return ymd;
    return `${p[2]}.${p[1]}.${p[0]}`;
}

export function formatRuHmFromIso(iso: string): string {
    const t = getLocalYmdAndHmFromIso(iso);
    if (!t)
        return '—';
    return t.hm;
}



export function recordedAtSortKeyMs(r: TimeExcelPreviewRow): number | null {
    if (r.rowKind === 'aggregate')
        return null;
    const wd = String(r.workDate ?? '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(wd)) {
        const parsed = getLocalYmdAndHmFromIso(r.recordedAt);
        const hm = parsed?.hm ?? '12:00';
        const t = Date.parse(localYmdAndHmToIso(wd, hm));
        if (Number.isFinite(t))
            return t;
        const noon = Date.parse(`${wd}T12:00:00`);
        if (Number.isFinite(noon))
            return noon;
    }
    const rec = String(r.recordedAt ?? '').trim();
    if (rec) {
        const t = Date.parse(rec);
        if (Number.isFinite(t))
            return t;
    }
    return null;
}

export function compareTimePreviewRowsChronologically(
    a: TimeExcelPreviewRow,
    b: TimeExcelPreviewRow,
    order: 'asc' | 'desc',
): number {
    const ka = recordedAtSortKeyMs(a);
    const kb = recordedAtSortKeyMs(b);
    const aBad = ka === null;
    const bBad = kb === null;
    if (aBad && bBad)
        return a.rowKey.localeCompare(b.rowKey);
    if (aBad)
        return 1;
    if (bBad)
        return -1;
    const diff = (ka as number) - (kb as number);
    if (diff !== 0)
        return order === 'asc' ? diff : -diff;
    return a.rowKey.localeCompare(b.rowKey);
}

export function sortTimePreviewRowsChronologically(
    rows: TimeExcelPreviewRow[],
    order: 'asc' | 'desc' = 'asc',
): TimeExcelPreviewRow[] {
    return [...rows].sort((a, b) => compareTimePreviewRowsChronologically(a, b, order));
}

export function isDateTimeOnlyPreviewPatch(patch: Partial<TimeExcelPreviewRow>): boolean {
    const keys = Object.keys(patch);
    return keys.length > 0 && keys.every((k) => k === 'recordedAt' || k === 'workDate');
}
